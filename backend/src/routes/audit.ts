import { Router, Response } from 'express';
import { prisma } from '../config/database';
import { AuthRequest, requireRole } from '../middleware/auth';

const router = Router();

router.get('/', requireRole('ADMIN', 'SUPER_ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { page = 1, limit = 50, action, entity, userId } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const where: any = { organizationId: req.user!.organizationId };
    if (action) where.action = action;
    if (entity) where.entity = entity;
    if (userId) where.userId = userId;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where, skip, take: Number(limit),
        include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.auditLog.count({ where }),
    ]);
    res.json({ data: logs, total });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

export default router;
