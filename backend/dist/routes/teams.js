"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = require("../config/database");
const router = (0, express_1.Router)();
router.get('/', async (req, res) => {
    try {
        const teams = await database_1.prisma.team.findMany({
            where: { organizationId: req.user.organizationId },
            include: { users: { select: { id: true, firstName: true, lastName: true, avatar: true } } },
        });
        res.json(teams);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.post('/', async (req, res) => {
    try {
        const team = await database_1.prisma.team.create({ data: { ...req.body, organizationId: req.user.organizationId } });
        res.status(201).json(team);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.put('/:id', async (req, res) => {
    try {
        const team = await database_1.prisma.team.update({ where: { id: req.params.id }, data: req.body });
        res.json(team);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.delete('/:id', async (req, res) => {
    try {
        await database_1.prisma.team.delete({ where: { id: req.params.id } });
        res.json({ message: 'Deleted' });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
//# sourceMappingURL=teams.js.map