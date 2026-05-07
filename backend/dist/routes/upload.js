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
const publicUrl_1 = require("../utils/publicUrl");
const voiceTranscode_1 = require("../utils/voiceTranscode");
const router = (0, express_1.Router)();
const uploadDir = path_1.default.join(process.cwd(), 'uploads');
if (!fs_1.default.existsSync(uploadDir))
    fs_1.default.mkdirSync(uploadDir, { recursive: true });
const storage = multer_1.default.diskStorage({
    destination: uploadDir,
    filename: (req, file, cb) => {
        const ext = path_1.default.extname(file.originalname) || '.webm';
        cb(null, `voice_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`);
    },
});
const upload = (0, multer_1.default)({
    storage,
    limits: { fileSize: 16 * 1024 * 1024 }, // 16MB WhatsApp max
});
router.post('/audio', upload.single('audio'), async (req, res) => {
    try {
        if (!req.file)
            return res.status(400).json({ error: 'No file uploaded' });
        const proto = req.headers['x-forwarded-proto'] || 'https';
        const host = req.headers['x-forwarded-host'] ||
            req.headers.host ||
            (() => {
                try {
                    return new URL((0, publicUrl_1.publicBaseUrl)()).host;
                }
                catch {
                    return 'localhost';
                }
            })();
        // Browser MediaRecorder sends WebM; Meta rejects it. Transcode to Opus-in-OGG (requires ffmpeg in Docker image).
        const mime = (req.file.mimetype || '').toLowerCase();
        const outPath = (0, voiceTranscode_1.whatsAppVoiceOutputPath)(uploadDir, req.file.path);
        try {
            await (0, voiceTranscode_1.transcodeWebmToWhatsAppOgg)(req.file.path, outPath);
            fs_1.default.unlinkSync(req.file.path);
        }
        catch (convErr) {
            logger_1.logger.error('Voice transcode failed — ensure ffmpeg is installed (apk add ffmpeg in backend image)', convErr?.message);
            return res.status(422).json({
                error: 'Voice encoding failed (ffmpeg). On server: rebuild backend image after git pull, or send text until ffmpeg is available.',
            });
        }
        const filename = path_1.default.basename(outPath);
        const stat = fs_1.default.statSync(outPath);
        if (stat.size < 200) {
            fs_1.default.unlinkSync(outPath);
            return res.status(400).json({ error: 'Recording too short or empty after encode' });
        }
        const publicUrl = `${proto}://${host}/uploads/${filename}`;
        logger_1.logger.info(`Audio encoded for WhatsApp: ${filename} (${stat.size} bytes, was ${mime})`);
        res.json({ url: publicUrl, filename, mimeType: 'audio/ogg; codecs=opus' });
    }
    catch (e) {
        logger_1.logger.error('Audio upload error:', e.message);
        res.status(500).json({ error: e.message });
    }
});
exports.default = router;
//# sourceMappingURL=upload.js.map