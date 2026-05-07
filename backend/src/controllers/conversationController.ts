import { Response } from 'express';
import { prisma } from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { sendWhatsAppMessage } from './whatsappController';
import { logger } from '../utils/logger';

export const getConversations = async (req: AuthRequest, res: Response) => {
  try {
    const { page = 1, limit = 50, status, channel, assigneeId, teamId, search, priority, archived } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    // Default: show non-archived; if archived=true show only archived
    const where: any = {
      organizationId: req.user!.organizationId,
      isArchived: archived === 'true' ? true : false,
    };

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
        ...(status === 'OPEN' && { resolvedAt: null }),
      },
    });

    const io = req.app.get('io');
    io?.to(`org:${req.user!.organizationId}`).emit('conversation:status_changed', { id: conversation.id, status });

    res.json(conversation);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const archiveConversation = async (req: AuthRequest, res: Response) => {
  try {
    const conversation = await prisma.conversation.update({
      where: { id: req.params.id },
      data: { isArchived: true, archivedAt: new Date(), status: 'RESOLVED' },
    });

    const io = req.app.get('io');
    io?.to(`org:${req.user!.organizationId}`).emit('conversation:archived', { id: conversation.id });

    res.json(conversation);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const unarchiveConversation = async (req: AuthRequest, res: Response) => {
  try {
    const conversation = await prisma.conversation.update({
      where: { id: req.params.id },
      data: { isArchived: false, archivedAt: null, status: 'OPEN' },
    });
    res.json(conversation);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteConversation = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id;
    // Cascade delete in correct order
    await prisma.message.deleteMany({ where: { conversationId: id } });
    await prisma.note.deleteMany({ where: { conversationId: id } });
    // Remove tag connections
    await prisma.conversation.update({ where: { id }, data: { tags: { set: [] } } });
    // Delete ticket if linked
    await prisma.ticket.deleteMany({ where: { conversationId: id } });
    await prisma.followUp.updateMany({ where: { conversationId: id }, data: { conversationId: null } });
    await prisma.conversation.delete({ where: { id } });

    res.json({ message: 'Conversation deleted' });
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
    const { type = 'TEXT', content, mediaUrl, mediaType, mediaId, caption, interactive, template, replyToId } = req.body;

    const conversation = await prisma.conversation.findFirst({
      where: { id: req.params.id, organizationId: req.user!.organizationId },
      include: { whatsappAccount: true, contact: true },
    });
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

    // Build WhatsApp API payload based on message type
    let waPayload: any = { type };
    if (type === 'TEXT' || type === 'text') {
      waPayload = { type: 'text', text: { body: content || '' } };
    } else if (type === 'IMAGE') {
      waPayload = { type: 'image', image: { link: mediaUrl, ...(caption && { caption }) } };
    } else if (type === 'DOCUMENT') {
      waPayload = { type: 'document', document: { link: mediaUrl, filename: caption || 'file' } };
    } else if (type === 'AUDIO') {
      if (mediaId) {
        waPayload = { type: 'audio', audio: { id: mediaId } };
      } else if (mediaUrl) {
        // WhatsApp accepts audio via public URL link
        waPayload = { type: 'audio', audio: { link: mediaUrl } };
      }
    } else if (type === 'VIDEO') {
      waPayload = { type: 'video', video: { link: mediaUrl, ...(caption && { caption }) } };
    } else if (type === 'LOCATION') {
      waPayload = { type: 'location', location: interactive };
    } else if (type === 'INTERACTIVE') {
      waPayload = { type: 'interactive', interactive };
    } else if (type === 'TEMPLATE') {
      waPayload = { type: 'template', template };
    }

    // Send via Meta API and capture the WhatsApp message ID
    let waMessageId: string | undefined;
    let sendStatus: 'SENT' | 'FAILED' = 'SENT';
    let errorMessage: string | undefined;

    try {
      const waResult = await sendWhatsAppMessage(
        conversation.whatsappAccount.phoneNumberId,
        conversation.whatsappAccount.accessToken,
        conversation.contact.phone,
        waPayload
      );
      waMessageId = waResult?.messages?.[0]?.id;
    } catch (err: any) {
      logger.error('WhatsApp send failed', {
        err: err.message,
        conversationId: conversation.id,
        msgType: type,
      });
      sendStatus = 'FAILED';
      errorMessage = err.message;
    }

    const message = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderId: req.user!.id,
        direction: 'OUTBOUND',
        type: type as any,
        content,
        mediaUrl,
        mediaType,
        caption,
        interactive,
        template,
        replyToId,
        status: sendStatus,
        waMessageId,
        errorMessage,
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

    if (sendStatus === 'FAILED') {
      return res.status(201).json({ ...message, warning: `Saved but WhatsApp send failed: ${errorMessage}` });
    }

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
