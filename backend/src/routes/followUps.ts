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

// Send now (manual trigger)
router.post('/:id/send-now', async (req: AuthRequest, res: Response) => {
  try {
    await prisma.followUp.update({
      where: { id: req.params.id },
      data: { scheduledAt: new Date(Date.now() - 1000) }, // set to past so scheduler picks it up immediately
    });
    res.json({ message: 'Follow-up will be sent within 60 seconds' });
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
