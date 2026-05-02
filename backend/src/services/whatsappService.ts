import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';
import { logger } from '../utils/logger';

const WA_VERSION = process.env.WHATSAPP_API_VERSION || 'v19.0';
const GRAPH = `https://graph.facebook.com/${WA_VERSION}`;

// ─── Axios factory per account ─────────────────────────────────────────────
export function waClient(accessToken: string): AxiosInstance {
  const client = axios.create({
    baseURL: GRAPH,
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    timeout: 15000,
  });
  client.interceptors.response.use(
    r => r,
    err => {
      const meta = err.response?.data?.error;
      const msg = meta ? `[${meta.code}] ${meta.message}` : err.message;
      logger.error('WhatsApp API error', { msg, url: err.config?.url });
      throw new Error(msg);
    }
  );
  return client;
}

// ─── Verify credentials & get phone info ──────────────────────────────────
export async function verifyAccount(phoneNumberId: string, accessToken: string) {
  const client = waClient(accessToken);
  const { data } = await client.get(`/${phoneNumberId}`, {
    params: { fields: 'id,display_phone_number,verified_name,quality_rating,platform_type,throughput,webhook_configuration,name_status' },
  });
  return data;
}

// ─── Get Business Profile ─────────────────────────────────────────────────
export async function getBusinessProfile(phoneNumberId: string, accessToken: string) {
  const client = waClient(accessToken);
  const { data } = await client.get(`/${phoneNumberId}/whatsapp_business_profile`, {
    params: { fields: 'about,address,description,email,profile_picture_url,websites,vertical' },
  });
  return data.data?.[0] || {};
}

// ─── Update Business Profile ──────────────────────────────────────────────
export async function updateBusinessProfile(
  phoneNumberId: string,
  accessToken: string,
  profile: {
    about?: string;
    address?: string;
    description?: string;
    email?: string;
    websites?: string[];
    vertical?: string;
  }
) {
  const client = waClient(accessToken);
  const { data } = await client.post(`/${phoneNumberId}/whatsapp_business_profile`, {
    messaging_product: 'whatsapp',
    ...profile,
  });
  return data;
}

// ─── Send Text Message ────────────────────────────────────────────────────
export async function sendText(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  text: string,
  previewUrl = false
) {
  const client = waClient(accessToken);
  const { data } = await client.post(`/${phoneNumberId}/messages`, {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'text',
    text: { body: text, preview_url: previewUrl },
  });
  return data;
}

// ─── Send Template Message ────────────────────────────────────────────────
export async function sendTemplate(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  templateName: string,
  languageCode: string,
  components: any[] = []
) {
  const client = waClient(accessToken);
  const { data } = await client.post(`/${phoneNumberId}/messages`, {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: { name: templateName, language: { code: languageCode }, components },
  });
  return data;
}

// ─── Send Image ───────────────────────────────────────────────────────────
export async function sendImage(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  imageUrl: string,
  caption?: string
) {
  const client = waClient(accessToken);
  const { data } = await client.post(`/${phoneNumberId}/messages`, {
    messaging_product: 'whatsapp',
    to,
    type: 'image',
    image: { link: imageUrl, ...(caption && { caption }) },
  });
  return data;
}

// ─── Send Document ────────────────────────────────────────────────────────
export async function sendDocument(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  documentUrl: string,
  filename: string,
  caption?: string
) {
  const client = waClient(accessToken);
  const { data } = await client.post(`/${phoneNumberId}/messages`, {
    messaging_product: 'whatsapp',
    to,
    type: 'document',
    document: { link: documentUrl, filename, ...(caption && { caption }) },
  });
  return data;
}

// ─── Send Audio ───────────────────────────────────────────────────────────
export async function sendAudio(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  audioUrl: string
) {
  const client = waClient(accessToken);
  const { data } = await client.post(`/${phoneNumberId}/messages`, {
    messaging_product: 'whatsapp',
    to,
    type: 'audio',
    audio: { link: audioUrl },
  });
  return data;
}

// ─── Send Video ───────────────────────────────────────────────────────────
export async function sendVideo(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  videoUrl: string,
  caption?: string
) {
  const client = waClient(accessToken);
  const { data } = await client.post(`/${phoneNumberId}/messages`, {
    messaging_product: 'whatsapp',
    to,
    type: 'video',
    video: { link: videoUrl, ...(caption && { caption }) },
  });
  return data;
}

// ─── Send Location ────────────────────────────────────────────────────────
export async function sendLocation(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  lat: number,
  lng: number,
  name?: string,
  address?: string
) {
  const client = waClient(accessToken);
  const { data } = await client.post(`/${phoneNumberId}/messages`, {
    messaging_product: 'whatsapp',
    to,
    type: 'location',
    location: { latitude: lat, longitude: lng, ...(name && { name }), ...(address && { address }) },
  });
  return data;
}

// ─── Send Interactive Buttons ─────────────────────────────────────────────
export async function sendInteractiveButtons(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  bodyText: string,
  buttons: { id: string; title: string }[],
  headerText?: string,
  footerText?: string
) {
  const client = waClient(accessToken);
  const { data } = await client.post(`/${phoneNumberId}/messages`, {
    messaging_product: 'whatsapp',
    to,
    type: 'interactive',
    interactive: {
      type: 'button',
      ...(headerText && { header: { type: 'text', text: headerText } }),
      body: { text: bodyText },
      ...(footerText && { footer: { text: footerText } }),
      action: {
        buttons: buttons.map(b => ({ type: 'reply', reply: { id: b.id, title: b.title } })),
      },
    },
  });
  return data;
}

// ─── Send Interactive List ────────────────────────────────────────────────
export async function sendInteractiveList(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  bodyText: string,
  buttonLabel: string,
  sections: { title: string; rows: { id: string; title: string; description?: string }[] }[]
) {
  const client = waClient(accessToken);
  const { data } = await client.post(`/${phoneNumberId}/messages`, {
    messaging_product: 'whatsapp',
    to,
    type: 'interactive',
    interactive: {
      type: 'list',
      body: { text: bodyText },
      action: { button: buttonLabel, sections },
    },
  });
  return data;
}

// ─── Mark message as read ────────────────────────────────────────────────
export async function markMessageRead(
  phoneNumberId: string,
  accessToken: string,
  messageId: string
) {
  const client = waClient(accessToken);
  const { data } = await client.post(`/${phoneNumberId}/messages`, {
    messaging_product: 'whatsapp',
    status: 'read',
    message_id: messageId,
  });
  return data;
}

// ─── React to a message ───────────────────────────────────────────────────
export async function sendReaction(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  messageId: string,
  emoji: string
) {
  const client = waClient(accessToken);
  const { data } = await client.post(`/${phoneNumberId}/messages`, {
    messaging_product: 'whatsapp',
    to,
    type: 'reaction',
    reaction: { message_id: messageId, emoji },
  });
  return data;
}

// ─── Get Media URL from media ID ─────────────────────────────────────────
export async function getMediaUrl(mediaId: string, accessToken: string) {
  const client = waClient(accessToken);
  const { data } = await client.get(`/${mediaId}`);
  return data.url as string;
}

// ─── Download media ───────────────────────────────────────────────────────
export async function downloadMedia(mediaUrl: string, accessToken: string): Promise<Buffer> {
  const response = await axios.get(mediaUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
    responseType: 'arraybuffer',
  });
  return Buffer.from(response.data);
}

// ─── Fetch templates from Meta ────────────────────────────────────────────
export async function fetchTemplatesFromMeta(
  businessAccountId: string,
  accessToken: string
) {
  const client = waClient(accessToken);
  const { data } = await client.get(`/${businessAccountId}/message_templates`, {
    params: { fields: 'name,status,category,language,components,quality_score,rejected_reason', limit: 200 },
  });
  return data.data as any[];
}

// ─── Delete a template ────────────────────────────────────────────────────
export async function deleteTemplate(
  businessAccountId: string,
  accessToken: string,
  templateName: string
) {
  const client = waClient(accessToken);
  const { data } = await client.delete(`/${businessAccountId}/message_templates`, {
    params: { name: templateName },
  });
  return data;
}

// ─── Get phone number quality ─────────────────────────────────────────────
export async function getPhoneQuality(phoneNumberId: string, accessToken: string) {
  const client = waClient(accessToken);
  const { data } = await client.get(`/${phoneNumberId}`, {
    params: { fields: 'quality_rating,messaging_limit_tier,platform_type' },
  });
  return data;
}

// ─── Webhook signature validation ────────────────────────────────────────
export function validateWebhookSignature(
  rawBody: string,
  signature: string,
  appSecret: string
): boolean {
  try {
    const expected = 'sha256=' + crypto
      .createHmac('sha256', appSecret)
      .update(rawBody)
      .digest('hex');
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

// ─── Upload media to WhatsApp ─────────────────────────────────────────────
export async function uploadMedia(
  phoneNumberId: string,
  accessToken: string,
  fileBuffer: Buffer,
  mimeType: string,
  filename: string
) {
  const FormData = (await import('form-data')).default;
  const form = new FormData();
  form.append('messaging_product', 'whatsapp');
  form.append('type', mimeType);
  form.append('file', fileBuffer, { filename, contentType: mimeType });

  const response = await axios.post(`${GRAPH}/${phoneNumberId}/media`, form, {
    headers: { Authorization: `Bearer ${accessToken}`, ...form.getHeaders() },
  });
  return response.data.id as string;
}
