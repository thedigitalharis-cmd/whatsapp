import { Router } from 'express';
import axios from 'axios';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';

const router = Router();

// Public media proxy for WhatsApp media IDs.
// Audio/video tags cannot attach Authorization headers, so this route must be public.
const WA_VER = process.env.WHATSAPP_API_VERSION || 'v19.0';

router.get('/whatsapp/:mediaId', async (req, res) => {
  try {
    const { mediaId } = req.params;
    const account = await prisma.whatsAppAccount.findFirst({
      where: { status: 'ACTIVE' },
      orderBy: { updatedAt: 'desc' },
    });

    if (!account) {
      return res.status(404).send('No active WhatsApp account configured');
    }

    const meta = await axios.get(`https://graph.facebook.com/${WA_VER}/${mediaId}`, {
      headers: { Authorization: `Bearer ${account.accessToken}` },
    });

    const mediaUrl = meta.data?.url;
    if (!mediaUrl) {
      return res.status(404).send('Media URL not found');
    }

    const media = await axios.get(mediaUrl, {
      headers: { Authorization: `Bearer ${account.accessToken}` },
      responseType: 'stream',
    });

    res.setHeader('Content-Type', String(media.headers['content-type'] || 'application/octet-stream'));
    res.setHeader('Cache-Control', 'public, max-age=86400');
    media.data.pipe(res);
  } catch (error: any) {
    logger.error('Public WhatsApp media proxy failed', {
      mediaId: req.params.mediaId,
      error: error.response?.data || error.message,
    });
    res.status(500).send('Media not available');
  }
});

export default router;
