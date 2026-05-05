"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = require("../config/database");
const router = (0, express_1.Router)();
router.get('/', async (req, res) => {
    try {
        const { search, category } = req.query;
        const where = { organizationId: req.user.organizationId };
        if (search)
            where.OR = [
                { title: { contains: search, mode: 'insensitive' } },
                { content: { contains: search, mode: 'insensitive' } },
            ];
        if (category)
            where.category = category;
        const articles = await database_1.prisma.knowledgeBase.findMany({ where, orderBy: { title: 'asc' } });
        res.json(articles);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.post('/', async (req, res) => {
    try {
        const article = await database_1.prisma.knowledgeBase.create({
            data: { ...req.body, organizationId: req.user.organizationId },
        });
        res.status(201).json(article);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.put('/:id', async (req, res) => {
    try {
        const article = await database_1.prisma.knowledgeBase.update({ where: { id: req.params.id }, data: req.body });
        res.json(article);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.delete('/:id', async (req, res) => {
    try {
        await database_1.prisma.knowledgeBase.delete({ where: { id: req.params.id } });
        res.json({ message: 'Deleted' });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
//# sourceMappingURL=knowledgeBase.js.map