import { Router, Response } from 'express';
import { prisma } from '../config/database';
import { AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { page = 1, limit = 50, status, stageId, assigneeId } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const where: any = { organizationId: req.user!.organizationId };
    if (status) where.status = status;
    if (stageId) where.stageId = stageId;
    if (assigneeId) where.assigneeId = assigneeId;

    const [deals, total] = await Promise.all([
      prisma.deal.findMany({
        where, skip, take: Number(limit),
        include: {
          contact: { select: { id: true, firstName: true, lastName: true, phone: true } },
          assignee: { select: { id: true, firstName: true, lastName: true } },
          stage: { include: { pipeline: { select: { id: true, name: true } } } },
          tags: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.deal.count({ where }),
    ]);
    res.json({ data: deals, total });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const deal = await prisma.deal.create({
      data: { ...req.body, organizationId: req.user!.organizationId },
      include: { stage: true, contact: true },
    });
    res.status(201).json(deal);
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const deal = await prisma.deal.update({
      where: { id: req.params.id },
      data: req.body,
      include: { stage: true, contact: true },
    });
    res.json(deal);
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

router.patch('/:id/stage', async (req: AuthRequest, res: Response) => {
  try {
    const { stageId } = req.body;
    const deal = await prisma.deal.update({
      where: { id: req.params.id },
      data: { stageId },
      include: { stage: true },
    });
    res.json(deal);
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    await prisma.deal.delete({ where: { id: req.params.id } });
    res.json({ message: 'Deal deleted' });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

export default router;
