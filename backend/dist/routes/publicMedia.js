"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const axios_1 = __importDefault(require("axios"));
const database_1 = require("../config/database");
const logger_1 = require("../utils/logger");
const router = (0, express_1.Router)();
// Public media proxy for WhatsApp media IDs.
// Audio/video tags cannot attach Authorization headers, so this route must be public.
const WA_VER = process.env.WHATSAPP_API_VERSION || 'v19.0';
router.get('/whatsapp/:mediaId', async (req, res) => {
    const { mediaId } = req.params;
    const accounts = await database_1.prisma.whatsAppAccount.findMany({
        where: { status: 'ACTIVE' },
        orderBy: { updatedAt: 'desc' },
        take: 15,
    });
    if (!accounts.length) {
        return res.status(404).send('No WhatsApp account configured');
    }
    let lastErr = '';
    for (const account of accounts) {
        try {
            const meta = await axios_1.default.get(`https://graph.facebook.com/${WA_VER}/${mediaId}`, {
                headers: { Authorization: `Bearer ${account.accessToken}` },
                timeout: 30000,
            });
            const mediaUrl = meta.data?.url;
            if (!mediaUrl) {
                lastErr = 'No URL in Graph media response';
                continue;
            }
            const media = await axios_1.default.get(mediaUrl, {
                headers: { Authorization: `Bearer ${account.accessToken}` },
                responseType: 'stream',
                timeout: 90000,
            });
            res.setHeader('Content-Type', String(media.headers['content-type'] || 'audio/ogg'));
            res.setHeader('Cache-Control', 'public, max-age=86400');
            media.data.pipe(res);
            return;
        }
        catch (error) {
            const msg = error.response?.data?.error?.message ||
                (typeof error.response?.data === 'string' ? error.response.data : error.message);
            lastErr = String(msg || 'unknown');
            logger_1.logger.warn(`Public media proxy failed for account ${account.id}`, {
                mediaId,
                err: lastErr,
            });
        }
    }
    logger_1.logger.error('Public WhatsApp media proxy failed for all accounts', { mediaId, lastErr });
    res.status(500).send('Media not available');
});
exports.default = router;
//# sourceMappingURL=publicMedia.js.map