import { Router } from 'express';
import { getAccounts, createAccount, updateAccount, sendTemplateMessage, getTemplates, createTemplate, submitTemplateForApproval } from '../controllers/whatsappController';

const router = Router();

router.get('/accounts', getAccounts);
router.post('/accounts', createAccount);
router.put('/accounts/:id', updateAccount);
router.post('/send-template', sendTemplateMessage);
router.get('/templates', getTemplates);
router.post('/templates', createTemplate);
router.post('/templates/:id/submit', submitTemplateForApproval);

export default router;
