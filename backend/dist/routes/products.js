"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = require("../config/database");
const router = (0, express_1.Router)();
router.get('/', async (req, res) => {
    try {
        const { page = 1, limit = 50, search } = req.query;
        const skip = (Number(page) - 1) * Number(limit);
        const where = { organizationId: req.user.organizationId };
        if (search)
            where.name = { contains: search, mode: 'insensitive' };
        const [products, total] = await Promise.all([
            database_1.prisma.product.findMany({ where, skip, take: Number(limit), orderBy: { name: 'asc' } }),
            database_1.prisma.product.count({ where }),
        ]);
        res.json({ data: products, total });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.post('/', async (req, res) => {
    try {
        const product = await database_1.prisma.product.create({ data: { ...req.body, organizationId: req.user.organizationId } });
        res.status(201).json(product);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.put('/:id', async (req, res) => {
    try {
        const product = await database_1.prisma.product.update({ where: { id: req.params.id }, data: req.body });
        res.json(product);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.delete('/:id', async (req, res) => {
    try {
        await database_1.prisma.product.delete({ where: { id: req.params.id } });
        res.json({ message: 'Deleted' });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
//# sourceMappingURL=products.js.map