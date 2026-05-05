"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = require("../config/database");
const router = (0, express_1.Router)();
router.get('/', async (req, res) => {
    try {
        const { page = 1, limit = 50, status, priority, assigneeId } = req.query;
        const skip = (Number(page) - 1) * Number(limit);
        const where = { organizationId: req.user.organizationId };
        if (status)
            where.status = status;
        if (priority)
            where.priority = priority;
        if (assigneeId)
            where.assigneeId = assigneeId;
        const [tickets, total] = await Promise.all([
            database_1.prisma.ticket.findMany({
                where, skip, take: Number(limit),
                include: {
                    contact: { select: { id: true, firstName: true, lastName: true, phone: true } },
                    assignee: { select: { id: true, firstName: true, lastName: true } },
                },
                orderBy: { createdAt: 'desc' },
            }),
            database_1.prisma.ticket.count({ where }),
        ]);
        res.json({ data: tickets, total });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.post('/', async (req, res) => {
    try {
        const ticket = await database_1.prisma.ticket.create({
            data: { ...req.body, organizationId: req.user.organizationId },
            include: { contact: true },
        });
        res.status(201).json(ticket);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.put('/:id', async (req, res) => {
    try {
        const ticket = await database_1.prisma.ticket.update({ where: { id: req.params.id }, data: req.body });
        res.json(ticket);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.post('/:id/csat', async (req, res) => {
    try {
        const { csatScore, npsScore } = req.body;
        const ticket = await database_1.prisma.ticket.update({
            where: { id: req.params.id },
            data: { csatScore, npsScore },
        });
        res.json(ticket);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
//# sourceMappingURL=tickets.js.map