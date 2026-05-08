import { Router } from 'express';
import axios from 'axios';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';

const router = Router();
const WA_VER = process.env.WHATSAPP_API_VERSION || 'v19.0';
const MAX_PROXY_BYTES = 25 * 1024 * 1024;

// Public proxy for WhatsApp media IDs so browser <audio> can load without auth headers.
router.get('/whatsapp/:mediaId', async (req, res) => {
  const mediaId = decodeURIComponent(req.params.mediaId || '').trim();
  const accounts = await prisma.whatsAppAccount.findMany({
    where: { accessToken: { not: '' } },
    orderBy: { updatedAt: 'desc' },
    take: 30,
  });

  if (!accounts.length) return res.status(404).send('No WhatsApp account configured');

  let lastErr = '';
  for (const account of accounts) {
    try {
      const meta = await axios.get(`https://graph.facebook.com/${WA_VER}/${mediaId}`, {
        headers: { Authorization: `Bearer ${account.accessToken}` },
        timeout: 30000,
      });
      const mediaUrl = meta.data?.url as string | undefined;
      if (!mediaUrl) {
        lastErr = 'No media URL';
        continue;
      }

      const media = await axios.get(mediaUrl, {
        headers: { Authorization: `Bearer ${account.accessToken}` },
        responseType: 'arraybuffer',
        timeout: 90000,
        maxContentLength: MAX_PROXY_BYTES,
        maxBodyLength: MAX_PROXY_BYTES,
      });

      const buf = Buffer.from(media.data as ArrayBuffer);
      const ct = String(media.headers['content-type'] || 'audio/ogg').split(';')[0].trim() || 'audio/ogg';
      res.setHeader('Content-Type', ct);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Cache-Control', 'public, max-age=86400');

      const range = typeof req.headers.range === 'string' ? req.headers.range.trim() : '';
      if (range.startsWith('bytes=')) {
        const [startRaw, endRaw] = range.slice(6).split('-');
        const start = Math.max(0, parseInt(startRaw || '0', 10) || 0);
        let end = endRaw ? parseInt(endRaw, 10) : buf.length - 1;
        if (Number.isNaN(end) || end >= buf.length) end = buf.length - 1;
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
    } catch (e: any) {
      lastErr = e?.response?.data?.error?.message || e?.message || 'unknown';
      logger.warn(`Public media proxy failed for account ${account.id}`, { mediaId, err: lastErr });
    }
  }

  logger.error('Public media proxy failed for all accounts', { mediaId, lastErr });
  res.status(500).send('Media not available');
});

export default router;
