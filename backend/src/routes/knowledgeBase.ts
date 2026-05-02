import { Router, Response } from 'express';
import { prisma } from '../config/database';
import { AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { search, category } = req.query;
    const where: any = { organizationId: req.user!.organizationId };
    if (search) where.OR = [
      { title: { contains: search as string, mode: 'insensitive' } },
      { content: { contains: search as string, mode: 'insensitive' } },
    ];
    if (category) where.category = category;

    const articles = await prisma.knowledgeBase.findMany({ where, orderBy: { title: 'asc' } });
    res.json(articles);
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const article = await prisma.knowledgeBase.create({
      data: { ...req.body, organizationId: req.user!.organizationId },
    });
    res.status(201).json(article);
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const article = await prisma.knowledgeBase.update({ where: { id: req.params.id }, data: req.body });
    res.json(article);
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    await prisma.knowledgeBase.delete({ where: { id: req.params.id } });
    res.json({ message: 'Deleted' });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

export default router;
