import { Router, Response } from 'express';
import { prisma } from '../config/database';
import { AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const campaigns = await prisma.campaign.findMany({
      where: { organizationId: req.user!.organizationId },
      include: { steps: { orderBy: { order: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(campaigns);
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { steps, ...data } = req.body;
    const campaign = await prisma.campaign.create({
      data: {
        ...data,
        organizationId: req.user!.organizationId,
        ...(steps && { steps: { create: steps } }),
      },
      include: { steps: { orderBy: { order: 'asc' } } },
    });
    res.status(201).json(campaign);
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const campaign = await prisma.campaign.update({
      where: { id: req.params.id },
      data: req.body,
      include: { steps: { orderBy: { order: 'asc' } } },
    });
    res.json(campaign);
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    await prisma.campaign.delete({ where: { id: req.params.id } });
    res.json({ message: 'Deleted' });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

export default router;
