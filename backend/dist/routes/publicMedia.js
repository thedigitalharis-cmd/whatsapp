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
/** Voice notes are small; buffering fixes HTML5 <audio> grey/disabled controls with chunked streams (no Content-Length). */
const MAX_PROXY_BYTES = 25 * 1024 * 1024;
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
                responseType: 'arraybuffer',
                timeout: 90000,
                maxContentLength: MAX_PROXY_BYTES,
                maxBodyLength: MAX_PROXY_BYTES,
            });
            const buf = Buffer.from(media.data);
            if (buf.length > MAX_PROXY_BYTES) {
                lastErr = 'Media too large';
                continue;
            }
            const ct = String(media.headers['content-type'] || 'audio/ogg').split(';')[0].trim() || 'audio/ogg';
            res.setHeader('Content-Type', ct);
            res.setHeader('Accept-Ranges', 'bytes');
            res.setHeader('Cache-Control', 'public, max-age=86400');
            // Browsers often probe with Range; answering with 206 fixes duration/metadata (0:00) on some engines.
            const range = req.headers.range;
            const rangeStr = typeof range === 'string' ? range.trim() : '';
            if (rangeStr.startsWith('bytes=')) {
                const m = rangeStr.slice('bytes='.length).split('-');
                const start = Math.max(0, parseInt(m[0] || '0', 10) || 0);
                let end = m[1] !== undefined && m[1] !== ''
                    ? parseInt(m[1], 10)
                    : buf.length - 1;
                if (Number.isNaN(end) || end >= buf.length)
                    end = buf.length - 1;
                if (start > end || start >= buf.length) {
                    res.status(416).setHeader('Content-Range', `bytes */${buf.length}`).end();
                    return;
                }
                const chunk = buf.subarray(start, end + 1);
                res.status(206);
                res.setHeader('Content-Length', String(chunk.length));
                res.setHeader('Content-Range', `bytes ${start}-${end}/${buf.length}`);
                res.end(chunk);
                return;
            }
            res.setHeader('Content-Length', String(buf.length));
            res.status(200).end(buf);
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