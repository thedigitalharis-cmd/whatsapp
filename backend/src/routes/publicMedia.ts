import { Router } from 'express';
import axios from 'axios';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';

const router = Router();

// Public media proxy for WhatsApp media IDs.
// Audio/video tags cannot attach Authorization headers, so this route must be public.
const WA_VER = process.env.WHATSAPP_API_VERSION || 'v19.0';

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
        responseType: 'stream',
        timeout: 90000,
      });

      res.setHeader('Content-Type', String(media.headers['content-type'] || 'audio/ogg'));
      res.setHeader('Cache-Control', 'public, max-age=86400');
      media.data.pipe(res);
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
