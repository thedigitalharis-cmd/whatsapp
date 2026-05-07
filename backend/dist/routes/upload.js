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
        const host = req.headers['x-forwarded-host'] || req.headers.host || 'betteraisender.com';
        const publicUrl = `${proto}://${host}/uploads/${req.file.filename}`;
        logger_1.logger.info(`Audio saved: ${req.file.filename} (${req.file.size} bytes)`);
        // Return local URL — WhatsApp will fetch it when we send the message
        res.json({ url: publicUrl, filename: req.file.filename, mimeType: req.file.mimetype || 'audio/webm' });
    }
    catch (e) {
        logger_1.logger.error('Audio upload error:', e.message);
        res.status(500).json({ error: e.message });
    }
});
exports.default = router;
//# sourceMappingURL=upload.js.map