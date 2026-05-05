"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = require("../config/database");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.get('/', async (req, res) => {
    try {
        const billing = await database_1.prisma.billingSubscription.findUnique({
            where: { organizationId: req.user.organizationId },
        });
        res.json(billing);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.post('/upgrade', (0, auth_1.requireRole)('ADMIN', 'SUPER_ADMIN'), async (req, res) => {
    try {
        const { plan } = req.body;
        const billing = await database_1.prisma.billingSubscription.upsert({
            where: { organizationId: req.user.organizationId },
            update: { plan },
            create: { organizationId: req.user.organizationId, plan },
        });
        await database_1.prisma.organization.update({
            where: { id: req.user.organizationId },
            data: { plan },
        });
        res.json(billing);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
//# sourceMappingURL=billing.js.map