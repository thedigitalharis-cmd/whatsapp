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
// Media proxy — streams Meta media through our server so browser can play it
router.get('/media-proxy/:mediaId', async (req, res) => {
    try {
        const { mediaId } = req.params;
        const { prisma } = require('../config/database');
        // Get any active WA account to use its token
        const account = await prisma.whatsAppAccount.findFirst({ where: { status: 'ACTIVE' } });
        if (!account)
            return res.status(404).send('No WhatsApp account');
        const axios = require('axios');
        // Get the media URL from Meta
        const metaRes = await axios.get(`https://graph.facebook.com/v19.0/${mediaId}`, {
            headers: { Authorization: `Bearer ${account.accessToken}` },
        });
        const mediaUrl = metaRes.data.url;
        // Stream the actual audio
        const audioRes = await axios.get(mediaUrl, {
            headers: { Authorization: `Bearer ${account.accessToken}` },
            responseType: 'stream',
        });
        res.set('Content-Type', audioRes.headers['content-type'] || 'audio/ogg');
        res.set('Cache-Control', 'public, max-age=86400');
        audioRes.data.pipe(res);
    }
    catch (e) {
        res.status(500).send('Media not available');
    }
});
exports.default = router;
//# sourceMappingURL=whatsapp.js.map