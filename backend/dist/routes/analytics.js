"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const analyticsController_1 = require("../controllers/analyticsController");
const router = (0, express_1.Router)();
router.get('/dashboard', analyticsController_1.getDashboardStats);
router.get('/funnel', analyticsController_1.getConversionFunnel);
router.get('/agents', analyticsController_1.getAgentPerformance);
router.get('/leads-by-source', analyticsController_1.getLeadsBySource);
router.get('/revenue', analyticsController_1.getRevenueChart);
router.get('/messages', analyticsController_1.getMessageVolume);
exports.default = router;
//# sourceMappingURL=analytics.js.map