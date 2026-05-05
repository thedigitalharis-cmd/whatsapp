"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = require("../config/database");
const router = (0, express_1.Router)();
router.get('/quick-replies', async (req, res) => {
    try {
        const replies = await database_1.prisma.knowledgeBase.findMany({
            where: { organizationId: req.user.organizationId, isPublished: true },
            select: { id: true, title: true, content: true, category: true },
            orderBy: { title: 'asc' },
        });
        res.json(replies);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
//# sourceMappingURL=messages.js.map