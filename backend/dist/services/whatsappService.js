"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeWaRecipient = normalizeWaRecipient;
exports.waClient = waClient;
exports.verifyAccount = verifyAccount;
exports.getBusinessProfile = getBusinessProfile;
exports.updateBusinessProfile = updateBusinessProfile;
exports.sendText = sendText;
exports.sendTemplate = sendTemplate;
exports.sendImage = sendImage;
exports.sendDocument = sendDocument;
exports.sendAudio = sendAudio;
exports.sendVideo = sendVideo;
exports.sendLocation = sendLocation;
exports.sendInteractiveButtons = sendInteractiveButtons;
exports.sendInteractiveList = sendInteractiveList;
exports.markMessageRead = markMessageRead;
exports.sendReaction = sendReaction;
exports.getMediaUrl = getMediaUrl;
exports.downloadMedia = downloadMedia;
exports.fetchTemplatesFromMeta = fetchTemplatesFromMeta;
exports.deleteTemplate = deleteTemplate;
exports.getPhoneQuality = getPhoneQuality;
exports.validateWebhookSignature = validateWebhookSignature;
exports.uploadMedia = uploadMedia;
const axios_1 = __importDefault(require("axios"));
const crypto_1 = __importDefault(require("crypto"));
const logger_1 = require("../utils/logger");
const WA_VERSION = process.env.WHATSAPP_API_VERSION || 'v19.0';
const GRAPH = `https://graph.facebook.com/${WA_VERSION}`;
/** Cloud API expects international number with digits only (no +, spaces, or dashes). */
function normalizeWaRecipient(phone) {
    if (!phone)
        return '';
    return String(phone).replace(/\D/g, '');
}
// ─── Axios factory per account ─────────────────────────────────────────────
function waClient(accessToken) {
    const client = axios_1.default.create({
        baseURL: GRAPH,
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        timeout: 15000,
    });
    client.interceptors.response.use(r => r, err => {
        const meta = err.response?.data?.error;
        const msg = meta ? `[${meta.code}] ${meta.message}` : err.message;
        logger_1.logger.error('WhatsApp API error', { msg, url: err.config?.url });
        throw new Error(msg);
    });
    return client;
}
// ─── Verify credentials & get phone info ──────────────────────────────────
async function verifyAccount(phoneNumberId, accessToken) {
    const client = waClient(accessToken);
    const { data } = await client.get(`/${phoneNumberId}`, {
        params: { fields: 'id,display_phone_number,verified_name,quality_rating,platform_type,throughput,webhook_configuration,name_status' },
    });
    return data;
}
// ─── Get Business Profile ─────────────────────────────────────────────────
async function getBusinessProfile(phoneNumberId, accessToken) {
    const client = waClient(accessToken);
    const { data } = await client.get(`/${phoneNumberId}/whatsapp_business_profile`, {
        params: { fields: 'about,address,description,email,profile_picture_url,websites,vertical' },
    });
    return data.data?.[0] || {};
}
// ─── Update Business Profile ──────────────────────────────────────────────
async function updateBusinessProfile(phoneNumberId, accessToken, profile) {
    const client = waClient(accessToken);
    const { data } = await client.post(`/${phoneNumberId}/whatsapp_business_profile`, {
        messaging_product: 'whatsapp',
        ...profile,
    });
    return data;
}
// ─── Send Text Message ────────────────────────────────────────────────────
async function sendText(phoneNumberId, accessToken, to, text, previewUrl = false) {
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
async function sendTemplate(phoneNumberId, accessToken, to, templateName, languageCode, components = []) {
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
async function sendImage(phoneNumberId, accessToken, to, imageUrl, caption) {
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
async function sendDocument(phoneNumberId, accessToken, to, documentUrl, filename, caption) {
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
async function sendAudio(phoneNumberId, accessToken, to, audioUrl) {
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
async function sendVideo(phoneNumberId, accessToken, to, videoUrl, caption) {
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
async function sendLocation(phoneNumberId, accessToken, to, lat, lng, name, address) {
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
async function sendInteractiveButtons(phoneNumberId, accessToken, to, bodyText, buttons, headerText, footerText) {
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
async function sendInteractiveList(phoneNumberId, accessToken, to, bodyText, buttonLabel, sections) {
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
async function markMessageRead(phoneNumberId, accessToken, messageId) {
    const client = waClient(accessToken);
    const { data } = await client.post(`/${phoneNumberId}/messages`, {
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: messageId,
    });
    return data;
}
// ─── React to a message ───────────────────────────────────────────────────
async function sendReaction(phoneNumberId, accessToken, to, messageId, emoji) {
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
async function getMediaUrl(mediaId, accessToken) {
    const client = waClient(accessToken);
    const { data } = await client.get(`/${mediaId}`);
    return data.url;
}
// ─── Download media ───────────────────────────────────────────────────────
async function downloadMedia(mediaUrl, accessToken) {
    const response = await axios_1.default.get(mediaUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
        responseType: 'arraybuffer',
    });
    return Buffer.from(response.data);
}
// ─── Fetch templates from Meta ────────────────────────────────────────────
async function fetchTemplatesFromMeta(businessAccountId, accessToken) {
    const client = waClient(accessToken);
    const { data } = await client.get(`/${businessAccountId}/message_templates`, {
        params: { fields: 'name,status,category,language,components,quality_score,rejected_reason', limit: 200 },
    });
    return data.data;
}
// ─── Delete a template ────────────────────────────────────────────────────
async function deleteTemplate(businessAccountId, accessToken, templateName) {
    const client = waClient(accessToken);
    const { data } = await client.delete(`/${businessAccountId}/message_templates`, {
        params: { name: templateName },
    });
    return data;
}
// ─── Get phone number quality ─────────────────────────────────────────────
async function getPhoneQuality(phoneNumberId, accessToken) {
    const client = waClient(accessToken);
    const { data } = await client.get(`/${phoneNumberId}`, {
        params: { fields: 'quality_rating,messaging_limit_tier,platform_type' },
    });
    return data;
}
// ─── Webhook signature validation ────────────────────────────────────────
function validateWebhookSignature(rawBody, signature, appSecret) {
    try {
        const secret = String(appSecret || '').trim();
        if (!secret || !signature || !rawBody)
            return false;
        const expected = 'sha256=' + crypto_1.default
            .createHmac('sha256', secret)
            .update(rawBody, 'utf8')
            .digest('hex');
        const sig = String(signature).trim();
        return crypto_1.default.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
    }
    catch {
        return false;
    }
}
// ─── Upload media to WhatsApp ─────────────────────────────────────────────
async function uploadMedia(phoneNumberId, accessToken, fileBuffer, mimeType, filename) {
    const FormData = (await Promise.resolve().then(() => __importStar(require('form-data')))).default;
    const form = new FormData();
    form.append('messaging_product', 'whatsapp');
    form.append('type', mimeType);
    form.append('file', fileBuffer, { filename, contentType: mimeType });
    const response = await axios_1.default.post(`${GRAPH}/${phoneNumberId}/media`, form, {
        headers: { Authorization: `Bearer ${accessToken}`, ...form.getHeaders() },
    });
    return response.data.id;
}
//# sourceMappingURL=whatsappService.js.map