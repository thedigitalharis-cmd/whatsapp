"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = require("../config/database");
const router = (0, express_1.Router)();
router.get('/', async (req, res) => {
    try {
        const templates = await database_1.prisma.messageTemplate.findMany({
            where: { organizationId: req.user.organizationId },
            orderBy: { createdAt: 'desc' },
        });
        res.json(templates);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.post('/', async (req, res) => {
    try {
        const template = await database_1.prisma.messageTemplate.create({
            data: { ...req.body, organizationId: req.user.organizationId },
        });
        res.status(201).json(template);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.put('/:id', async (req, res) => {
    try {
        const template = await database_1.prisma.messageTemplate.update({ where: { id: req.params.id }, data: req.body });
        res.json(template);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.delete('/:id', async (req, res) => {
    try {
        await database_1.prisma.messageTemplate.delete({ where: { id: req.params.id } });
        res.json({ message: 'Deleted' });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
//# sourceMappingURL=templates.js.map