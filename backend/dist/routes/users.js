"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const database_1 = require("../config/database");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.get('/', async (req, res) => {
    try {
        const users = await database_1.prisma.user.findMany({
            where: { organizationId: req.user.organizationId },
            select: { id: true, firstName: true, lastName: true, email: true, role: true, isActive: true, avatar: true, team: true, lastLogin: true },
            orderBy: { firstName: 'asc' },
        });
        res.json(users);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.post('/', (0, auth_1.requireRole)('ADMIN', 'SUPER_ADMIN'), async (req, res) => {
    try {
        const { password, ...data } = req.body;
        const passwordHash = await bcryptjs_1.default.hash(password || 'TempPass123!', 12);
        const user = await database_1.prisma.user.create({
            data: { ...data, organizationId: req.user.organizationId, passwordHash },
            select: { id: true, firstName: true, lastName: true, email: true, role: true },
        });
        res.status(201).json(user);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.put('/:id', async (req, res) => {
    try {
        const { password, ...data } = req.body;
        const updateData = { ...data };
        if (password)
            updateData.passwordHash = await bcryptjs_1.default.hash(password, 12);
        const user = await database_1.prisma.user.update({
            where: { id: req.params.id },
            data: updateData,
            select: { id: true, firstName: true, lastName: true, email: true, role: true, isActive: true },
        });
        res.json(user);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.delete('/:id', (0, auth_1.requireRole)('ADMIN', 'SUPER_ADMIN'), async (req, res) => {
    try {
        await database_1.prisma.user.update({ where: { id: req.params.id }, data: { isActive: false } });
        res.json({ message: 'User deactivated' });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
//# sourceMappingURL=users.js.map