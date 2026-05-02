import { Router, Response } from 'express';
import { prisma } from '../config/database';
import { AuthRequest, requireRole } from '../middleware/auth';

const router = Router();

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const integrations = await prisma.integration.findMany({
      where: { organizationId: req.user!.organizationId },
    });
    res.json(integrations);
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

router.post('/', requireRole('ADMIN', 'SUPER_ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const integration = await prisma.integration.upsert({
      where: { organizationId_type: { organizationId: req.user!.organizationId, type: req.body.type } },
      update: req.body,
      create: { ...req.body, organizationId: req.user!.organizationId },
    });
    res.json(integration);
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

router.delete('/:id', requireRole('ADMIN', 'SUPER_ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    await prisma.integration.delete({ where: { id: req.params.id } });
    res.json({ message: 'Deleted' });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

export default router;
