import { Router, Response } from 'express';
import { prisma } from '../config/database';
import { AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const pipelines = await prisma.pipeline.findMany({
      where: { organizationId: req.user!.organizationId },
      include: {
        stages: {
          orderBy: { order: 'asc' },
          include: {
            deals: {
              where: { status: 'OPEN' },
              include: { contact: { select: { id: true, firstName: true, lastName: true } }, assignee: { select: { id: true, firstName: true } } },
            },
          },
        },
      },
    });
    res.json(pipelines);
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { stages, ...pipelineData } = req.body;
    const pipeline = await prisma.pipeline.create({
      data: {
        ...pipelineData,
        organizationId: req.user!.organizationId,
        ...(stages && { stages: { create: stages } }),
      },
      include: { stages: { orderBy: { order: 'asc' } } },
    });
    res.status(201).json(pipeline);
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

router.post('/:id/stages', async (req: AuthRequest, res: Response) => {
  try {
    const stage = await prisma.pipelineStage.create({
      data: { ...req.body, pipelineId: req.params.id },
    });
    res.status(201).json(stage);
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

router.put('/stages/:stageId', async (req: AuthRequest, res: Response) => {
  try {
    const stage = await prisma.pipelineStage.update({
      where: { id: req.params.stageId },
      data: req.body,
    });
    res.json(stage);
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

export default router;
