"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const aiController_1 = require("../controllers/aiController");
const router = (0, express_1.Router)();
router.post('/reply', aiController_1.generateAIReply);
router.post('/translate', aiController_1.translateMessage);
router.post('/generate-template', aiController_1.generateMessageTemplate);
router.post('/smart-routing', aiController_1.smartRouting);
router.post('/conversations/:id/summarize', aiController_1.summarizeConversation);
router.post('/leads/:id/score', aiController_1.predictLeadScore);
exports.default = router;
//# sourceMappingURL=ai.js.map