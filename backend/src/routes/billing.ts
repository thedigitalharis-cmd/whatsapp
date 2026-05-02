import { Router, Response } from 'express';
import { prisma } from '../config/database';
import { AuthRequest, requireRole } from '../middleware/auth';

const router = Router();

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const billing = await prisma.billingSubscription.findUnique({
      where: { organizationId: req.user!.organizationId },
    });
    res.json(billing);
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

router.post('/upgrade', requireRole('ADMIN', 'SUPER_ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { plan } = req.body;
    const billing = await prisma.billingSubscription.upsert({
      where: { organizationId: req.user!.organizationId },
      update: { plan },
      create: { organizationId: req.user!.organizationId, plan },
    });
    await prisma.organization.update({
      where: { id: req.user!.organizationId },
      data: { plan },
    });
    res.json(billing);
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

export default router;
