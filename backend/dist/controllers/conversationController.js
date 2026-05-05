"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addNote = exports.sendMessage = exports.getMessages = exports.toggleBot = exports.updateConversationStatus = exports.assignConversation = exports.getConversation = exports.getConversations = void 0;
const database_1 = require("../config/database");
const whatsappController_1 = require("./whatsappController");
const logger_1 = require("../utils/logger");
const getConversations = async (req, res) => {
    try {
        const { page = 1, limit = 50, status, channel, assigneeId, teamId, search, priority } = req.query;
        const skip = (Number(page) - 1) * Number(limit);
        const where = { organizationId: req.user.organizationId };
        if (status)
            where.status = status;
        if (channel)
            where.channel = channel;
        if (assigneeId)
            where.agentId = assigneeId;
        if (teamId)
            where.teamId = teamId;
        if (priority)
            where.priority = priority;
        if (search) {
            where.OR = [
                { contact: { firstName: { contains: search, mode: 'insensitive' } } },
                { contact: { phone: { contains: search } } },
                { subject: { contains: search, mode: 'insensitive' } },
            ];
        }
        const [conversations, total] = await Promise.all([
            database_1.prisma.conversation.findMany({
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
            database_1.prisma.conversation.count({ where }),
        ]);
        res.json({ data: conversations, total, page: Number(page), limit: Number(limit) });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.getConversations = getConversations;
const getConversation = async (req, res) => {
    try {
        const conversation = await database_1.prisma.conversation.findFirst({
            where: { id: req.params.id, organizationId: req.user.organizationId },
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
        if (!conversation)
            return res.status(404).json({ error: 'Conversation not found' });
        res.json(conversation);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.getConversation = getConversation;
const assignConversation = async (req, res) => {
    try {
        const { agentId, teamId } = req.body;
        const conversation = await database_1.prisma.conversation.update({
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
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.assignConversation = assignConversation;
const updateConversationStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const conversation = await database_1.prisma.conversation.update({
            where: { id: req.params.id },
            data: {
                status,
                ...(status === 'RESOLVED' && { resolvedAt: new Date() }),
            },
        });
        const io = req.app.get('io');
        io?.to(`org:${req.user.organizationId}`).emit('conversation:status_changed', { id: conversation.id, status });
        res.json(conversation);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.updateConversationStatus = updateConversationStatus;
const toggleBot = async (req, res) => {
    try {
        const { botPaused } = req.body;
        const conversation = await database_1.prisma.conversation.update({
            where: { id: req.params.id },
            data: { botPaused },
        });
        res.json(conversation);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.toggleBot = toggleBot;
const getMessages = async (req, res) => {
    try {
        const { page = 1, limit = 50 } = req.query;
        const skip = (Number(page) - 1) * Number(limit);
        const [messages, total] = await Promise.all([
            database_1.prisma.message.findMany({
                where: { conversationId: req.params.id },
                skip, take: Number(limit),
                include: { sender: { select: { id: true, firstName: true, lastName: true, avatar: true } } },
                orderBy: { createdAt: 'asc' },
            }),
            database_1.prisma.message.count({ where: { conversationId: req.params.id } }),
        ]);
        res.json({ data: messages, total });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.getMessages = getMessages;
const sendMessage = async (req, res) => {
    try {
        const { type = 'TEXT', content, mediaUrl, mediaType, caption, interactive, template, replyToId } = req.body;
        const conversation = await database_1.prisma.conversation.findFirst({
            where: { id: req.params.id, organizationId: req.user.organizationId },
            include: { whatsappAccount: true, contact: true },
        });
        if (!conversation)
            return res.status(404).json({ error: 'Conversation not found' });
        // Build WhatsApp API payload based on message type
        let waPayload = { type };
        if (type === 'TEXT' || type === 'text') {
            waPayload = { type: 'text', text: { body: content || '' } };
        }
        else if (type === 'IMAGE') {
            waPayload = { type: 'image', image: { link: mediaUrl, ...(caption && { caption }) } };
        }
        else if (type === 'DOCUMENT') {
            waPayload = { type: 'document', document: { link: mediaUrl, filename: caption || 'file' } };
        }
        else if (type === 'AUDIO') {
            waPayload = { type: 'audio', audio: { link: mediaUrl } };
        }
        else if (type === 'VIDEO') {
            waPayload = { type: 'video', video: { link: mediaUrl, ...(caption && { caption }) } };
        }
        else if (type === 'LOCATION') {
            waPayload = { type: 'location', location: interactive };
        }
        else if (type === 'INTERACTIVE') {
            waPayload = { type: 'interactive', interactive };
        }
        else if (type === 'TEMPLATE') {
            waPayload = { type: 'template', template };
        }
        // Send via Meta API and capture the WhatsApp message ID
        let waMessageId;
        let sendStatus = 'SENT';
        let errorMessage;
        try {
            const waResult = await (0, whatsappController_1.sendWhatsAppMessage)(conversation.whatsappAccount.phoneNumberId, conversation.whatsappAccount.accessToken, conversation.contact.phone, waPayload);
            waMessageId = waResult?.messages?.[0]?.id;
        }
        catch (err) {
            logger_1.logger.error('WhatsApp send error', { err: err.message });
            sendStatus = 'FAILED';
            errorMessage = err.message;
        }
        const message = await database_1.prisma.message.create({
            data: {
                conversationId: conversation.id,
                senderId: req.user.id,
                direction: 'OUTBOUND',
                type: type,
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
        await database_1.prisma.conversation.update({
            where: { id: conversation.id },
            data: { lastMessageAt: new Date() },
        });
        const io = req.app.get('io');
        io?.to(`conv:${conversation.id}`).emit('message:new', message);
        io?.to(`org:${req.user.organizationId}`).emit('conversation:updated', { id: conversation.id });
        if (sendStatus === 'FAILED') {
            return res.status(201).json({ ...message, warning: `Saved but WhatsApp send failed: ${errorMessage}` });
        }
        res.status(201).json(message);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.sendMessage = sendMessage;
const addNote = async (req, res) => {
    try {
        const note = await database_1.prisma.note.create({
            data: {
                authorId: req.user.id,
                conversationId: req.params.id,
                content: req.body.content,
                isInternal: true,
            },
            include: { author: { select: { id: true, firstName: true, lastName: true, avatar: true } } },
        });
        const io = req.app.get('io');
        io?.to(`conv:${req.params.id}`).emit('note:added', note);
        res.status(201).json(note);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.addNote = addNote;
//# sourceMappingURL=conversationController.js.map