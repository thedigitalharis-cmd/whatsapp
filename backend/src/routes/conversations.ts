import { Router, Response } from 'express';
import {
  getConversations, getConversation, assignConversation, updateConversationStatus,
  toggleBot, getMessages, sendMessage, addNote,
  archiveConversation, unarchiveConversation, deleteConversation,
  deleteMessageForMe, deleteMessageForEveryone,
} from '../controllers/conversationController';
import { prisma } from '../config/database';
import { AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/', getConversations);
router.get('/:id', getConversation);
router.patch('/:id/assign', assignConversation);
router.patch('/:id/status', updateConversationStatus);
router.patch('/:id/archive', archiveConversation);
router.patch('/:id/unarchive', unarchiveConversation);
router.delete('/:id', deleteConversation);
router.patch('/:id/bot', toggleBot);
router.post('/:id/messages/:messageId/delete-for-me', deleteMessageForMe);
router.post('/:id/messages/:messageId/delete-for-everyone', deleteMessageForEveryone);
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

// Save / update contact info from conversation
router.post('/:id/save-contact', async (req: AuthRequest, res: Response) => {
  try {
    const conv = await prisma.conversation.findFirst({
      where: { id: req.params.id, organizationId: req.user!.organizationId },
      include: { contact: true },
    });
    if (!conv) return res.status(404).json({ error: 'Not found' });

    const { firstName, lastName, email, company, jobTitle, notes, gdprConsent } = req.body;
    const contact = await prisma.contact.update({
      where: { id: conv.contactId },
      data: {
        ...(firstName && { firstName }),
        ...(lastName !== undefined && { lastName }),
        ...(email && { email }),
        ...(company !== undefined && { company }),
        ...(jobTitle !== undefined && { jobTitle }),
        ...(notes !== undefined && { notes }),
        ...(gdprConsent !== undefined && { gdprConsent, gdprConsentDate: gdprConsent ? new Date() : null }),
      },
    });
    res.json(contact);
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
