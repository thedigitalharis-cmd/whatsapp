import { Response } from 'express';
import { prisma } from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { sendWhatsAppMessage } from './whatsappController';
import { logger } from '../utils/logger';

export const getBroadcasts = async (req: AuthRequest, res: Response) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const where: any = { organizationId: req.user!.organizationId };
    if (status) where.status = status;

    const [broadcasts, total] = await Promise.all([
      prisma.broadcast.findMany({
        where, skip, take: Number(limit),
        include: { template: { select: { id: true, name: true } }, whatsappAccount: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.broadcast.count({ where }),
    ]);

    res.json({ data: broadcasts, total });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createBroadcast = async (req: AuthRequest, res: Response) => {
  try {
    const broadcast = await prisma.broadcast.create({
      data: { ...req.body, organizationId: req.user!.organizationId, status: 'DRAFT' },
    });
    res.status(201).json(broadcast);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const launchBroadcast = async (req: AuthRequest, res: Response) => {
  try {
    const broadcast = await prisma.broadcast.findFirst({
      where: { id: req.params.id, organizationId: req.user!.organizationId },
      include: { template: true, whatsappAccount: true, recipients: { include: { broadcast: false } } },
    });
    if (!broadcast) return res.status(404).json({ error: 'Broadcast not found' });
    if (broadcast.status !== 'DRAFT' && broadcast.status !== 'SCHEDULED') {
      return res.status(400).json({ error: 'Broadcast already launched' });
    }

    // Build recipients from segment filter
    let contactIds: string[] = [];
    if (broadcast.segmentFilter) {
      const filter = broadcast.segmentFilter as any;
      const contacts = await prisma.contact.findMany({
        where: { organizationId: req.user!.organizationId, whatsappOptIn: true, ...filter },
        select: { id: true },
      });
      contactIds = contacts.map(c => c.id);
    }

    // Create recipient records
    if (contactIds.length > 0) {
      await prisma.broadcastRecipient.createMany({
        data: contactIds.map(contactId => ({ broadcastId: broadcast.id, contactId })),
        skipDuplicates: true,
      });
    }

    await prisma.broadcast.update({
      where: { id: broadcast.id },
      data: { status: 'RUNNING', sentAt: new Date(), totalRecipients: contactIds.length },
    });

    // Process in background
    processBroadcast(broadcast.id).catch(err => logger.error('Broadcast processing error', err));

    res.json({ message: 'Broadcast launched', totalRecipients: contactIds.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

const processBroadcast = async (broadcastId: string) => {
  const broadcast = await prisma.broadcast.findUnique({
    where: { id: broadcastId },
    include: { whatsappAccount: true, template: true, recipients: { include: { broadcast: false } } },
  });
  if (!broadcast) return;

  for (const recipient of broadcast.recipients) {
    try {
      const contact = await prisma.contact.findUnique({ where: { id: recipient.contactId } });
      if (!contact) continue;

      await sendWhatsAppMessage(
        broadcast.whatsappAccount.phoneNumberId,
        broadcast.whatsappAccount.accessToken,
        contact.phone,
        {
          type: 'template',
          template: {
            name: broadcast.template?.name || '',
            language: { code: broadcast.template?.language || 'en_US' },
            components: broadcast.variables ? [{ type: 'body', parameters: broadcast.variables }] : [],
          },
        }
      );

      await prisma.broadcastRecipient.update({
        where: { id: recipient.id },
        data: { status: 'SENT', sentAt: new Date() },
      });

      await prisma.broadcast.update({
        where: { id: broadcastId },
        data: { sentCount: { increment: 1 } },
      });

      // Rate limiting: 80 messages per second for Cloud API
      await new Promise(resolve => setTimeout(resolve, 13));
    } catch (err) {
      await prisma.broadcastRecipient.update({
        where: { id: recipient.id },
        data: { status: 'FAILED', failedAt: new Date() },
      });
      await prisma.broadcast.update({
        where: { id: broadcastId },
        data: { failedCount: { increment: 1 } },
      });
    }
  }

  await prisma.broadcast.update({
    where: { id: broadcastId },
    data: { status: 'COMPLETED', completedAt: new Date() },
  });
};

export const pauseBroadcast = async (req: AuthRequest, res: Response) => {
  try {
    const broadcast = await prisma.broadcast.update({
      where: { id: req.params.id },
      data: { status: 'PAUSED' },
    });
    res.json(broadcast);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getBroadcastStats = async (req: AuthRequest, res: Response) => {
  try {
    const broadcast = await prisma.broadcast.findFirst({
      where: { id: req.params.id, organizationId: req.user!.organizationId },
    });
    if (!broadcast) return res.status(404).json({ error: 'Not found' });

    const stats = {
      total: broadcast.totalRecipients,
      sent: broadcast.sentCount,
      delivered: broadcast.deliveredCount,
      read: broadcast.readCount,
      failed: broadcast.failedCount,
      optOut: broadcast.optOutCount,
      deliveryRate: broadcast.sentCount ? ((broadcast.deliveredCount / broadcast.sentCount) * 100).toFixed(1) : 0,
      readRate: broadcast.deliveredCount ? ((broadcast.readCount / broadcast.deliveredCount) * 100).toFixed(1) : 0,
    };

    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
