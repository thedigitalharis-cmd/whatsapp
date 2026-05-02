import { Router, Response } from 'express';
import { prisma } from '../config/database';
import { AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const automations = await prisma.automation.findMany({
      where: { organizationId: req.user!.organizationId },
      orderBy: { createdAt: 'desc' },
    });
    res.json(automations);
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const automation = await prisma.automation.create({
      data: { ...req.body, organizationId: req.user!.organizationId },
    });
    res.status(201).json(automation);
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const automation = await prisma.automation.findFirst({
      where: { id: req.params.id, organizationId: req.user!.organizationId },
    });
    if (!automation) return res.status(404).json({ error: 'Not found' });
    res.json(automation);
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const automation = await prisma.automation.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json(automation);
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

router.patch('/:id/toggle', async (req: AuthRequest, res: Response) => {
  try {
    const current = await prisma.automation.findUnique({ where: { id: req.params.id } });
    const automation = await prisma.automation.update({
      where: { id: req.params.id },
      data: { status: current?.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE' },
    });
    res.json(automation);
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    await prisma.automation.delete({ where: { id: req.params.id } });
    res.json({ message: 'Deleted' });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

export default router;
