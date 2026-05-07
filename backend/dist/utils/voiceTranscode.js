"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.transcodeWebmToWhatsAppOgg = transcodeWebmToWhatsAppOgg;
exports.whatsAppVoiceOutputPath = whatsAppVoiceOutputPath;
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const fluent_ffmpeg_1 = __importDefault(require("fluent-ffmpeg"));
const logger_1 = require("./logger");
/** WhatsApp Cloud API requires Opus in OGG for voice links it fetches from our URL. */
async function transcodeWebmToWhatsAppOgg(inputPath, outputPath) {
    await fs_1.default.promises.unlink(outputPath).catch(() => { });
    return new Promise((resolve, reject) => {
        (0, fluent_ffmpeg_1.default)(inputPath)
            .noVideo()
            .audioCodec('libopus')
            .audioBitrate(64)
            .format('ogg')
            .on('end', () => resolve())
            .on('error', (err, _stdout, stderr) => {
            logger_1.logger.error(`ffmpeg voice transcode: ${err.message}`, { stderr: stderr?.slice?.(0, 500) });
            reject(err);
        })
            .save(outputPath);
    });
}
function whatsAppVoiceOutputPath(uploadDir, multerSavedPath) {
    const base = path_1.default.basename(multerSavedPath, path_1.default.extname(multerSavedPath));
    return path_1.default.join(uploadDir, `${base}_wa.ogg`);
}
//# sourceMappingURL=voiceTranscode.js.map