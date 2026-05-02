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

export default router;
