"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = require("../config/database");
const router = (0, express_1.Router)();
// List follow-ups for org
router.get('/', async (req, res) => {
    try {
        const { status, contactId, conversationId, from, to } = req.query;
        const where = { organizationId: req.user.organizationId };
        if (status)
            where.status = status;
        if (contactId)
            where.contactId = contactId;
        if (conversationId)
            where.conversationId = conversationId;
        if (from || to) {
            where.scheduledAt = {};
            if (from)
                where.scheduledAt.gte = new Date(from);
            if (to)
                where.scheduledAt.lte = new Date(to);
        }
        const followUps = await database_1.prisma.followUp.findMany({
            where,
            include: {
                contact: { select: { id: true, firstName: true, lastName: true, phone: true } },
                conversation: { select: { id: true, status: true } },
                createdBy: { select: { id: true, firstName: true, lastName: true } },
            },
            orderBy: { scheduledAt: 'asc' },
        });
        res.json(followUps);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// Create follow-up
router.post('/', async (req, res) => {
    try {
        const { title, message, scheduledAt, contactId, conversationId, type = 'MANUAL', recurringDays, notes, } = req.body;
        if (!message)
            return res.status(400).json({ error: 'Message is required' });
        if (!scheduledAt)
            return res.status(400).json({ error: 'Scheduled time is required' });
        if (!contactId && !conversationId)
            return res.status(400).json({ error: 'Contact or conversation is required' });
        // If conversationId given but no contactId, get it from conversation
        let resolvedContactId = contactId;
        if (!resolvedContactId && conversationId) {
            const conv = await database_1.prisma.conversation.findUnique({ where: { id: conversationId } });
            resolvedContactId = conv?.contactId;
        }
        const followUp = await database_1.prisma.followUp.create({
            data: {
                organizationId: req.user.organizationId,
                createdById: req.user.id,
                title: title || `Follow-up on ${new Date(scheduledAt).toLocaleDateString()}`,
                message,
                scheduledAt: new Date(scheduledAt),
                contactId: resolvedContactId,
                conversationId,
                type,
                recurringDays,
                notes,
                status: 'PENDING',
            },
            include: {
                contact: { select: { id: true, firstName: true, lastName: true, phone: true } },
                createdBy: { select: { id: true, firstName: true, lastName: true } },
            },
        });
        res.status(201).json(followUp);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// Update follow-up
router.put('/:id', async (req, res) => {
    try {
        const followUp = await database_1.prisma.followUp.update({
            where: { id: req.params.id },
            data: req.body,
        });
        res.json(followUp);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// Cancel follow-up
router.patch('/:id/cancel', async (req, res) => {
    try {
        const followUp = await database_1.prisma.followUp.update({
            where: { id: req.params.id },
            data: { status: 'CANCELLED' },
        });
        res.json(followUp);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// Send now (immediate trigger — bypasses scheduler)
router.post('/:id/send-now', async (req, res) => {
    try {
        const followUp = await database_1.prisma.followUp.findFirst({
            where: { id: req.params.id, organizationId: req.user.organizationId },
            include: {
                contact: true,
                conversation: { include: { whatsappAccount: true } },
                organization: { include: { whatsappAccounts: { where: { status: 'ACTIVE' }, take: 1 } } },
            },
        });
        if (!followUp)
            return res.status(404).json({ error: 'Not found' });
        if (followUp.status !== 'PENDING')
            return res.status(400).json({ error: 'Only PENDING follow-ups can be sent' });
        const waAccount = followUp.conversation?.whatsappAccount
            || followUp.organization?.whatsappAccounts?.[0];
        if (!waAccount || !followUp.contact?.phone) {
            return res.status(400).json({ error: 'No WhatsApp account or contact phone' });
        }
        const { sendText } = await Promise.resolve().then(() => __importStar(require('../services/whatsappService')));
        const toPhone = followUp.contact.phone.replace(/[\s\-\(\)]/g, '').replace(/^\+/, '');
        const result = await sendText(waAccount.phoneNumberId, waAccount.accessToken, toPhone, followUp.message);
        const waMessageId = result?.messages?.[0]?.id;
        await database_1.prisma.followUp.update({
            where: { id: followUp.id },
            data: { status: 'SENT', sentAt: new Date(), waMessageId },
        });
        if (followUp.conversationId) {
            await database_1.prisma.message.create({
                data: {
                    conversationId: followUp.conversationId,
                    direction: 'OUTBOUND',
                    type: 'TEXT',
                    content: `🔔 [Follow-up] ${followUp.message}`,
                    status: 'SENT',
                    waMessageId,
                },
            });
            await database_1.prisma.conversation.update({ where: { id: followUp.conversationId }, data: { lastMessageAt: new Date() } });
        }
        res.json({ message: 'Sent!', waMessageId });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// Delete
router.delete('/:id', async (req, res) => {
    try {
        await database_1.prisma.followUp.delete({ where: { id: req.params.id } });
        res.json({ message: 'Deleted' });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
exports.default = router;
//# sourceMappingURL=followUps.js.map