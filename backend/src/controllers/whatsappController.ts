import { Request, Response } from 'express';
import crypto from 'crypto';
import axios from 'axios';
import { prisma } from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { publicBaseUrl } from '../utils/publicUrl';
import * as wa from '../services/whatsappService';

/** Trim and strip wrapping quotes — common mistake in .env files */
function normalizeEnvSecret(s: string | undefined): string {
  if (s == null) return '';
  let t = String(s).trim();
  if (
    t.length >= 2 &&
    ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'")))
  ) {
    t = t.slice(1, -1).trim();
  }
  return t;
}

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
  const toNorm = wa.normalizeWaRecipient(to);
  if (!toNorm) {
    throw new Error('Invalid recipient phone number (empty after normalization)');
  }

  // Delegate to the typed helpers based on type
  const type = payload.type || 'text';

  switch (type) {
    case 'template':
      return wa.sendTemplate(
        phoneNumberId, accessToken, toNorm,
        payload.template.name,
        payload.template.language?.code || 'en_US',
        payload.template.components || []
      );
    case 'image':
      return wa.sendImage(phoneNumberId, accessToken, toNorm, payload.image?.link || payload.image?.url, payload.image?.caption);
    case 'document':
      return wa.sendDocument(phoneNumberId, accessToken, toNorm, payload.document?.link, payload.document?.filename || 'file', payload.document?.caption);
    case 'audio':
      return wa.sendAudio(phoneNumberId, accessToken, toNorm, payload.audio?.link);
    case 'video':
      return wa.sendVideo(phoneNumberId, accessToken, toNorm, payload.video?.link, payload.video?.caption);
    case 'location':
      return wa.sendLocation(phoneNumberId, accessToken, toNorm, payload.location?.latitude, payload.location?.longitude, payload.location?.name, payload.location?.address);
    case 'interactive':
      if (payload.interactive?.type === 'button') {
        return wa.sendInteractiveButtons(
          phoneNumberId, accessToken, toNorm,
          payload.interactive.body?.text,
          payload.interactive.action?.buttons?.map((b: any) => ({ id: b.reply.id, title: b.reply.title })),
          payload.interactive.header?.text,
          payload.interactive.footer?.text
        );
      }
      if (payload.interactive?.type === 'list') {
        return wa.sendInteractiveList(
          phoneNumberId, accessToken, toNorm,
          payload.interactive.body?.text,
          payload.interactive.action?.button,
          payload.interactive.action?.sections
        );
      }
      break;
    default:
      return wa.sendText(phoneNumberId, accessToken, toNorm, payload.text?.body || payload.content || '');
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
    // GET: Meta verification handshake — opening /webhook/whatsapp in a browser has no query params (not an error)
    if (req.method === 'GET') {
      const mode = req.query['hub.mode'];
      const token = req.query['hub.verify_token'];
      const challenge = req.query['hub.challenge'];

      if (
        (mode === undefined || mode === '') &&
        (token === undefined || token === '') &&
        (challenge === undefined || challenge === '')
      ) {
        return res
          .status(200)
          .type('text/plain')
          .send(
            'OK — WhatsApp webhook URL is reachable.\n' +
              'Meta verifies with GET ?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...\n' +
              'If inbound messages fail: set WHATSAPP_APP_SECRET in deploy/.env.production to the exact App Secret from developers.facebook.com → App settings → Basic → App secret (or leave WHATSAPP_APP_SECRET empty to disable signature check while testing).'
          );
      }

      const verifyTok = normalizeEnvSecret(process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN);
      if (mode === 'subscribe' && token === verifyTok && challenge != null && challenge !== '') {
        logger.info('WhatsApp webhook verified');
        return res.status(200).send(String(challenge));
      }
      logger.warn(
        'Webhook GET verification failed — check WHATSAPP_WEBHOOK_VERIFY_TOKEN matches Meta “Verify token” field'
      );
      return res.status(403).json({ error: 'Verification failed' });
    }

    // POST: incoming events — validate signature if app secret is set (must use raw body from express.json verify)
    const appSecret = normalizeEnvSecret(process.env.WHATSAPP_APP_SECRET);
    if (appSecret) {
      const sig = (req.headers['x-hub-signature-256'] as string) || '';
      const rawBody = (req as Request & { rawBody?: string }).rawBody;
      if (!rawBody) {
        logger.warn('Webhook: rawBody missing — cannot verify signature');
        return res.sendStatus(401);
      }
      if (!wa.validateWebhookSignature(rawBody, sig, appSecret)) {
        logger.warn(
          'Invalid webhook signature — WHATSAPP_APP_SECRET must match Meta App Secret exactly (App settings → Basic), or remove WHATSAPP_APP_SECRET from .env to disable this check for testing'
        );
        return res.sendStatus(401);
      }
    }

    const body = req.body;
    if (body.object !== 'whatsapp_business_account') {
      logger.warn(`Webhook POST ignored: object=${body?.object ?? 'undefined'}`);
      return res.sendStatus(200);
    }

    logger.info(
      `WhatsApp webhook POST ok: entries=${body.entry?.length ?? 0} (object=whatsapp_business_account)`
    );

    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        const field = String(change.field || '').trim();
        if (field !== 'messages') continue;
        const value = change.value || {};

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
          const metaPhoneId = String(value.metadata?.phone_number_id ?? '').trim();
          let account = metaPhoneId
            ? await prisma.whatsAppAccount.findFirst({ where: { phoneNumberId: metaPhoneId } })
            : null;

          const syncPhoneIdIfNeeded = async (acc: NonNullable<typeof account>) => {
            if (metaPhoneId && acc.phoneNumberId !== metaPhoneId) {
              try {
                await prisma.whatsAppAccount.update({
                  where: { id: acc.id },
                  data: { phoneNumberId: metaPhoneId },
                });
                logger.info(`Webhook: synced phoneNumberId → ${metaPhoneId} for account ${acc.id}`);
              } catch (e: any) {
                logger.warn(`Webhook: could not sync phoneNumberId: ${e.message}`);
              }
            }
          };

          // Prefer WABA (entry.id) before global display match — avoids wrong org in multi-tenant
          if (!account && entry?.id) {
            const wabaId = String(entry.id).trim();
            const byWaba = await prisma.whatsAppAccount.findMany({
              where: { businessAccountId: wabaId },
            });
            if (byWaba.length === 1) {
              account = byWaba[0];
              logger.warn(
                `Webhook: matched CRM account by WABA id=${wabaId} (single line). Meta phone_number_id=${metaPhoneId} CRM had=${account.phoneNumberId}`
              );
            } else if (byWaba.length > 1) {
              if (metaPhoneId) {
                account = byWaba.find((a) => a.phoneNumberId === metaPhoneId) || null;
              }
              if (!account && value.metadata?.display_phone_number) {
                const d = String(value.metadata.display_phone_number).replace(/\D/g, '');
                account =
                  byWaba.find((c) => {
                    const s = String(c.phoneNumber || '').replace(/\D/g, '');
                    return s === d || s.endsWith(d) || d.endsWith(s);
                  }) || null;
              }
              if (account) {
                logger.warn(
                  `Webhook: matched one of ${byWaba.length} CRM lines under WABA ${wabaId} via phone_number_id or display phone`
                );
              } else {
                logger.warn(
                  `Webhook: WABA ${wabaId} has ${byWaba.length} CRM lines; could not match phone_number_id=${metaPhoneId} display=${value.metadata?.display_phone_number}`
                );
              }
            }
            if (account) await syncPhoneIdIfNeeded(account);
          }

          // Last resort: display phone across CRM (single-tenant / one WA account setups)
          if (!account && value.metadata?.display_phone_number) {
            const displayDigits = String(value.metadata.display_phone_number).replace(/\D/g, '');
            if (displayDigits) {
              const candidates = await prisma.whatsAppAccount.findMany({
                where: { status: { in: ['ACTIVE', 'PENDING', 'SUSPENDED'] } },
                take: 50,
              });
              account =
                candidates.find((c) => {
                  const stored = String(c.phoneNumber || '').replace(/\D/g, '');
                  return stored === displayDigits || stored.endsWith(displayDigits) || displayDigits.endsWith(stored);
                }) || null;
              if (account) {
                logger.warn(
                  `Webhook: matched account by display_phone only (DB phone_number_id=${account.phoneNumberId}, Meta sent ${metaPhoneId}) — set Business account ID + Phone number ID in CRM`
                );
                await syncPhoneIdIfNeeded(account);
              }
            }
          }

          if (!account) {
            logger.warn(
              `Webhook: no WhatsAppAccount for phone_number_id=${metaPhoneId} display=${value.metadata?.display_phone_number} waba_entry=${entry?.id} — add account in CRM or check Meta → Webhooks → messages`
            );
            continue;
          }

          let storedInbound = 0;
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
                // Download audio from Meta and save locally so it's always playable
                if (msg.audio?.id) {
                  try {
                    const path = require('path');
                    const fs = require('fs');
                    const uploadDir = path.join(process.cwd(), 'uploads');
                    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

                    // Get media URL from Meta
                    const mediaInfoResp = await axios.get(
                      `https://graph.facebook.com/v19.0/${msg.audio.id}`,
                      { headers: { Authorization: `Bearer ${account.accessToken}` } }
                    );
                    const mediaDownloadUrl = mediaInfoResp.data.url;
                    const mimeType: string = mediaInfoResp.data.mime_type || 'audio/ogg';
                    const ext = mimeType.includes('ogg') ? '.ogg' : mimeType.includes('mp4') ? '.mp4' : '.webm';
                    const filename = `recv_${Date.now()}_${msg.audio.id.slice(-8)}${ext}`;
                    const filePath = path.join(uploadDir, filename);

                    // Download the audio file
                    const audioResp = await axios.get(mediaDownloadUrl, {
                      headers: { Authorization: `Bearer ${account.accessToken}` },
                      responseType: 'arraybuffer',
                    });
                    fs.writeFileSync(filePath, audioResp.data);

                    msgData.mediaUrl = `${publicBaseUrl()}/uploads/${filename}`;
                    msgData.mediaType = mimeType;
                    logger.info(`Audio saved: ${filename}`);
                  } catch (audioErr: any) {
                    logger.error(`Failed to download audio: ${audioErr.message}`);
                    msgData.mediaUrl = null;
                    msgData.mediaType = 'audio/ogg';
                  }
                }
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
            storedInbound += 1;

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
          if (storedInbound > 0) {
            logger.info(
              `Webhook: saved ${storedInbound} inbound message(s) org=${account.organizationId} conv routing ok`
            );
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
