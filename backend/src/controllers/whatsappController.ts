import { Response } from 'express';
import axios from 'axios';
import { prisma } from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

const WA_API_VERSION = process.env.WHATSAPP_API_VERSION || 'v19.0';
const WA_BASE_URL = `https://graph.facebook.com/${WA_API_VERSION}`;

export const getAccounts = async (req: AuthRequest, res: Response) => {
  try {
    const accounts = await prisma.whatsAppAccount.findMany({
      where: { organizationId: req.user!.organizationId },
      select: { id: true, name: true, phoneNumber: true, status: true, isGreenTick: true, displayName: true, qualityRating: true },
    });
    res.json(accounts);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createAccount = async (req: AuthRequest, res: Response) => {
  try {
    const account = await prisma.whatsAppAccount.create({
      data: { ...req.body, organizationId: req.user!.organizationId },
    });
    res.status(201).json(account);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateAccount = async (req: AuthRequest, res: Response) => {
  try {
    const account = await prisma.whatsAppAccount.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json(account);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const sendWhatsAppMessage = async (
  phoneNumberId: string,
  accessToken: string,
  to: string,
  payload: any
) => {
  const response = await axios.post(
    `${WA_BASE_URL}/${phoneNumberId}/messages`,
    { messaging_product: 'whatsapp', recipient_type: 'individual', to, ...payload },
    { headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' } }
  );
  return response.data;
};

export const sendTemplateMessage = async (req: AuthRequest, res: Response) => {
  try {
    const { accountId, to, templateName, language, components } = req.body;
    const account = await prisma.whatsAppAccount.findFirst({
      where: { id: accountId, organizationId: req.user!.organizationId },
    });
    if (!account) return res.status(404).json({ error: 'Account not found' });

    const result = await sendWhatsAppMessage(account.phoneNumberId, account.accessToken, to, {
      type: 'template',
      template: { name: templateName, language: { code: language || 'en_US' }, components: components || [] },
    });

    res.json(result);
  } catch (error: any) {
    logger.error('Send template message error', error);
    res.status(500).json({ error: error.message });
  }
};

export const getTemplates = async (req: AuthRequest, res: Response) => {
  try {
    const templates = await prisma.messageTemplate.findMany({
      where: { organizationId: req.user!.organizationId },
      orderBy: { createdAt: 'desc' },
    });
    res.json(templates);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createTemplate = async (req: AuthRequest, res: Response) => {
  try {
    const template = await prisma.messageTemplate.create({
      data: { ...req.body, organizationId: req.user!.organizationId },
    });
    res.status(201).json(template);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const submitTemplateForApproval = async (req: AuthRequest, res: Response) => {
  try {
    const template = await prisma.messageTemplate.findFirst({
      where: { id: req.params.id, organizationId: req.user!.organizationId },
      include: { whatsappAccount: true },
    });
    if (!template) return res.status(404).json({ error: 'Template not found' });

    // Submit to WhatsApp API
    const response = await axios.post(
      `${WA_BASE_URL}/${template.whatsappAccount.businessAccountId}/message_templates`,
      {
        name: template.name,
        category: template.category,
        language: template.language,
        components: [
          ...(template.header ? [template.header] : []),
          { type: 'BODY', text: template.body },
          ...(template.footer ? [{ type: 'FOOTER', text: template.footer }] : []),
          ...(template.buttons ? [{ type: 'BUTTONS', buttons: template.buttons }] : []),
        ],
      },
      { headers: { Authorization: `Bearer ${template.whatsappAccount.accessToken}` } }
    );

    await prisma.messageTemplate.update({
      where: { id: template.id },
      data: { status: 'PENDING' },
    });

    res.json({ message: 'Template submitted for approval', data: response.data });
  } catch (error: any) {
    logger.error('Template submission error', error);
    res.status(500).json({ error: error.message });
  }
};

// Webhook handler
export const handleWebhook = async (req: any, res: Response) => {
  try {
    if (req.method === 'GET') {
      const mode = req.query['hub.mode'];
      const token = req.query['hub.verify_token'];
      const challenge = req.query['hub.challenge'];

      if (mode === 'subscribe' && token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
        return res.status(200).send(challenge);
      }
      return res.status(403).send('Forbidden');
    }

    const body = req.body;
    if (body.object !== 'whatsapp_business_account') return res.sendStatus(200);

    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        const value = change.value;

        // Handle status updates
        if (value.statuses) {
          for (const status of value.statuses) {
            await prisma.message.updateMany({
              where: { waMessageId: status.id },
              data: {
                status: status.status.toUpperCase(),
                ...(status.status === 'delivered' && { updatedAt: new Date() }),
                ...(status.status === 'read' && { updatedAt: new Date() }),
              },
            });
          }
        }

        // Handle incoming messages
        if (value.messages) {
          const account = await prisma.whatsAppAccount.findFirst({
            where: { phoneNumberId: value.metadata?.phone_number_id },
          });
          if (!account) continue;

          for (const msg of value.messages) {
            const contact = await prisma.contact.upsert({
              where: { organizationId_phone: { organizationId: account.organizationId, phone: msg.from } },
              update: {},
              create: {
                organizationId: account.organizationId,
                phone: msg.from,
                firstName: value.contacts?.[0]?.profile?.name || msg.from,
                source: 'WHATSAPP',
              },
            });

            let conversation = await prisma.conversation.findFirst({
              where: { contactId: contact.id, whatsappAccountId: account.id, status: { not: 'RESOLVED' } },
            });

            if (!conversation) {
              conversation = await prisma.conversation.create({
                data: {
                  organizationId: account.organizationId,
                  whatsappAccountId: account.id,
                  contactId: contact.id,
                  status: 'OPEN',
                  channel: 'WHATSAPP',
                },
              });
            }

            const messageData: any = {
              conversationId: conversation.id,
              direction: 'INBOUND',
              waMessageId: msg.id,
              status: 'DELIVERED',
            };

            if (msg.type === 'text') {
              messageData.type = 'TEXT';
              messageData.content = msg.text?.body;
            } else if (msg.type === 'image') {
              messageData.type = 'IMAGE';
              messageData.mediaUrl = msg.image?.id;
              messageData.caption = msg.image?.caption;
            } else if (msg.type === 'audio') {
              messageData.type = 'AUDIO';
              messageData.mediaUrl = msg.audio?.id;
            } else if (msg.type === 'video') {
              messageData.type = 'VIDEO';
              messageData.mediaUrl = msg.video?.id;
            } else if (msg.type === 'document') {
              messageData.type = 'DOCUMENT';
              messageData.mediaUrl = msg.document?.id;
            } else if (msg.type === 'location') {
              messageData.type = 'LOCATION';
              messageData.location = msg.location;
            } else if (msg.type === 'interactive') {
              messageData.type = 'INTERACTIVE';
              messageData.interactive = msg.interactive;
            }

            const message = await prisma.message.create({ data: messageData });

            await prisma.conversation.update({
              where: { id: conversation.id },
              data: { lastMessageAt: new Date() },
            });

            const io = (global as any).io;
            io?.to(`org:${account.organizationId}`).emit('message:new', { message, conversationId: conversation.id });
            io?.to(`conv:${conversation.id}`).emit('message:new', message);
          }
        }
      }
    }

    res.sendStatus(200);
  } catch (error: any) {
    logger.error('Webhook error', error);
    res.sendStatus(200);
  }
};
