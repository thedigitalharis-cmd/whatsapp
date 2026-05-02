import { Router, Response } from 'express';
import { prisma } from '../config/database';
import { AuthRequest, requireRole } from '../middleware/auth';

const router = Router();

router.get('/current', async (req: AuthRequest, res: Response) => {
  try {
    const org = await prisma.organization.findUnique({
      where: { id: req.user!.organizationId },
      include: { billingSubscription: true },
    });
    res.json(org);
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

router.put('/current', requireRole('ADMIN', 'SUPER_ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const org = await prisma.organization.update({
      where: { id: req.user!.organizationId },
      data: req.body,
    });
    res.json(org);
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

router.get('/custom-fields', async (req: AuthRequest, res: Response) => {
  try {
    const fields = await prisma.customField.findMany({
      where: { organizationId: req.user!.organizationId },
      orderBy: { entity: 'asc' },
    });
    res.json(fields);
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

router.post('/custom-fields', requireRole('ADMIN', 'SUPER_ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const field = await prisma.customField.create({
      data: { ...req.body, organizationId: req.user!.organizationId },
    });
    res.status(201).json(field);
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

export default router;
