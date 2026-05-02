import { Router, Response } from 'express';
import { prisma } from '../config/database';
import { AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { page = 1, limit = 50, status, priority, assigneeId } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const where: any = { organizationId: req.user!.organizationId };
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (assigneeId) where.assigneeId = assigneeId;

    const [tickets, total] = await Promise.all([
      prisma.ticket.findMany({
        where, skip, take: Number(limit),
        include: {
          contact: { select: { id: true, firstName: true, lastName: true, phone: true } },
          assignee: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.ticket.count({ where }),
    ]);
    res.json({ data: tickets, total });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const ticket = await prisma.ticket.create({
      data: { ...req.body, organizationId: req.user!.organizationId },
      include: { contact: true },
    });
    res.status(201).json(ticket);
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const ticket = await prisma.ticket.update({ where: { id: req.params.id }, data: req.body });
    res.json(ticket);
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

router.post('/:id/csat', async (req: AuthRequest, res: Response) => {
  try {
    const { csatScore, npsScore } = req.body;
    const ticket = await prisma.ticket.update({
      where: { id: req.params.id },
      data: { csatScore, npsScore },
    });
    res.json(ticket);
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

export default router;
