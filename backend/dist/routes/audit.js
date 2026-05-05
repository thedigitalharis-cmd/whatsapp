"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = require("../config/database");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.get('/', (0, auth_1.requireRole)('ADMIN', 'SUPER_ADMIN'), async (req, res) => {
    try {
        const { page = 1, limit = 50, action, entity, userId } = req.query;
        const skip = (Number(page) - 1) * Number(limit);
        const where = { organizationId: req.user.organizationId };
        if (action)
            where.action = action;
        if (entity)
            where.entity = entity;
        if (userId)
            where.userId = userId;
        const [logs, total] = await Promise.all([
            database_1.prisma.auditLog.findMany({
                where, skip, take: Number(limit),
                include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
                orderBy: { createdAt: 'desc' },
            }),
            database_1.prisma.auditLog.count({ where }),
        ]);
        res.json({ data: logs, total });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
//# sourceMappingURL=audit.js.map