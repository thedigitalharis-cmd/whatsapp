import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';

const generateTokens = (userId: string) => {
  const token = jwt.sign({ userId }, process.env.JWT_SECRET as string, {
    expiresIn: (process.env.JWT_EXPIRES_IN || '900') as any,
  });
  const refreshToken = jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET as string, {
    expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN || '604800') as any,
  });
  return { token, refreshToken };
};

export const register = async (req: Request, res: Response) => {
  try {
    const { firstName, lastName, email, password, organizationName } = req.body;

    const existing = await prisma.user.findFirst({ where: { email } });
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const slug = organizationName.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now();
    const org = await prisma.organization.create({
      data: { name: organizationName, slug },
    });

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        organizationId: org.id,
        firstName,
        lastName,
        email,
        passwordHash,
        role: 'ADMIN',
        isEmailVerified: true,
      },
      select: { id: true, email: true, firstName: true, lastName: true, role: true, organizationId: true },
    });

    // Create default pipeline
    const pipeline = await prisma.pipeline.create({
      data: { organizationId: org.id, name: 'Sales Pipeline', isDefault: true },
    });
    await prisma.pipelineStage.createMany({
      data: [
        { pipelineId: pipeline.id, name: 'New', order: 1, probability: 10, color: '#6366f1' },
        { pipelineId: pipeline.id, name: 'Contacted', order: 2, probability: 25, color: '#3b82f6' },
        { pipelineId: pipeline.id, name: 'Proposal', order: 3, probability: 50, color: '#f59e0b' },
        { pipelineId: pipeline.id, name: 'Negotiation', order: 4, probability: 75, color: '#10b981' },
        { pipelineId: pipeline.id, name: 'Closed Won', order: 5, probability: 100, color: '#22c55e' },
        { pipelineId: pipeline.id, name: 'Closed Lost', order: 6, probability: 0, color: '#ef4444' },
      ],
    });

    const { token, refreshToken } = generateTokens(user.id);
    await prisma.userSession.create({
      data: {
        userId: user.id,
        token,
        refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    res.status(201).json({ user, token, refreshToken, organization: org });
  } catch (error: any) {
    logger.error('Register error', error);
    res.status(500).json({ error: error.message });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password, totpCode } = req.body;

    const user = await prisma.user.findFirst({
      where: { email },
      include: { organization: true },
    });

    if (!user || !user.passwordHash) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    if (!user.isActive) return res.status(403).json({ error: 'Account deactivated' });

    if (user.twoFactorEnabled) {
      if (!totpCode) return res.status(200).json({ requiresTwoFactor: true });
      const verified = speakeasy.totp.verify({
        secret: user.twoFactorSecret!,
        encoding: 'base32',
        token: totpCode,
      });
      if (!verified) return res.status(401).json({ error: 'Invalid 2FA code' });
    }

    await prisma.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } });

    const { token, refreshToken } = generateTokens(user.id);
    await prisma.userSession.create({
      data: {
        userId: user.id,
        token,
        refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    const safeUser: any = { ...user };
    delete safeUser.passwordHash;
    delete safeUser.twoFactorSecret;
    res.json({ user: safeUser, token, refreshToken });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const refreshToken = async (req: Request, res: Response) => {
  try {
    const { refreshToken: rt } = req.body;
    if (!rt) return res.status(401).json({ error: 'No refresh token' });

    const decoded = jwt.verify(rt, process.env.JWT_REFRESH_SECRET!) as any;
    const session = await prisma.userSession.findUnique({ where: { refreshToken: rt } });
    if (!session) return res.status(401).json({ error: 'Invalid refresh token' });

    const { token, refreshToken: newRefresh } = generateTokens(decoded.userId);
    await prisma.userSession.update({
      where: { id: session.id },
      data: { token, refreshToken: newRefresh, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
    });

    res.json({ token, refreshToken: newRefresh });
  } catch {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
};

export const logout = async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token) await prisma.userSession.deleteMany({ where: { token } });
    res.json({ message: 'Logged out' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const setup2FA = async (req: any, res: Response) => {
  try {
    const secret = speakeasy.generateSecret({ name: `WhatsApp CRM (${req.user.email})`, length: 20 });
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url!);

    await prisma.user.update({
      where: { id: req.user.id },
      data: { twoFactorSecret: secret.base32 },
    });

    res.json({ secret: secret.base32, qrCode: qrCodeUrl });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const verify2FA = async (req: any, res: Response) => {
  try {
    const { totpCode } = req.body;
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user?.twoFactorSecret) return res.status(400).json({ error: '2FA not set up' });

    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: totpCode,
    });

    if (!verified) return res.status(400).json({ error: 'Invalid code' });
    await prisma.user.update({ where: { id: req.user.id }, data: { twoFactorEnabled: true } });
    res.json({ message: '2FA enabled' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getProfile = async (req: any, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { organization: true, team: true },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    const { passwordHash, twoFactorSecret, ...safeUser } = user;
    res.json(safeUser);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
