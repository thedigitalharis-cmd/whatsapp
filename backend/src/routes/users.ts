import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../config/database';
import { AuthRequest, requireRole } from '../middleware/auth';

const router = Router();

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      where: { organizationId: req.user!.organizationId },
      select: { id: true, firstName: true, lastName: true, email: true, role: true, isActive: true, avatar: true, team: true, lastLogin: true },
      orderBy: { firstName: 'asc' },
    });
    res.json(users);
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

router.post('/', requireRole('ADMIN', 'SUPER_ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { password, ...data } = req.body;
    const passwordHash = await bcrypt.hash(password || 'TempPass123!', 12);
    const user = await prisma.user.create({
      data: { ...data, organizationId: req.user!.organizationId, passwordHash },
      select: { id: true, firstName: true, lastName: true, email: true, role: true },
    });
    res.status(201).json(user);
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { password, ...data } = req.body;
    const updateData: any = { ...data };
    if (password) updateData.passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: updateData,
      select: { id: true, firstName: true, lastName: true, email: true, role: true, isActive: true },
    });
    res.json(user);
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

router.delete('/:id', requireRole('ADMIN', 'SUPER_ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    await prisma.user.update({ where: { id: req.params.id }, data: { isActive: false } });
    res.json({ message: 'User deactivated' });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

export default router;
