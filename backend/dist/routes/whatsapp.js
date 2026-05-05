"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const whatsappController_1 = require("../controllers/whatsappController");
const router = (0, express_1.Router)();
// Accounts
router.get('/accounts', whatsappController_1.getAccounts);
router.post('/accounts', whatsappController_1.createAccount);
router.put('/accounts/:id', whatsappController_1.updateAccount);
router.delete('/accounts/:id', whatsappController_1.deleteAccount);
router.post('/accounts/:id/verify', whatsappController_1.verifyAccount);
router.get('/accounts/:id/profile', whatsappController_1.getProfile);
router.post('/accounts/:id/profile', whatsappController_1.updateProfile);
// Templates
router.get('/templates', whatsappController_1.getTemplates);
router.post('/templates', whatsappController_1.createTemplate);
router.post('/templates/:id/submit', whatsappController_1.submitTemplateForApproval);
router.post('/accounts/:id/templates/sync', whatsappController_1.syncTemplates);
// Messaging
router.post('/send-template', whatsappController_1.sendTemplateMessage);
// Media
router.get('/media-url', whatsappController_1.getMediaUrl);
exports.default = router;
//# sourceMappingURL=whatsapp.js.map