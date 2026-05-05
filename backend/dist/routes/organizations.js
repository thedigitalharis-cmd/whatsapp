"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = require("../config/database");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.get('/current', async (req, res) => {
    try {
        const org = await database_1.prisma.organization.findUnique({
            where: { id: req.user.organizationId },
            include: { billingSubscription: true },
        });
        res.json(org);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.put('/current', (0, auth_1.requireRole)('ADMIN', 'SUPER_ADMIN'), async (req, res) => {
    try {
        const org = await database_1.prisma.organization.update({
            where: { id: req.user.organizationId },
            data: req.body,
        });
        res.json(org);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.get('/custom-fields', async (req, res) => {
    try {
        const fields = await database_1.prisma.customField.findMany({
            where: { organizationId: req.user.organizationId },
            orderBy: { entity: 'asc' },
        });
        res.json(fields);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.post('/custom-fields', (0, auth_1.requireRole)('ADMIN', 'SUPER_ADMIN'), async (req, res) => {
    try {
        const field = await database_1.prisma.customField.create({
            data: { ...req.body, organizationId: req.user.organizationId },
        });
        res.status(201).json(field);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
//# sourceMappingURL=organizations.js.map