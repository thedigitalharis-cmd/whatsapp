"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const logger_1 = require("../utils/logger");
const router = (0, express_1.Router)();
const uploadDir = path_1.default.join(process.cwd(), 'uploads');
if (!fs_1.default.existsSync(uploadDir))
    fs_1.default.mkdirSync(uploadDir, { recursive: true });
const storage = multer_1.default.diskStorage({
    destination: uploadDir,
    filename: (req, file, cb) => {
        cb(null, `audio_${Date.now()}_${Math.random().toString(36).slice(2)}.webm`);
    },
});
const upload = (0, multer_1.default)({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('audio/') || file.mimetype.startsWith('video/'))
            cb(null, true);
        else
            cb(new Error('Only audio files allowed'));
    },
});
// Convert webm to ogg using ffmpeg (required by WhatsApp API)
async function convertToOgg(inputPath, outputPath) {
    return new Promise((resolve, reject) => {
        try {
            const ffmpeg = require('fluent-ffmpeg');
            const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
            ffmpeg.setFfmpegPath(ffmpegPath);
            ffmpeg(inputPath)
                .audioCodec('libopus')
                .format('ogg')
                .on('end', resolve)
                .on('error', reject)
                .save(outputPath);
        }
        catch (err) {
            // ffmpeg not available — copy as-is
            fs_1.default.copyFileSync(inputPath, outputPath);
            resolve();
        }
    });
}
router.post('/audio', upload.single('audio'), async (req, res) => {
    try {
        if (!req.file)
            return res.status(400).json({ error: 'No file uploaded' });
        const { phoneNumberId, accessToken, conversationId } = req.body;
        // If conversationId given, get WhatsApp credentials from DB
        let waPhoneNumberId = phoneNumberId;
        let waAccessToken = accessToken;
        if (conversationId && (!waPhoneNumberId || !waAccessToken)) {
            try {
                const { prisma } = require('../config/database');
                const conv = await prisma.conversation.findUnique({
                    where: { id: conversationId },
                    include: { whatsappAccount: { select: { phoneNumberId: true, accessToken: true } } },
                });
                if (conv?.whatsappAccount) {
                    waPhoneNumberId = conv.whatsappAccount.phoneNumberId;
                    waAccessToken = conv.whatsappAccount.accessToken;
                }
            }
            catch (e) {
                logger_1.logger.warn('Could not get WA account from conversation');
            }
        }
        let audioPath = req.file.path;
        let audioMime = 'audio/ogg; codecs=opus';
        // Convert to OGG/Opus if ffmpeg available
        try {
            const oggFilename = req.file.filename.replace('.webm', '.ogg');
            const oggPath = path_1.default.join(uploadDir, oggFilename);
            await convertToOgg(req.file.path, oggPath);
            try {
                fs_1.default.unlinkSync(req.file.path);
            }
            catch { }
            audioPath = oggPath;
        }
        catch {
            logger_1.logger.warn('FFmpeg not available, sending as webm');
            audioMime = 'audio/webm';
        }
        // Upload to Meta and get media_id
        if (waPhoneNumberId && waAccessToken) {
            try {
                const FormData = require('form-data');
                const axios = require('axios');
                const form = new FormData();
                form.append('messaging_product', 'whatsapp');
                form.append('type', audioMime);
                form.append('file', fs_1.default.createReadStream(audioPath), {
                    filename: path_1.default.basename(audioPath),
                    contentType: audioMime,
                });
                const uploadResp = await axios.post(`https://graph.facebook.com/v19.0/${waPhoneNumberId}/media`, form, { headers: { Authorization: `Bearer ${waAccessToken}`, ...form.getHeaders() } });
                const mediaId = uploadResp.data.id;
                logger_1.logger.info(`Audio uploaded to Meta, media_id: ${mediaId}`);
                // Clean up local file
                try {
                    fs_1.default.unlinkSync(audioPath);
                }
                catch { }
                return res.json({ mediaId, mimeType: audioMime });
            }
            catch (metaErr) {
                logger_1.logger.error('Meta audio upload failed:', metaErr.response?.data || metaErr.message);
                // Fall through to return local URL
            }
        }
        // Fallback: return local URL
        const protocol = req.headers['x-forwarded-proto'] || 'https';
        const host = req.headers['x-forwarded-host'] || req.headers.host;
        const url = `${protocol}://${host}/uploads/${path_1.default.basename(audioPath)}`;
        res.json({ url, mimeType: audioMime });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
exports.default = router;
//# sourceMappingURL=upload.js.map