import { Response } from 'express';
import { prisma } from '../config/database';
import { AuthRequest } from '../middleware/auth';

export const getLeads = async (req: AuthRequest, res: Response) => {
  try {
    const { page = 1, limit = 50, search, status, source, assigneeId, minScore, maxScore } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const where: any = { organizationId: req.user!.organizationId };

    if (search) {
      where.OR = [
        { title: { contains: search as string, mode: 'insensitive' } },
        { contact: { firstName: { contains: search as string, mode: 'insensitive' } } },
        { contact: { phone: { contains: search as string } } },
      ];
    }
    if (status) where.status = status;
    if (source) where.source = source;
    if (assigneeId) where.assigneeId = assigneeId;
    if (minScore) where.score = { gte: Number(minScore) };
    if (maxScore) where.score = { ...where.score, lte: Number(maxScore) };

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where, skip, take: Number(limit),
        include: {
          contact: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
          assignee: { select: { id: true, firstName: true, lastName: true, avatar: true } },
          tags: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.lead.count({ where }),
    ]);

    res.json({ data: leads, total, page: Number(page), limit: Number(limit) });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getLead = async (req: AuthRequest, res: Response) => {
  try {
    const lead = await prisma.lead.findFirst({
      where: { id: req.params.id, organizationId: req.user!.organizationId },
      include: {
        contact: true,
        assignee: { select: { id: true, firstName: true, lastName: true, avatar: true } },
        tags: true,
        activities: { orderBy: { createdAt: 'desc' }, take: 20 },
        notes_rel: { include: { author: { select: { id: true, firstName: true, lastName: true } } }, orderBy: { createdAt: 'desc' } },
      },
    });
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    res.json(lead);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createLead = async (req: AuthRequest, res: Response) => {
  try {
    const { tags, ...data } = req.body;
    const lead = await prisma.lead.create({
      data: {
        ...data,
        organizationId: req.user!.organizationId,
        ...(tags && { tags: { connect: tags.map((id: string) => ({ id })) } }),
      },
      include: { contact: true, assignee: { select: { id: true, firstName: true, lastName: true } }, tags: true },
    });

    await prisma.activity.create({
      data: {
        userId: req.user!.id,
        leadId: lead.id,
        type: 'STATUS_CHANGE',
        description: `Lead created: ${lead.title}`,
      },
    });

    res.status(201).json(lead);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateLead = async (req: AuthRequest, res: Response) => {
  try {
    const { tags, ...data } = req.body;
    const lead = await prisma.lead.update({
      where: { id: req.params.id },
      data: {
        ...data,
        ...(tags && { tags: { set: tags.map((id: string) => ({ id })) } }),
      },
      include: { contact: true, assignee: { select: { id: true, firstName: true, lastName: true } }, tags: true },
    });
    res.json(lead);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const convertLead = async (req: AuthRequest, res: Response) => {
  try {
    const { stageId, value } = req.body;
    const lead = await prisma.lead.findFirst({
      where: { id: req.params.id, organizationId: req.user!.organizationId },
      include: { contact: true },
    });
    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    const deal = await prisma.deal.create({
      data: {
        organizationId: req.user!.organizationId,
        contactId: lead.contactId,
        assigneeId: lead.assigneeId,
        stageId,
        title: lead.title,
        value: value || 0,
      },
    });

    await prisma.lead.update({
      where: { id: lead.id },
      data: { status: 'CONVERTED', convertedAt: new Date(), convertedDealId: deal.id },
    });

    res.json({ deal, lead: { ...lead, status: 'CONVERTED' } });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const bulkAssignLeads = async (req: AuthRequest, res: Response) => {
  try {
    const { leadIds, assigneeId } = req.body;
    await prisma.lead.updateMany({
      where: { id: { in: leadIds }, organizationId: req.user!.organizationId },
      data: { assigneeId },
    });
    res.json({ updated: leadIds.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
