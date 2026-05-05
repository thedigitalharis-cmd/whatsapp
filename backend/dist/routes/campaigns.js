"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = require("../config/database");
const router = (0, express_1.Router)();
router.get('/', async (req, res) => {
    try {
        const campaigns = await database_1.prisma.campaign.findMany({
            where: { organizationId: req.user.organizationId },
            include: { steps: { orderBy: { order: 'asc' } } },
            orderBy: { createdAt: 'desc' },
        });
        res.json(campaigns);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.post('/', async (req, res) => {
    try {
        const { steps, ...data } = req.body;
        const campaign = await database_1.prisma.campaign.create({
            data: {
                ...data,
                organizationId: req.user.organizationId,
                ...(steps && { steps: { create: steps } }),
            },
            include: { steps: { orderBy: { order: 'asc' } } },
        });
        res.status(201).json(campaign);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.put('/:id', async (req, res) => {
    try {
        const campaign = await database_1.prisma.campaign.update({
            where: { id: req.params.id },
            data: req.body,
            include: { steps: { orderBy: { order: 'asc' } } },
        });
        res.json(campaign);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.delete('/:id', async (req, res) => {
    try {
        await database_1.prisma.campaign.delete({ where: { id: req.params.id } });
        res.json({ message: 'Deleted' });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
//# sourceMappingURL=campaigns.js.map