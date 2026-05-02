import { Router, Response } from 'express';
import { prisma } from '../config/database';
import { AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const templates = await prisma.messageTemplate.findMany({
      where: { organizationId: req.user!.organizationId },
      orderBy: { createdAt: 'desc' },
    });
    res.json(templates);
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const template = await prisma.messageTemplate.create({
      data: { ...req.body, organizationId: req.user!.organizationId },
    });
    res.status(201).json(template);
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const template = await prisma.messageTemplate.update({ where: { id: req.params.id }, data: req.body });
    res.json(template);
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    await prisma.messageTemplate.delete({ where: { id: req.params.id } });
    res.json({ message: 'Deleted' });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

export default router;
