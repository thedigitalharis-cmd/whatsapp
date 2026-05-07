import { Router } from 'express';
import {
  getAccounts, createAccount, updateAccount, deleteAccount,
  verifyAccount, getProfile, updateProfile,
  sendTemplateMessage, getTemplates, createTemplate,
  submitTemplateForApproval, syncTemplates, getMediaUrl,
} from '../controllers/whatsappController';

const router = Router();

// Accounts
router.get('/accounts', getAccounts);
router.post('/accounts', createAccount);
router.put('/accounts/:id', updateAccount);
router.delete('/accounts/:id', deleteAccount);
router.post('/accounts/:id/verify', verifyAccount);
router.get('/accounts/:id/profile', getProfile);
router.post('/accounts/:id/profile', updateProfile);

// Templates
router.get('/templates', getTemplates);
router.post('/templates', createTemplate);
router.post('/templates/:id/submit', submitTemplateForApproval);
router.post('/accounts/:id/templates/sync', syncTemplates);

// Messaging
router.post('/send-template', sendTemplateMessage);

// Media
router.get('/media-url', getMediaUrl);

// Media proxy — streams Meta media through our server so browser can play it
router.get('/media-proxy/:mediaId', async (req: any, res: any) => {
  try {
    const { mediaId } = req.params;
    const { prisma } = require('../config/database');
    // Get any active WA account to use its token
    const account = await prisma.whatsAppAccount.findFirst({ where: { status: 'ACTIVE' } });
    if (!account) return res.status(404).send('No WhatsApp account');

    const axios = require('axios');
    // Get the media URL from Meta
    const metaRes = await axios.get(`https://graph.facebook.com/v19.0/${mediaId}`, {
      headers: { Authorization: `Bearer ${account.accessToken}` },
    });
    const mediaUrl = metaRes.data.url;

    // Stream the actual audio
    const audioRes = await axios.get(mediaUrl, {
      headers: { Authorization: `Bearer ${account.accessToken}` },
      responseType: 'stream',
    });

    res.set('Content-Type', audioRes.headers['content-type'] || 'audio/ogg');
    res.set('Cache-Control', 'public, max-age=86400');
    audioRes.data.pipe(res);
  } catch (e: any) {
    res.status(500).send('Media not available');
  }
});

export default router;
