"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const leadController_1 = require("../controllers/leadController");
const router = (0, express_1.Router)();
router.get('/', leadController_1.getLeads);
router.post('/', leadController_1.createLead);
router.post('/bulk-assign', leadController_1.bulkAssignLeads);
router.get('/:id', leadController_1.getLead);
router.put('/:id', leadController_1.updateLead);
router.post('/:id/convert', leadController_1.convertLead);
exports.default = router;
//# sourceMappingURL=leads.js.map