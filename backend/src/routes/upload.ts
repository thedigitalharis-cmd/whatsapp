import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { publicBaseUrl } from '../utils/publicUrl';
import { transcodeWebmToWhatsAppOgg, whatsAppVoiceOutputPath } from '../utils/voiceTranscode';

const router = Router();

const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.webm';
    cb(null, `voice_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 16 * 1024 * 1024 }, // 16MB WhatsApp max
});

router.post('/audio', upload.single('audio'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const proto = (req.headers['x-forwarded-proto'] as string) || 'https';
    const host =
      (req.headers['x-forwarded-host'] as string) ||
      req.headers.host ||
      (() => {
        try {
          return new URL(publicBaseUrl()).host;
        } catch {
          return 'localhost';
        }
      })();

    // Browser MediaRecorder sends WebM; Meta rejects it. Transcode to Opus-in-OGG (requires ffmpeg in Docker image).
    const mime = (req.file.mimetype || '').toLowerCase();
    const outPath = whatsAppVoiceOutputPath(uploadDir, req.file.path);
    try {
      await transcodeWebmToWhatsAppOgg(req.file.path, outPath);
      fs.unlinkSync(req.file.path);
    } catch (convErr: any) {
      logger.error('Voice transcode failed — ensure ffmpeg is installed (apk add ffmpeg in backend image)', convErr?.message);
      return res.status(422).json({
        error:
          'Voice encoding failed (ffmpeg). On server: rebuild backend image after git pull, or send text until ffmpeg is available.',
      });
    }

    const filename = path.basename(outPath);
    const stat = fs.statSync(outPath);
    if (stat.size < 200) {
      fs.unlinkSync(outPath);
      return res.status(400).json({ error: 'Recording too short or empty after encode' });
    }

    const publicUrl = `${proto}://${host}/uploads/${filename}`;
    logger.info(`Audio encoded for WhatsApp: ${filename} (${stat.size} bytes, was ${mime})`);

    res.json({ url: publicUrl, filename, mimeType: 'audio/ogg; codecs=opus' });
  } catch (e: any) {
    logger.error('Audio upload error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

export default router;
