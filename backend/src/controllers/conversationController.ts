import { Response } from 'express';
import { prisma } from '../config/database';
import { AuthRequest } from '../middleware/auth';

export const getConversations = async (req: AuthRequest, res: Response) => {
  try {
    const { page = 1, limit = 50, status, channel, assigneeId, teamId, search, priority } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const where: any = { organizationId: req.user!.organizationId };

    if (status) where.status = status;
    if (channel) where.channel = channel;
    if (assigneeId) where.agentId = assigneeId;
    if (teamId) where.teamId = teamId;
    if (priority) where.priority = priority;
    if (search) {
      where.OR = [
        { contact: { firstName: { contains: search as string, mode: 'insensitive' } } },
        { contact: { phone: { contains: search as string } } },
        { subject: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const [conversations, total] = await Promise.all([
      prisma.conversation.findMany({
        where, skip, take: Number(limit),
        include: {
          contact: { select: { id: true, firstName: true, lastName: true, phone: true, avatar: true } },
          agent: { select: { id: true, firstName: true, lastName: true, avatar: true } },
          team: { select: { id: true, name: true } },
          tags: true,
          messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
        orderBy: { lastMessageAt: 'desc' },
      }),
      prisma.conversation.count({ where }),
    ]);

    res.json({ data: conversations, total, page: Number(page), limit: Number(limit) });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getConversation = async (req: AuthRequest, res: Response) => {
  try {
    const conversation = await prisma.conversation.findFirst({
      where: { id: req.params.id, organizationId: req.user!.organizationId },
      include: {
        contact: true,
        agent: { select: { id: true, firstName: true, lastName: true, avatar: true } },
        team: true,
        tags: true,
        whatsappAccount: { select: { id: true, name: true, phoneNumber: true } },
        notes: { include: { author: { select: { id: true, firstName: true, lastName: true } } }, orderBy: { createdAt: 'desc' } },
        ticket: true,
      },
    });
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
    res.json(conversation);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const assignConversation = async (req: AuthRequest, res: Response) => {
  try {
    const { agentId, teamId } = req.body;
    const conversation = await prisma.conversation.update({
      where: { id: req.params.id },
      data: { agentId, teamId },
      include: {
        agent: { select: { id: true, firstName: true, lastName: true } },
        team: { select: { id: true, name: true } },
      },
    });

    const io = req.app.get('io');
    io?.to(`conv:${conversation.id}`).emit('conversation:assigned', { agentId, teamId });

    res.json(conversation);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateConversationStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.body;
    const conversation = await prisma.conversation.update({
      where: { id: req.params.id },
      data: {
        status,
        ...(status === 'RESOLVED' && { resolvedAt: new Date() }),
      },
    });

    const io = req.app.get('io');
    io?.to(`org:${req.user!.organizationId}`).emit('conversation:status_changed', { id: conversation.id, status });

    res.json(conversation);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const toggleBot = async (req: AuthRequest, res: Response) => {
  try {
    const { botPaused } = req.body;
    const conversation = await prisma.conversation.update({
      where: { id: req.params.id },
      data: { botPaused },
    });
    res.json(conversation);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getMessages = async (req: AuthRequest, res: Response) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where: { conversationId: req.params.id },
        skip, take: Number(limit),
        include: { sender: { select: { id: true, firstName: true, lastName: true, avatar: true } } },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.message.count({ where: { conversationId: req.params.id } }),
    ]);

    res.json({ data: messages, total });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const sendMessage = async (req: AuthRequest, res: Response) => {
  try {
    const { type = 'TEXT', content, mediaUrl, mediaType, caption, interactive, template, replyToId } = req.body;

    const conversation = await prisma.conversation.findFirst({
      where: { id: req.params.id, organizationId: req.user!.organizationId },
      include: { whatsappAccount: true, contact: true },
    });
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

    const message = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderId: req.user!.id,
        direction: 'OUTBOUND',
        type,
        content,
        mediaUrl,
        mediaType,
        caption,
        interactive,
        template,
        replyToId,
        status: 'SENT',
      },
      include: { sender: { select: { id: true, firstName: true, lastName: true } } },
    });

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date() },
    });

    const io = req.app.get('io');
    io?.to(`conv:${conversation.id}`).emit('message:new', message);
    io?.to(`org:${req.user!.organizationId}`).emit('conversation:updated', { id: conversation.id });

    // TODO: Actually send via WhatsApp API
    res.status(201).json(message);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const addNote = async (req: AuthRequest, res: Response) => {
  try {
    const note = await prisma.note.create({
      data: {
        authorId: req.user!.id,
        conversationId: req.params.id,
        content: req.body.content,
        isInternal: true,
      },
      include: { author: { select: { id: true, firstName: true, lastName: true, avatar: true } } },
    });

    const io = req.app.get('io');
    io?.to(`conv:${req.params.id}`).emit('note:added', note);

    res.status(201).json(note);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
