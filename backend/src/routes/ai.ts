import { Router } from 'express';
import {
  generateAIReply, summarizeConversation, predictLeadScore,
  translateMessage, generateMessageTemplate, smartRouting,
} from '../controllers/aiController';

const router = Router();

router.post('/reply', generateAIReply);
router.post('/translate', translateMessage);
router.post('/generate-template', generateMessageTemplate);
router.post('/smart-routing', smartRouting);
router.post('/conversations/:id/summarize', summarizeConversation);
router.post('/leads/:id/score', predictLeadScore);

export default router;
