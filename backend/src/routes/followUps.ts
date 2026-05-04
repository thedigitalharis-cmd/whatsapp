import { Router, Response } from 'express';
import { prisma } from '../config/database';
import { AuthRequest } from '../middleware/auth';

const router = Router();

// List follow-ups for org
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { status, contactId, conversationId, from, to } = req.query as any;
    const where: any = { organizationId: req.user!.organizationId };
    if (status) where.status = status;
    if (contactId) where.contactId = contactId;
    if (conversationId) where.conversationId = conversationId;
    if (from || to) {
      where.scheduledAt = {};
      if (from) where.scheduledAt.gte = new Date(from);
      if (to) where.scheduledAt.lte = new Date(to);
    }

    const followUps = await prisma.followUp.findMany({
      where,
      include: {
        contact: { select: { id: true, firstName: true, lastName: true, phone: true } },
        conversation: { select: { id: true, status: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { scheduledAt: 'asc' },
    });
    res.json(followUps);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Create follow-up
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const {
      title, message, scheduledAt, contactId, conversationId,
      type = 'MANUAL', recurringDays, notes,
    } = req.body;

    if (!message) return res.status(400).json({ error: 'Message is required' });
    if (!scheduledAt) return res.status(400).json({ error: 'Scheduled time is required' });
    if (!contactId && !conversationId) return res.status(400).json({ error: 'Contact or conversation is required' });

    // If conversationId given but no contactId, get it from conversation
    let resolvedContactId = contactId;
    if (!resolvedContactId && conversationId) {
      const conv = await prisma.conversation.findUnique({ where: { id: conversationId } });
      resolvedContactId = conv?.contactId;
    }

    const followUp = await prisma.followUp.create({
      data: {
        organizationId: req.user!.organizationId,
        createdById: req.user!.id,
        title: title || `Follow-up on ${new Date(scheduledAt).toLocaleDateString()}`,
        message,
        scheduledAt: new Date(scheduledAt),
        contactId: resolvedContactId,
        conversationId,
        type,
        recurringDays,
        notes,
        status: 'PENDING',
      },
      include: {
        contact: { select: { id: true, firstName: true, lastName: true, phone: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    res.status(201).json(followUp);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Update follow-up
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const followUp = await prisma.followUp.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json(followUp);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Cancel follow-up
router.patch('/:id/cancel', async (req: AuthRequest, res: Response) => {
  try {
    const followUp = await prisma.followUp.update({
      where: { id: req.params.id },
      data: { status: 'CANCELLED' },
    });
    res.json(followUp);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Send now (immediate trigger — bypasses scheduler)
router.post('/:id/send-now', async (req: AuthRequest, res: Response) => {
  try {
    const followUp = await prisma.followUp.findFirst({
      where: { id: req.params.id, organizationId: req.user!.organizationId },
      include: {
        contact: true,
        conversation: { include: { whatsappAccount: true } },
        organization: { include: { whatsappAccounts: { where: { status: 'ACTIVE' }, take: 1 } } },
      },
    });
    if (!followUp) return res.status(404).json({ error: 'Not found' });
    if (followUp.status !== 'PENDING') return res.status(400).json({ error: 'Only PENDING follow-ups can be sent' });

    const waAccount = (followUp.conversation as any)?.whatsappAccount
      || (followUp.organization as any)?.whatsappAccounts?.[0];

    if (!waAccount || !followUp.contact?.phone) {
      return res.status(400).json({ error: 'No WhatsApp account or contact phone' });
    }

    const { sendText } = await import('../services/whatsappService');
    const toPhone = followUp.contact.phone.replace(/[\s\-\(\)]/g, '').replace(/^\+/, '');
    const result = await sendText(waAccount.phoneNumberId, waAccount.accessToken, toPhone, followUp.message);
    const waMessageId = result?.messages?.[0]?.id;

    await prisma.followUp.update({
      where: { id: followUp.id },
      data: { status: 'SENT', sentAt: new Date(), waMessageId },
    });

    if (followUp.conversationId) {
      await prisma.message.create({
        data: {
          conversationId: followUp.conversationId,
          direction: 'OUTBOUND',
          type: 'TEXT',
          content: `🔔 [Follow-up] ${followUp.message}`,
          status: 'SENT',
          waMessageId,
        },
      });
      await prisma.conversation.update({ where: { id: followUp.conversationId }, data: { lastMessageAt: new Date() } });
    }

    res.json({ message: 'Sent!', waMessageId });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Delete
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    await prisma.followUp.delete({ where: { id: req.params.id } });
    res.json({ message: 'Deleted' });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
