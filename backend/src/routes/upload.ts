import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { publicBaseUrl } from '../utils/publicUrl';

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
    const publicUrl = `${proto}://${host}/uploads/${req.file.filename}`;

    logger.info(`Audio saved: ${req.file.filename} (${req.file.size} bytes)`);

    // Return local URL — WhatsApp will fetch it when we send the message
    res.json({ url: publicUrl, filename: req.file.filename, mimeType: req.file.mimetype || 'audio/webm' });
  } catch (e: any) {
    logger.error('Audio upload error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

export default router;
