"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = require("../config/database");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.get('/', async (req, res) => {
    try {
        const integrations = await database_1.prisma.integration.findMany({
            where: { organizationId: req.user.organizationId },
        });
        res.json(integrations);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.post('/', (0, auth_1.requireRole)('ADMIN', 'SUPER_ADMIN'), async (req, res) => {
    try {
        const integration = await database_1.prisma.integration.upsert({
            where: { organizationId_type: { organizationId: req.user.organizationId, type: req.body.type } },
            update: req.body,
            create: { ...req.body, organizationId: req.user.organizationId },
        });
        res.json(integration);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.delete('/:id', (0, auth_1.requireRole)('ADMIN', 'SUPER_ADMIN'), async (req, res) => {
    try {
        await database_1.prisma.integration.delete({ where: { id: req.params.id } });
        res.json({ message: 'Deleted' });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
//# sourceMappingURL=integrations.js.map