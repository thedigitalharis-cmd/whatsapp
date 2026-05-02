import { Router, Response } from 'express';
import QRCode from 'qrcode';
import { prisma } from '../config/database';
import { AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const codes = await prisma.qRCode.findMany({
      where: { organizationId: req.user!.organizationId },
      orderBy: { createdAt: 'desc' },
    });
    res.json(codes);
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { name, message, whatsappAccountId, expiresAt } = req.body;

    const account = whatsappAccountId ? await prisma.whatsAppAccount.findUnique({
      where: { id: whatsappAccountId },
    }) : null;

    const waLink = account
      ? `https://wa.me/${account.phoneNumber.replace('+', '')}?text=${encodeURIComponent(message || '')}`
      : `https://wa.me/?text=${encodeURIComponent(message || '')}`;

    const qrDataUrl = await QRCode.toDataURL(waLink);

    const qrCode = await prisma.qRCode.create({
      data: {
        organizationId: req.user!.organizationId,
        whatsappAccountId,
        name,
        message,
        imageUrl: qrDataUrl,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
    });
    res.status(201).json(qrCode);
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    await prisma.qRCode.delete({ where: { id: req.params.id } });
    res.json({ message: 'Deleted' });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

export default router;
