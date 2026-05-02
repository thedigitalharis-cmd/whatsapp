import { Router, Response } from 'express';
import { prisma } from '../config/database';
import { AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/quick-replies', async (req: AuthRequest, res: Response) => {
  try {
    const replies = await prisma.knowledgeBase.findMany({
      where: { organizationId: req.user!.organizationId, isPublished: true },
      select: { id: true, title: true, content: true, category: true },
      orderBy: { title: 'asc' },
    });
    res.json(replies);
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

export default router;
