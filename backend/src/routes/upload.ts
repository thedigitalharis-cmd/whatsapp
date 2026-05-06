import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();

const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    cb(null, `audio_${Date.now()}_${Math.random().toString(36).slice(2)}.webm`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('audio/') || file.mimetype.startsWith('video/')) cb(null, true);
    else cb(new Error('Only audio files allowed'));
  },
});

// Convert webm to ogg using ffmpeg (required by WhatsApp API)
async function convertToOgg(inputPath: string, outputPath: string): Promise<void> {
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
    } catch (err) {
      // ffmpeg not available — copy as-is
      fs.copyFileSync(inputPath, outputPath);
      resolve();
    }
  });
}

router.post('/audio', upload.single('audio'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers.host;

    let finalFilename = req.file.filename;
    let finalMimeType = 'audio/ogg';

    // Try to convert to OGG (WhatsApp requires ogg/opus)
    try {
      const oggFilename = req.file.filename.replace('.webm', '.ogg');
      const oggPath = path.join(uploadDir, oggFilename);
      await convertToOgg(req.file.path, oggPath);

      // Delete original webm
      try { fs.unlinkSync(req.file.path); } catch {}

      finalFilename = oggFilename;
    } catch (convErr) {
      logger.warn('Audio conversion failed, using original file');
      finalFilename = req.file.filename;
      finalMimeType = req.file.mimetype;
    }

    const url = `${protocol}://${host}/uploads/${finalFilename}`;
    res.json({ url, filename: finalFilename, mimeType: finalMimeType });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
