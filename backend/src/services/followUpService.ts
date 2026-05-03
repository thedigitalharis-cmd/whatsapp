import cron from 'node-cron';
import { prisma } from '../config/database';
import { sendText, sendTemplate } from './whatsappService';
import { logger } from '../utils/logger';

// Run every minute to check for due follow-ups
export function startFollowUpScheduler(): void {
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();

      // Find all pending follow-ups that are due
      const dueFollowUps = await prisma.followUp.findMany({
        where: {
          status: 'PENDING',
          scheduledAt: { lte: now },
        },
        include: {
          contact: true,
          conversation: {
            include: { whatsappAccount: true },
          },
          organization: {
            include: { whatsappAccounts: { where: { status: 'ACTIVE' }, take: 1 } },
          },
        },
        take: 50,
      });

      for (const followUp of dueFollowUps) {
        await processFollowUp(followUp);
      }
    } catch (err: any) {
      logger.error('Follow-up scheduler error', err.message);
    }
  });

  logger.info('Follow-up scheduler started (runs every minute)');
}

async function processFollowUp(followUp: any): Promise<void> {
  try {
    // Get the WhatsApp account to use
    const waAccount = followUp.conversation?.whatsappAccount
      || followUp.organization?.whatsappAccounts?.[0];

    if (!waAccount) {
      await prisma.followUp.update({
        where: { id: followUp.id },
        data: { status: 'FAILED', errorMessage: 'No WhatsApp account available' },
      });
      return;
    }

    if (!followUp.contact?.phone) {
      await prisma.followUp.update({
        where: { id: followUp.id },
        data: { status: 'FAILED', errorMessage: 'No contact phone number' },
      });
      return;
    }

    // Send the follow-up message
    const result = await sendText(
      waAccount.phoneNumberId,
      waAccount.accessToken,
      followUp.contact.phone,
      followUp.message
    );

    const waMessageId = result?.messages?.[0]?.id;

    // Mark as sent
    await prisma.followUp.update({
      where: { id: followUp.id },
      data: {
        status: 'SENT',
        sentAt: new Date(),
        waMessageId,
      },
    });

    // Create a message record in the conversation if exists
    if (followUp.conversationId) {
      await prisma.message.create({
        data: {
          conversationId: followUp.conversationId,
          direction: 'OUTBOUND',
          type: 'TEXT',
          content: `🔔 [Follow-up] ${followUp.message}`,
          status: 'SENT',
          waMessageId,
        },
      });

      await prisma.conversation.update({
        where: { id: followUp.conversationId },
        data: { lastMessageAt: new Date() },
      });
    }

    // Handle recurring follow-ups
    if (followUp.type === 'RECURRING' && followUp.recurringDays) {
      const nextDate = new Date(followUp.scheduledAt);
      nextDate.setDate(nextDate.getDate() + followUp.recurringDays);

      await prisma.followUp.create({
        data: {
          organizationId: followUp.organizationId,
          contactId: followUp.contactId,
          conversationId: followUp.conversationId,
          createdById: followUp.createdById,
          title: followUp.title,
          message: followUp.message,
          scheduledAt: nextDate,
          type: 'RECURRING',
          recurringDays: followUp.recurringDays,
        },
      });
    }

    logger.info(`Follow-up sent: ${followUp.id} to ${followUp.contact.phone}`);

    // Emit realtime event
    const io = (global as any).io;
    if (io) {
      io.to(`org:${followUp.organizationId}`).emit('followup:sent', {
        followUpId: followUp.id,
        contactName: `${followUp.contact.firstName} ${followUp.contact.lastName || ''}`,
      });
    }
  } catch (err: any) {
    logger.error(`Follow-up ${followUp.id} failed: ${err.message}`);
    await prisma.followUp.update({
      where: { id: followUp.id },
      data: { status: 'FAILED', errorMessage: err.message },
    });
  }
}
