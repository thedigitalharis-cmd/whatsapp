import { Request, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import * as wa from '../services/whatsappService';

// ─── Accounts ─────────────────────────────────────────────────────────────

export const getAccounts = async (req: AuthRequest, res: Response) => {
  try {
    const accounts = await prisma.whatsAppAccount.findMany({
      where: { organizationId: req.user!.organizationId },
      select: {
        id: true, name: true, phoneNumber: true, phoneNumberId: true,
        businessAccountId: true, status: true, isGreenTick: true,
        displayName: true, qualityRating: true, apiType: true,
        about: true, profilePicture: true, messagingLimit: true,
        webhookVerifyToken: true, createdAt: true,
      },
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

export const deleteAccount = async (req: AuthRequest, res: Response) => {
  try {
    await prisma.whatsAppAccount.delete({ where: { id: req.params.id } });
    res.json({ message: 'Account deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// ─── Verify & sync account with Meta API ──────────────────────────────────

export const verifyAccount = async (req: AuthRequest, res: Response) => {
  try {
    const account = await prisma.whatsAppAccount.findFirst({
      where: { id: req.params.id, organizationId: req.user!.organizationId },
    });
    if (!account) return res.status(404).json({ error: 'Account not found' });

    const phoneInfo = await wa.verifyAccount(account.phoneNumberId, account.accessToken);
    const profile = await wa.getBusinessProfile(account.phoneNumberId, account.accessToken);

    const updated = await prisma.whatsAppAccount.update({
      where: { id: account.id },
      data: {
        status: 'ACTIVE',
        displayName: phoneInfo.verified_name || account.displayName,
        qualityRating: phoneInfo.quality_rating,
        isGreenTick: phoneInfo.name_status === 'APPROVED',
        about: profile.about,
        profilePicture: profile.profile_picture_url,
        messagingLimit: phoneInfo.throughput?.level,
      },
    });

    res.json({ verified: true, account: updated, phoneInfo, profile });
  } catch (error: any) {
    logger.error('Verify account error', error);
    // Mark as failed but return details
    await prisma.whatsAppAccount.update({
      where: { id: req.params.id },
      data: { status: 'SUSPENDED' },
    }).catch(() => {});
    res.status(400).json({ verified: false, error: error.message });
  }
};

// ─── Get & update business profile ────────────────────────────────────────

export const getProfile = async (req: AuthRequest, res: Response) => {
  try {
    const account = await prisma.whatsAppAccount.findFirst({
      where: { id: req.params.id, organizationId: req.user!.organizationId },
    });
    if (!account) return res.status(404).json({ error: 'Account not found' });

    const profile = await wa.getBusinessProfile(account.phoneNumberId, account.accessToken);
    res.json(profile);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateProfile = async (req: AuthRequest, res: Response) => {
  try {
    const account = await prisma.whatsAppAccount.findFirst({
      where: { id: req.params.id, organizationId: req.user!.organizationId },
    });
    if (!account) return res.status(404).json({ error: 'Account not found' });

    const result = await wa.updateBusinessProfile(account.phoneNumberId, account.accessToken, req.body);

    // Sync to DB
    await prisma.whatsAppAccount.update({
      where: { id: account.id },
      data: { about: req.body.about },
    });

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// ─── Templates ────────────────────────────────────────────────────────────

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

    const client = wa.waClient(template.whatsappAccount.accessToken);
    const components: any[] = [];

    if (template.header) components.push(template.header);
    components.push({ type: 'BODY', text: template.body });
    if (template.footer) components.push({ type: 'FOOTER', text: template.footer });
    if (template.buttons) components.push({ type: 'BUTTONS', buttons: template.buttons });

    const { data } = await client.post(`/${template.whatsappAccount.businessAccountId}/message_templates`, {
      name: template.name,
      category: template.category,
      language: template.language,
      components,
    });

    await prisma.messageTemplate.update({
      where: { id: template.id },
      data: { status: 'PENDING' },
    });

    res.json({ message: 'Template submitted for approval', data });
  } catch (error: any) {
    logger.error('Template submission error', error);
    res.status(500).json({ error: error.message });
  }
};

// Sync templates from Meta into local DB
export const syncTemplates = async (req: AuthRequest, res: Response) => {
  try {
    const account = await prisma.whatsAppAccount.findFirst({
      where: { id: req.params.id, organizationId: req.user!.organizationId },
    });
    if (!account) return res.status(404).json({ error: 'Account not found' });

    const metaTemplates = await wa.fetchTemplatesFromMeta(account.businessAccountId, account.accessToken);

    let synced = 0;
    for (const t of metaTemplates) {
      const bodyComp = t.components?.find((c: any) => c.type === 'BODY');
      const footerComp = t.components?.find((c: any) => c.type === 'FOOTER');
      const headerComp = t.components?.find((c: any) => c.type === 'HEADER');
      const buttonsComp = t.components?.find((c: any) => c.type === 'BUTTONS');

      if (!bodyComp) continue;

      await prisma.messageTemplate.upsert({
        where: {
          // Use name+accountId as unique identifier for Meta-sourced templates
          id: `meta-${account.id}-${t.name}-${t.language}`.replace(/[^a-z0-9-]/gi, '-'),
        },
        update: {
          status: mapMetaStatus(t.status),
          rejectionReason: t.rejected_reason || null,
        },
        create: {
          id: `meta-${account.id}-${t.name}-${t.language}`.replace(/[^a-z0-9-]/gi, '-'),
          organizationId: req.user!.organizationId,
          whatsappAccountId: account.id,
          name: t.name,
          category: t.category as any,
          language: t.language,
          status: mapMetaStatus(t.status),
          body: bodyComp.text || '',
          footer: footerComp?.text,
          header: headerComp || null,
          buttons: buttonsComp?.buttons || null,
          rejectionReason: t.rejected_reason || null,
        },
      });
      synced++;
    }

    res.json({ synced, total: metaTemplates.length });
  } catch (error: any) {
    logger.error('Sync templates error', error);
    res.status(500).json({ error: error.message });
  }
};

function mapMetaStatus(s: string): 'APPROVED' | 'PENDING' | 'REJECTED' | 'PAUSED' {
  const map: Record<string, any> = {
    APPROVED: 'APPROVED', ACTIVE: 'APPROVED',
    PENDING: 'PENDING', PENDING_DELETION: 'PENDING',
    REJECTED: 'REJECTED', DISABLED: 'PAUSED', PAUSED: 'PAUSED',
  };
  return map[s?.toUpperCase()] || 'PENDING';
}

// ─── Send message (used by conversation controller + direct API) ───────────

export const sendWhatsAppMessage = async (
  phoneNumberId: string,
  accessToken: string,
  to: string,
  payload: any
) => {
  // Delegate to the typed helpers based on type
  const type = payload.type || 'text';

  switch (type) {
    case 'template':
      return wa.sendTemplate(
        phoneNumberId, accessToken, to,
        payload.template.name,
        payload.template.language?.code || 'en_US',
        payload.template.components || []
      );
    case 'image':
      return wa.sendImage(phoneNumberId, accessToken, to, payload.image?.link || payload.image?.url, payload.image?.caption);
    case 'document':
      return wa.sendDocument(phoneNumberId, accessToken, to, payload.document?.link, payload.document?.filename || 'file', payload.document?.caption);
    case 'audio':
      return wa.sendAudio(phoneNumberId, accessToken, to, payload.audio?.link);
    case 'video':
      return wa.sendVideo(phoneNumberId, accessToken, to, payload.video?.link, payload.video?.caption);
    case 'location':
      return wa.sendLocation(phoneNumberId, accessToken, to, payload.location?.latitude, payload.location?.longitude, payload.location?.name, payload.location?.address);
    case 'interactive':
      if (payload.interactive?.type === 'button') {
        return wa.sendInteractiveButtons(
          phoneNumberId, accessToken, to,
          payload.interactive.body?.text,
          payload.interactive.action?.buttons?.map((b: any) => ({ id: b.reply.id, title: b.reply.title })),
          payload.interactive.header?.text,
          payload.interactive.footer?.text
        );
      }
      if (payload.interactive?.type === 'list') {
        return wa.sendInteractiveList(
          phoneNumberId, accessToken, to,
          payload.interactive.body?.text,
          payload.interactive.action?.button,
          payload.interactive.action?.sections
        );
      }
      break;
    default:
      return wa.sendText(phoneNumberId, accessToken, to, payload.text?.body || payload.content || '');
  }
};

// Direct send endpoint (for testing)
export const sendTemplateMessage = async (req: AuthRequest, res: Response) => {
  try {
    const { accountId, to, templateName, language, components } = req.body;
    const account = await prisma.whatsAppAccount.findFirst({
      where: { id: accountId, organizationId: req.user!.organizationId },
    });
    if (!account) return res.status(404).json({ error: 'Account not found' });

    const result = await wa.sendTemplate(account.phoneNumberId, account.accessToken, to, templateName, language || 'en_US', components || []);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// ─── Webhook ──────────────────────────────────────────────────────────────

export const handleWebhook = async (req: Request, res: Response) => {
  try {
    // GET: verification handshake
    if (req.method === 'GET') {
      const mode = req.query['hub.mode'];
      const token = req.query['hub.verify_token'];
      const challenge = req.query['hub.challenge'];

      if (mode === 'subscribe' && token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
        logger.info('WhatsApp webhook verified');
        return res.status(200).send(challenge);
      }
      return res.status(403).json({ error: 'Verification failed' });
    }

    // POST: incoming events — validate signature if app secret is set
    if (process.env.WHATSAPP_APP_SECRET) {
      const sig = req.headers['x-hub-signature-256'] as string || '';
      const rawBody = JSON.stringify(req.body);
      if (!wa.validateWebhookSignature(rawBody, sig, process.env.WHATSAPP_APP_SECRET)) {
        logger.warn('Invalid webhook signature');
        return res.sendStatus(401);
      }
    }

    const body = req.body;
    if (body.object !== 'whatsapp_business_account') return res.sendStatus(200);

    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        if (change.field !== 'messages') continue;
        const value = change.value;

        // ── Status updates ──────────────────────────────────────────────
        if (value.statuses) {
          for (const status of value.statuses) {
            const statusMap: Record<string, string> = {
              sent: 'SENT', delivered: 'DELIVERED', read: 'READ', failed: 'FAILED',
            };
            await prisma.message.updateMany({
              where: { waMessageId: status.id },
              data: {
                status: (statusMap[status.status] || 'SENT') as any,
                ...(status.errors?.[0] && {
                  errorCode: String(status.errors[0].code),
                  errorMessage: status.errors[0].title,
                }),
              },
            });

            // Bubble status to realtime clients
            const io = (global as any).io;
            if (io) {
              io.emit('message:status', { waMessageId: status.id, status: statusMap[status.status] });
            }
          }
        }

        // ── Incoming messages ───────────────────────────────────────────
        if (value.messages) {
          const account = await prisma.whatsAppAccount.findFirst({
            where: { phoneNumberId: value.metadata?.phone_number_id },
          });
          if (!account) continue;

          for (const msg of value.messages) {
            // Upsert contact
            const profileName = value.contacts?.find((c: any) => c.wa_id === msg.from)?.profile?.name;
            const contact = await prisma.contact.upsert({
              where: { organizationId_phone: { organizationId: account.organizationId, phone: msg.from } },
              update: profileName ? { firstName: profileName } : {},
              create: {
                organizationId: account.organizationId,
                phone: msg.from,
                firstName: profileName || msg.from,
                source: 'WHATSAPP',
              },
            });

            // Find or create open conversation
            // Find existing non-archived conversation (any status)
            let conversation = await prisma.conversation.findFirst({
              where: {
                contactId: contact.id,
                whatsappAccountId: account.id,
                isArchived: false,
                status: { not: 'RESOLVED' },
              },
              orderBy: { lastMessageAt: 'desc' },
            });

            if (!conversation) {
              // Check for resolved conversation to reopen (avoid duplicate chats)
              const resolved = await prisma.conversation.findFirst({
                where: {
                  contactId: contact.id,
                  whatsappAccountId: account.id,
                  isArchived: false,
                  status: 'RESOLVED',
                },
                orderBy: { resolvedAt: 'desc' },
              });

              if (resolved) {
                // Reopen existing resolved conversation
                conversation = await prisma.conversation.update({
                  where: { id: resolved.id },
                  data: { status: 'OPEN', resolvedAt: null, waitingSince: new Date() },
                });
              } else {
                // Create new conversation
                conversation = await prisma.conversation.create({
                  data: {
                    organizationId: account.organizationId,
                    whatsappAccountId: account.id,
                    contactId: contact.id,
                    status: 'OPEN',
                    channel: 'WHATSAPP',
                    waitingSince: new Date(),
                  },
                });
              }
            }

            // Build message record
            const msgData: any = {
              conversationId: conversation.id,
              direction: 'INBOUND',
              waMessageId: msg.id,
              status: 'DELIVERED',
              replyToId: msg.context?.id || null,
            };

            switch (msg.type) {
              case 'text':
                msgData.type = 'TEXT';
                msgData.content = msg.text?.body;
                break;
              case 'image':
                msgData.type = 'IMAGE';
                msgData.mediaUrl = msg.image?.id;
                msgData.mediaType = msg.image?.mime_type;
                msgData.caption = msg.image?.caption;
                break;
              case 'audio':
              case 'voice':
                msgData.type = 'AUDIO';
                // Store media_id — we resolve to URL when displaying
                msgData.mediaUrl = msg.audio?.id
                  ? `https://betteraisender.com/api/whatsapp/media-proxy/${msg.audio.id}`
                  : null;
                msgData.mediaType = 'audio/ogg';
                break;
              case 'video':
                msgData.type = 'VIDEO';
                msgData.mediaUrl = msg.video?.id;
                msgData.mediaType = msg.video?.mime_type;
                msgData.caption = msg.video?.caption;
                break;
              case 'document':
                msgData.type = 'DOCUMENT';
                msgData.mediaUrl = msg.document?.id;
                msgData.mediaType = msg.document?.mime_type;
                msgData.caption = msg.document?.caption || msg.document?.filename;
                break;
              case 'sticker':
                msgData.type = 'STICKER';
                msgData.mediaUrl = msg.sticker?.id;
                break;
              case 'location':
                msgData.type = 'LOCATION';
                msgData.location = msg.location;
                break;
              case 'contacts':
                msgData.type = 'CONTACTS';
                msgData.contacts = msg.contacts;
                break;
              case 'interactive':
                msgData.type = 'INTERACTIVE';
                msgData.interactive = msg.interactive;
                // Extract button/list reply text for content
                if (msg.interactive?.button_reply) msgData.content = msg.interactive.button_reply.title;
                if (msg.interactive?.list_reply) msgData.content = msg.interactive.list_reply.title;
                break;
              case 'button':
                msgData.type = 'INTERACTIVE';
                msgData.content = msg.button?.text;
                break;
              case 'reaction':
                msgData.type = 'REACTION';
                msgData.reaction = msg.reaction?.emoji;
                msgData.replyToId = msg.reaction?.message_id;
                break;
              default:
                msgData.type = 'TEXT';
                msgData.content = JSON.stringify(msg);
            }

            const message = await prisma.message.create({ data: msgData });

            // Mark read on Meta
            try {
              await wa.markMessageRead(account.phoneNumberId, account.accessToken, msg.id);
            } catch (e) {
              // Non-fatal
            }

            await prisma.conversation.update({
              where: { id: conversation.id },
              data: { lastMessageAt: new Date(), waitingSince: new Date() },
            });

            // Realtime push
            const io = (global as any).io;
            if (io) {
              io.to(`org:${account.organizationId}`).emit('message:new', {
                message,
                conversationId: conversation.id,
                contactId: contact.id,
              });
              io.to(`conv:${conversation.id}`).emit('message:new', message);
            }
          }
        }

        // ── Template status updates ──────────────────────────────────────
        if (value.message_template_status_update) {
          const update = value.message_template_status_update;
          await prisma.messageTemplate.updateMany({
            where: { name: update.message_template_name },
            data: { status: mapMetaStatus(update.event) },
          });
        }
      }
    }

    res.sendStatus(200);
  } catch (error: any) {
    logger.error('Webhook processing error', error);
    res.sendStatus(200); // Always 200 to prevent Meta from retrying
  }
};

// ─── Get media URL from a media ID ────────────────────────────────────────
export const getMediaUrl = async (req: AuthRequest, res: Response) => {
  try {
    const { mediaId, accountId } = req.query as any;
    const account = await prisma.whatsAppAccount.findFirst({
      where: { id: accountId, organizationId: req.user!.organizationId },
    });
    if (!account) return res.status(404).json({ error: 'Account not found' });

    const url = await wa.getMediaUrl(mediaId, account.accessToken);
    res.json({ url });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
