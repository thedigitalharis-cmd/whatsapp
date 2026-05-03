import { Router, Response } from 'express';
import {
  getConversations, getConversation, assignConversation, updateConversationStatus,
  toggleBot, getMessages, sendMessage, addNote,
} from '../controllers/conversationController';
import { prisma } from '../config/database';
import { AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/', getConversations);
router.get('/:id', getConversation);
router.patch('/:id/assign', assignConversation);
router.patch('/:id/status', updateConversationStatus);
router.patch('/:id/bot', toggleBot);
router.get('/:id/messages', getMessages);
router.post('/:id/messages', sendMessage);
router.post('/:id/notes', addNote);

// Add tag to conversation
router.post('/:id/tags', async (req: AuthRequest, res: Response) => {
  try {
    const conv = await prisma.conversation.update({
      where: { id: req.params.id },
      data: { tags: { connect: { id: req.body.tagId } } },
      include: { tags: true },
    });
    res.json(conv);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Remove tag from conversation
router.delete('/:id/tags/:tagId', async (req: AuthRequest, res: Response) => {
  try {
    const conv = await prisma.conversation.update({
      where: { id: req.params.id },
      data: { tags: { disconnect: { id: req.params.tagId } } },
      include: { tags: true },
    });
    res.json(conv);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
