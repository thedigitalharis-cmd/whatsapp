"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = require("../config/database");
const router = (0, express_1.Router)();
router.get('/', async (req, res) => {
    try {
        const pipelines = await database_1.prisma.pipeline.findMany({
            where: { organizationId: req.user.organizationId },
            include: {
                stages: {
                    orderBy: { order: 'asc' },
                    include: {
                        deals: {
                            where: { status: 'OPEN' },
                            include: { contact: { select: { id: true, firstName: true, lastName: true } }, assignee: { select: { id: true, firstName: true } } },
                        },
                    },
                },
            },
        });
        res.json(pipelines);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.post('/', async (req, res) => {
    try {
        const { stages, ...pipelineData } = req.body;
        const pipeline = await database_1.prisma.pipeline.create({
            data: {
                ...pipelineData,
                organizationId: req.user.organizationId,
                ...(stages && { stages: { create: stages } }),
            },
            include: { stages: { orderBy: { order: 'asc' } } },
        });
        res.status(201).json(pipeline);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.post('/:id/stages', async (req, res) => {
    try {
        const stage = await database_1.prisma.pipelineStage.create({
            data: { ...req.body, pipelineId: req.params.id },
        });
        res.status(201).json(stage);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.put('/stages/:stageId', async (req, res) => {
    try {
        const stage = await database_1.prisma.pipelineStage.update({
            where: { id: req.params.stageId },
            data: req.body,
        });
        res.json(stage);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
//# sourceMappingURL=pipelines.js.map