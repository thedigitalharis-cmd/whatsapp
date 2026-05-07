"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const conversationController_1 = require("../controllers/conversationController");
const database_1 = require("../config/database");
const router = (0, express_1.Router)();
router.get('/', conversationController_1.getConversations);
router.get('/:id', conversationController_1.getConversation);
router.patch('/:id/assign', conversationController_1.assignConversation);
router.patch('/:id/status', conversationController_1.updateConversationStatus);
router.patch('/:id/archive', conversationController_1.archiveConversation);
router.patch('/:id/unarchive', conversationController_1.unarchiveConversation);
router.delete('/:id', conversationController_1.deleteConversation);
router.patch('/:id/bot', conversationController_1.toggleBot);
router.get('/:id/messages', conversationController_1.getMessages);
router.post('/:id/messages', conversationController_1.sendMessage);
router.post('/:id/notes', conversationController_1.addNote);
// Add tag to conversation
router.post('/:id/tags', async (req, res) => {
    try {
        const conv = await database_1.prisma.conversation.update({
            where: { id: req.params.id },
            data: { tags: { connect: { id: req.body.tagId } } },
            include: { tags: true },
        });
        res.json(conv);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// Save / update contact info from conversation
router.post('/:id/save-contact', async (req, res) => {
    try {
        const conv = await database_1.prisma.conversation.findFirst({
            where: { id: req.params.id, organizationId: req.user.organizationId },
            include: { contact: true },
        });
        if (!conv)
            return res.status(404).json({ error: 'Not found' });
        const { firstName, lastName, email, company, jobTitle, notes, gdprConsent } = req.body;
        const contact = await database_1.prisma.contact.update({
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
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// Remove tag from conversation
router.delete('/:id/tags/:tagId', async (req, res) => {
    try {
        const conv = await database_1.prisma.conversation.update({
            where: { id: req.params.id },
            data: { tags: { disconnect: { id: req.params.tagId } } },
            include: { tags: true },
        });
        res.json(conv);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
exports.default = router;
//# sourceMappingURL=conversations.js.map