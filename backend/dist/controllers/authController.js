"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProfile = exports.verify2FA = exports.setup2FA = exports.logout = exports.refreshToken = exports.login = exports.register = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const speakeasy_1 = __importDefault(require("speakeasy"));
const qrcode_1 = __importDefault(require("qrcode"));
const database_1 = require("../config/database");
const logger_1 = require("../utils/logger");
const generateTokens = (userId) => {
    const token = jsonwebtoken_1.default.sign({ userId }, process.env.JWT_SECRET, {
        expiresIn: '15m',
    });
    const refreshToken = jsonwebtoken_1.default.sign({ userId }, process.env.JWT_REFRESH_SECRET, {
        expiresIn: '7d',
    });
    return { token, refreshToken };
};
const register = async (req, res) => {
    try {
        const { firstName, lastName, email, password, organizationName } = req.body;
        const existing = await database_1.prisma.user.findFirst({ where: { email } });
        if (existing)
            return res.status(409).json({ error: 'Email already registered' });
        const slug = organizationName.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now();
        const org = await database_1.prisma.organization.create({
            data: { name: organizationName, slug },
        });
        const passwordHash = await bcryptjs_1.default.hash(password, 12);
        const user = await database_1.prisma.user.create({
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
        const pipeline = await database_1.prisma.pipeline.create({
            data: { organizationId: org.id, name: 'Sales Pipeline', isDefault: true },
        });
        await database_1.prisma.pipelineStage.createMany({
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
        await database_1.prisma.userSession.create({
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
    }
    catch (error) {
        logger_1.logger.error('Register error', error);
        res.status(500).json({ error: error.message });
    }
};
exports.register = register;
const login = async (req, res) => {
    try {
        const { email, password, totpCode } = req.body;
        const user = await database_1.prisma.user.findFirst({
            where: { email },
            include: { organization: true },
        });
        if (!user || !user.passwordHash) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const valid = await bcryptjs_1.default.compare(password, user.passwordHash);
        if (!valid)
            return res.status(401).json({ error: 'Invalid credentials' });
        if (!user.isActive)
            return res.status(403).json({ error: 'Account deactivated' });
        if (user.twoFactorEnabled) {
            if (!totpCode)
                return res.status(200).json({ requiresTwoFactor: true });
            const verified = speakeasy_1.default.totp.verify({
                secret: user.twoFactorSecret,
                encoding: 'base32',
                token: totpCode,
            });
            if (!verified)
                return res.status(401).json({ error: 'Invalid 2FA code' });
        }
        await database_1.prisma.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } });
        const { token, refreshToken } = generateTokens(user.id);
        await database_1.prisma.userSession.create({
            data: {
                userId: user.id,
                token,
                refreshToken,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
            },
        });
        const safeUser = { ...user };
        delete safeUser.passwordHash;
        delete safeUser.twoFactorSecret;
        res.json({ user: safeUser, token, refreshToken });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.login = login;
const refreshToken = async (req, res) => {
    try {
        const { refreshToken: rt } = req.body;
        if (!rt)
            return res.status(401).json({ error: 'No refresh token' });
        const decoded = jsonwebtoken_1.default.verify(rt, process.env.JWT_REFRESH_SECRET);
        const session = await database_1.prisma.userSession.findUnique({ where: { refreshToken: rt } });
        if (!session)
            return res.status(401).json({ error: 'Invalid refresh token' });
        const { token, refreshToken: newRefresh } = generateTokens(decoded.userId);
        await database_1.prisma.userSession.update({
            where: { id: session.id },
            data: { token, refreshToken: newRefresh, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
        });
        res.json({ token, refreshToken: newRefresh });
    }
    catch {
        res.status(401).json({ error: 'Invalid refresh token' });
    }
};
exports.refreshToken = refreshToken;
const logout = async (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (token)
            await database_1.prisma.userSession.deleteMany({ where: { token } });
        res.json({ message: 'Logged out' });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.logout = logout;
const setup2FA = async (req, res) => {
    try {
        const secret = speakeasy_1.default.generateSecret({ name: `WhatsApp CRM (${req.user.email})`, length: 20 });
        const qrCodeUrl = await qrcode_1.default.toDataURL(secret.otpauth_url);
        await database_1.prisma.user.update({
            where: { id: req.user.id },
            data: { twoFactorSecret: secret.base32 },
        });
        res.json({ secret: secret.base32, qrCode: qrCodeUrl });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.setup2FA = setup2FA;
const verify2FA = async (req, res) => {
    try {
        const { totpCode } = req.body;
        const user = await database_1.prisma.user.findUnique({ where: { id: req.user.id } });
        if (!user?.twoFactorSecret)
            return res.status(400).json({ error: '2FA not set up' });
        const verified = speakeasy_1.default.totp.verify({
            secret: user.twoFactorSecret,
            encoding: 'base32',
            token: totpCode,
        });
        if (!verified)
            return res.status(400).json({ error: 'Invalid code' });
        await database_1.prisma.user.update({ where: { id: req.user.id }, data: { twoFactorEnabled: true } });
        res.json({ message: '2FA enabled' });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.verify2FA = verify2FA;
const getProfile = async (req, res) => {
    try {
        const user = await database_1.prisma.user.findUnique({
            where: { id: req.user.id },
            include: { organization: true, team: true },
        });
        if (!user)
            return res.status(404).json({ error: 'User not found' });
        const { passwordHash, twoFactorSecret, ...safeUser } = user;
        res.json(safeUser);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.getProfile = getProfile;
//# sourceMappingURL=authController.js.map