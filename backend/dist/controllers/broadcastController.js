"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBroadcastStats = exports.pauseBroadcast = exports.launchBroadcast = exports.createBroadcast = exports.getBroadcasts = void 0;
const database_1 = require("../config/database");
const whatsappController_1 = require("./whatsappController");
const logger_1 = require("../utils/logger");
const getBroadcasts = async (req, res) => {
    try {
        const { page = 1, limit = 20, status } = req.query;
        const skip = (Number(page) - 1) * Number(limit);
        const where = { organizationId: req.user.organizationId };
        if (status)
            where.status = status;
        const [broadcasts, total] = await Promise.all([
            database_1.prisma.broadcast.findMany({
                where, skip, take: Number(limit),
                include: { template: { select: { id: true, name: true } }, whatsappAccount: { select: { id: true, name: true } } },
                orderBy: { createdAt: 'desc' },
            }),
            database_1.prisma.broadcast.count({ where }),
        ]);
        res.json({ data: broadcasts, total });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.getBroadcasts = getBroadcasts;
const createBroadcast = async (req, res) => {
    try {
        const broadcast = await database_1.prisma.broadcast.create({
            data: { ...req.body, organizationId: req.user.organizationId, status: 'DRAFT' },
        });
        res.status(201).json(broadcast);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.createBroadcast = createBroadcast;
const launchBroadcast = async (req, res) => {
    try {
        const broadcast = await database_1.prisma.broadcast.findFirst({
            where: { id: req.params.id, organizationId: req.user.organizationId },
            include: { template: true, whatsappAccount: true, recipients: { include: { broadcast: false } } },
        });
        if (!broadcast)
            return res.status(404).json({ error: 'Broadcast not found' });
        if (broadcast.status !== 'DRAFT' && broadcast.status !== 'SCHEDULED') {
            return res.status(400).json({ error: 'Broadcast already launched' });
        }
        // Build recipients from segment filter
        let contactIds = [];
        if (broadcast.segmentFilter) {
            const filter = broadcast.segmentFilter;
            const contacts = await database_1.prisma.contact.findMany({
                where: { organizationId: req.user.organizationId, whatsappOptIn: true, ...filter },
                select: { id: true },
            });
            contactIds = contacts.map(c => c.id);
        }
        // Create recipient records
        if (contactIds.length > 0) {
            await database_1.prisma.broadcastRecipient.createMany({
                data: contactIds.map(contactId => ({ broadcastId: broadcast.id, contactId })),
                skipDuplicates: true,
            });
        }
        await database_1.prisma.broadcast.update({
            where: { id: broadcast.id },
            data: { status: 'RUNNING', sentAt: new Date(), totalRecipients: contactIds.length },
        });
        // Process in background
        processBroadcast(broadcast.id).catch(err => logger_1.logger.error('Broadcast processing error', err));
        res.json({ message: 'Broadcast launched', totalRecipients: contactIds.length });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.launchBroadcast = launchBroadcast;
const processBroadcast = async (broadcastId) => {
    const broadcast = await database_1.prisma.broadcast.findUnique({
        where: { id: broadcastId },
        include: { whatsappAccount: true, template: true, recipients: { include: { broadcast: false } } },
    });
    if (!broadcast)
        return;
    for (const recipient of broadcast.recipients) {
        try {
            const contact = await database_1.prisma.contact.findUnique({ where: { id: recipient.contactId } });
            if (!contact)
                continue;
            await (0, whatsappController_1.sendWhatsAppMessage)(broadcast.whatsappAccount.phoneNumberId, broadcast.whatsappAccount.accessToken, contact.phone, {
                type: 'template',
                template: {
                    name: broadcast.template?.name || '',
                    language: { code: broadcast.template?.language || 'en_US' },
                    components: broadcast.variables ? [{ type: 'body', parameters: broadcast.variables }] : [],
                },
            });
            await database_1.prisma.broadcastRecipient.update({
                where: { id: recipient.id },
                data: { status: 'SENT', sentAt: new Date() },
            });
            await database_1.prisma.broadcast.update({
                where: { id: broadcastId },
                data: { sentCount: { increment: 1 } },
            });
            // Rate limiting: 80 messages per second for Cloud API
            await new Promise(resolve => setTimeout(resolve, 13));
        }
        catch (err) {
            await database_1.prisma.broadcastRecipient.update({
                where: { id: recipient.id },
                data: { status: 'FAILED', failedAt: new Date() },
            });
            await database_1.prisma.broadcast.update({
                where: { id: broadcastId },
                data: { failedCount: { increment: 1 } },
            });
        }
    }
    await database_1.prisma.broadcast.update({
        where: { id: broadcastId },
        data: { status: 'COMPLETED', completedAt: new Date() },
    });
};
const pauseBroadcast = async (req, res) => {
    try {
        const broadcast = await database_1.prisma.broadcast.update({
            where: { id: req.params.id },
            data: { status: 'PAUSED' },
        });
        res.json(broadcast);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.pauseBroadcast = pauseBroadcast;
const getBroadcastStats = async (req, res) => {
    try {
        const broadcast = await database_1.prisma.broadcast.findFirst({
            where: { id: req.params.id, organizationId: req.user.organizationId },
        });
        if (!broadcast)
            return res.status(404).json({ error: 'Not found' });
        const stats = {
            total: broadcast.totalRecipients,
            sent: broadcast.sentCount,
            delivered: broadcast.deliveredCount,
            read: broadcast.readCount,
            failed: broadcast.failedCount,
            optOut: broadcast.optOutCount,
            deliveryRate: broadcast.sentCount ? ((broadcast.deliveredCount / broadcast.sentCount) * 100).toFixed(1) : 0,
            readRate: broadcast.deliveredCount ? ((broadcast.readCount / broadcast.deliveredCount) * 100).toFixed(1) : 0,
        };
        res.json(stats);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.getBroadcastStats = getBroadcastStats;
//# sourceMappingURL=broadcastController.js.map