"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = require("../config/database");
const router = (0, express_1.Router)();
router.get('/', async (req, res) => {
    try {
        const { page = 1, limit = 50, status } = req.query;
        const skip = (Number(page) - 1) * Number(limit);
        const where = {};
        if (status)
            where.status = status;
        const [orders, total] = await Promise.all([
            database_1.prisma.order.findMany({
                where, skip, take: Number(limit),
                include: { contact: { select: { id: true, firstName: true, lastName: true, phone: true } }, items: { include: { product: true } } },
                orderBy: { createdAt: 'desc' },
            }),
            database_1.prisma.order.count({ where }),
        ]);
        res.json({ data: orders, total });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.post('/', async (req, res) => {
    try {
        const { items, ...orderData } = req.body;
        const order = await database_1.prisma.order.create({
            data: {
                ...orderData,
                ...(items && { items: { create: items } }),
            },
            include: { items: { include: { product: true } } },
        });
        res.status(201).json(order);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.put('/:id', async (req, res) => {
    try {
        const order = await database_1.prisma.order.update({ where: { id: req.params.id }, data: req.body });
        res.json(order);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
//# sourceMappingURL=orders.js.map