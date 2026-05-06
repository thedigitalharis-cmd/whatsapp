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
        const protocol = req.headers['x-forwarded-proto'] || 'https';
        const host = req.headers['x-forwarded-host'] || req.headers.host;
        let finalFilename = req.file.filename;
        let finalMimeType = 'audio/ogg';
        // Try to convert to OGG (WhatsApp requires ogg/opus)
        try {
            const oggFilename = req.file.filename.replace('.webm', '.ogg');
            const oggPath = path_1.default.join(uploadDir, oggFilename);
            await convertToOgg(req.file.path, oggPath);
            // Delete original webm
            try {
                fs_1.default.unlinkSync(req.file.path);
            }
            catch { }
            finalFilename = oggFilename;
        }
        catch (convErr) {
            logger_1.logger.warn('Audio conversion failed, using original file');
            finalFilename = req.file.filename;
            finalMimeType = req.file.mimetype;
        }
        const url = `${protocol}://${host}/uploads/${finalFilename}`;
        res.json({ url, filename: finalFilename, mimeType: finalMimeType });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
exports.default = router;
//# sourceMappingURL=upload.js.map