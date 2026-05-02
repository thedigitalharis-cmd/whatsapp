import { Response } from 'express';
import { prisma } from '../config/database';
import { AuthRequest } from '../middleware/auth';

export const getContacts = async (req: AuthRequest, res: Response) => {
  try {
    const { page = 1, limit = 50, search, source, groupId, tagId } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = { organizationId: req.user!.organizationId };
    if (search) {
      where.OR = [
        { firstName: { contains: search as string, mode: 'insensitive' } },
        { lastName: { contains: search as string, mode: 'insensitive' } },
        { email: { contains: search as string, mode: 'insensitive' } },
        { phone: { contains: search as string } },
        { company: { contains: search as string, mode: 'insensitive' } },
      ];
    }
    if (source) where.source = source;
    if (groupId) where.groups = { some: { id: groupId } };
    if (tagId) where.tags = { some: { id: tagId } };

    const [contacts, total] = await Promise.all([
      prisma.contact.findMany({
        where, skip, take: Number(limit),
        include: { tags: true, groups: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.contact.count({ where }),
    ]);

    res.json({ data: contacts, total, page: Number(page), limit: Number(limit) });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getContact = async (req: AuthRequest, res: Response) => {
  try {
    const contact = await prisma.contact.findFirst({
      where: { id: req.params.id, organizationId: req.user!.organizationId },
      include: {
        tags: true,
        groups: true,
        leads: { orderBy: { createdAt: 'desc' }, take: 5 },
        deals: { include: { stage: true }, orderBy: { createdAt: 'desc' }, take: 5 },
        conversations: { orderBy: { lastMessageAt: 'desc' }, take: 5 },
        tickets: { orderBy: { createdAt: 'desc' }, take: 5 },
        activities: { orderBy: { createdAt: 'desc' }, take: 10 },
        notes_rel: { orderBy: { createdAt: 'desc' }, take: 10 },
        orders: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
    });
    if (!contact) return res.status(404).json({ error: 'Contact not found' });
    res.json(contact);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createContact = async (req: AuthRequest, res: Response) => {
  try {
    const contact = await prisma.contact.create({
      data: { ...req.body, organizationId: req.user!.organizationId },
      include: { tags: true },
    });
    res.status(201).json(contact);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateContact = async (req: AuthRequest, res: Response) => {
  try {
    const { tags, groups, ...data } = req.body;
    const contact = await prisma.contact.update({
      where: { id: req.params.id },
      data: {
        ...data,
        ...(tags && { tags: { set: tags.map((id: string) => ({ id })) } }),
        ...(groups && { groups: { set: groups.map((id: string) => ({ id })) } }),
      },
      include: { tags: true, groups: true },
    });
    res.json(contact);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteContact = async (req: AuthRequest, res: Response) => {
  try {
    await prisma.contact.delete({ where: { id: req.params.id } });
    res.json({ message: 'Contact deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const bulkImportContacts = async (req: AuthRequest, res: Response) => {
  try {
    const { contacts } = req.body;
    const result = await prisma.contact.createMany({
      data: contacts.map((c: any) => ({ ...c, organizationId: req.user!.organizationId })),
      skipDuplicates: true,
    });
    res.json({ imported: result.count });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const mergeContacts = async (req: AuthRequest, res: Response) => {
  try {
    const { primaryId, duplicateId } = req.body;
    await prisma.contact.update({ where: { id: duplicateId }, data: { mergedIntoId: primaryId } });
    res.json({ message: 'Contacts merged' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getContactGroups = async (req: AuthRequest, res: Response) => {
  try {
    const groups = await prisma.contactGroup.findMany({ orderBy: { name: 'asc' } });
    res.json(groups);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createContactGroup = async (req: AuthRequest, res: Response) => {
  try {
    const group = await prisma.contactGroup.create({ data: req.body });
    res.status(201).json(group);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
