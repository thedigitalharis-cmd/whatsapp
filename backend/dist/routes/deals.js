"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = require("../config/database");
const router = (0, express_1.Router)();
router.get('/', async (req, res) => {
    try {
        const { page = 1, limit = 50, status, stageId, assigneeId } = req.query;
        const skip = (Number(page) - 1) * Number(limit);
        const where = { organizationId: req.user.organizationId };
        if (status)
            where.status = status;
        if (stageId)
            where.stageId = stageId;
        if (assigneeId)
            where.assigneeId = assigneeId;
        const [deals, total] = await Promise.all([
            database_1.prisma.deal.findMany({
                where, skip, take: Number(limit),
                include: {
                    contact: { select: { id: true, firstName: true, lastName: true, phone: true } },
                    assignee: { select: { id: true, firstName: true, lastName: true } },
                    stage: { include: { pipeline: { select: { id: true, name: true } } } },
                    tags: true,
                },
                orderBy: { createdAt: 'desc' },
            }),
            database_1.prisma.deal.count({ where }),
        ]);
        res.json({ data: deals, total });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.post('/', async (req, res) => {
    try {
        const deal = await database_1.prisma.deal.create({
            data: { ...req.body, organizationId: req.user.organizationId },
            include: { stage: true, contact: true },
        });
        res.status(201).json(deal);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.put('/:id', async (req, res) => {
    try {
        const deal = await database_1.prisma.deal.update({
            where: { id: req.params.id },
            data: req.body,
            include: { stage: true, contact: true },
        });
        res.json(deal);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.patch('/:id/stage', async (req, res) => {
    try {
        const { stageId } = req.body;
        const deal = await database_1.prisma.deal.update({
            where: { id: req.params.id },
            data: { stageId },
            include: { stage: true },
        });
        res.json(deal);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.delete('/:id', async (req, res) => {
    try {
        await database_1.prisma.deal.delete({ where: { id: req.params.id } });
        res.json({ message: 'Deal deleted' });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
//# sourceMappingURL=deals.js.map