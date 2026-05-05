"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const whatsappController_1 = require("../controllers/whatsappController");
const router = (0, express_1.Router)();
router.get('/whatsapp', whatsappController_1.handleWebhook);
router.post('/whatsapp', whatsappController_1.handleWebhook);
exports.default = router;
//# sourceMappingURL=webhooks.js.map