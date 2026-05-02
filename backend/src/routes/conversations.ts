import { Router } from 'express';
import {
  getConversations, getConversation, assignConversation, updateConversationStatus,
  toggleBot, getMessages, sendMessage, addNote,
} from '../controllers/conversationController';

const router = Router();

router.get('/', getConversations);
router.get('/:id', getConversation);
router.patch('/:id/assign', assignConversation);
router.patch('/:id/status', updateConversationStatus);
router.patch('/:id/bot', toggleBot);
router.get('/:id/messages', getMessages);
router.post('/:id/messages', sendMessage);
router.post('/:id/notes', addNote);

export default router;
