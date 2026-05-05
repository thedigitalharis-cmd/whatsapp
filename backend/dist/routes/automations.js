"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = require("../config/database");
const router = (0, express_1.Router)();
router.get('/', async (req, res) => {
    try {
        const automations = await database_1.prisma.automation.findMany({
            where: { organizationId: req.user.organizationId },
            orderBy: { createdAt: 'desc' },
        });
        res.json(automations);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.post('/', async (req, res) => {
    try {
        const automation = await database_1.prisma.automation.create({
            data: { ...req.body, organizationId: req.user.organizationId },
        });
        res.status(201).json(automation);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.get('/:id', async (req, res) => {
    try {
        const automation = await database_1.prisma.automation.findFirst({
            where: { id: req.params.id, organizationId: req.user.organizationId },
        });
        if (!automation)
            return res.status(404).json({ error: 'Not found' });
        res.json(automation);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.put('/:id', async (req, res) => {
    try {
        const automation = await database_1.prisma.automation.update({
            where: { id: req.params.id },
            data: req.body,
        });
        res.json(automation);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.patch('/:id/toggle', async (req, res) => {
    try {
        const current = await database_1.prisma.automation.findUnique({ where: { id: req.params.id } });
        const automation = await database_1.prisma.automation.update({
            where: { id: req.params.id },
            data: { status: current?.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE' },
        });
        res.json(automation);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.delete('/:id', async (req, res) => {
    try {
        await database_1.prisma.automation.delete({ where: { id: req.params.id } });
        res.json({ message: 'Deleted' });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
//# sourceMappingURL=automations.js.map