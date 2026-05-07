import { Router } from 'express';
import axios from 'axios';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';

const router = Router();

// Public media proxy for WhatsApp media IDs.
// Audio/video tags cannot attach Authorization headers, so this route must be public.
const WA_VER = process.env.WHATSAPP_API_VERSION || 'v19.0';
/** Voice notes are small; buffering fixes HTML5 <audio> grey/disabled controls with chunked streams (no Content-Length). */
const MAX_PROXY_BYTES = 25 * 1024 * 1024;

router.get('/whatsapp/:mediaId', async (req, res) => {
  const { mediaId } = req.params;

  const accounts = await prisma.whatsAppAccount.findMany({
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
      const meta = await axios.get(`https://graph.facebook.com/${WA_VER}/${mediaId}`, {
        headers: { Authorization: `Bearer ${account.accessToken}` },
        timeout: 30000,
      });

      const mediaUrl = meta.data?.url as string | undefined;
      if (!mediaUrl) {
        lastErr = 'No URL in Graph media response';
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
      if (buf.length > MAX_PROXY_BYTES) {
        lastErr = 'Media too large';
        continue;
      }

      const ct = String(media.headers['content-type'] || 'audio/ogg').split(';')[0].trim() || 'audio/ogg';

      res.setHeader('Content-Type', ct);
      res.setHeader('Content-Length', String(buf.length));
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.status(200).end(buf);
      return;
    } catch (error: any) {
      const msg =
        error.response?.data?.error?.message ||
        (typeof error.response?.data === 'string' ? error.response.data : error.message);
      lastErr = String(msg || 'unknown');
      logger.warn(`Public media proxy failed for account ${account.id}`, {
        mediaId,
        err: lastErr,
      });
    }
  }

  logger.error('Public WhatsApp media proxy failed for all accounts', { mediaId, lastErr });
  res.status(500).send('Media not available');
});

export default router;
