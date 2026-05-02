import { Router } from 'express';
import { handleWebhook } from '../controllers/whatsappController';

const router = Router();

router.get('/whatsapp', handleWebhook);
router.post('/whatsapp', handleWebhook);

export default router;
