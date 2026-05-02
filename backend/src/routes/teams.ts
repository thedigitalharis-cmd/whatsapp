import { Router, Response } from 'express';
import { prisma } from '../config/database';
import { AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const teams = await prisma.team.findMany({
      where: { organizationId: req.user!.organizationId },
      include: { users: { select: { id: true, firstName: true, lastName: true, avatar: true } } },
    });
    res.json(teams);
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const team = await prisma.team.create({ data: { ...req.body, organizationId: req.user!.organizationId } });
    res.status(201).json(team);
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const team = await prisma.team.update({ where: { id: req.params.id }, data: req.body });
    res.json(team);
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    await prisma.team.delete({ where: { id: req.params.id } });
    res.json({ message: 'Deleted' });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

export default router;
