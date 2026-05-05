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
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = require("../config/database");
const auth_1 = require("../middleware/auth");
const stripeService_1 = require("../services/stripeService");
const googleService_1 = require("../services/googleService");
const router = (0, express_1.Router)();
// ─── Stripe ───────────────────────────────────────────────────────────────────
router.post('/stripe/configure', (0, auth_1.requireRole)('ADMIN', 'SUPER_ADMIN'), async (req, res) => {
    try {
        const { secretKey } = req.body;
        const valid = await (0, stripeService_1.validateStripeKey)(secretKey);
        if (!valid)
            return res.status(400).json({ error: 'Invalid Stripe key' });
        (0, stripeService_1.reinitStripe)(secretKey);
        process.env.STRIPE_SECRET_KEY = secretKey;
        // Persist to DB
        await database_1.prisma.integration.upsert({
            where: { organizationId_type: { organizationId: req.user.organizationId, type: 'STRIPE' } },
            update: { config: { secretKey: secretKey.slice(0, 8) + '••••' }, isActive: true },
            create: { organizationId: req.user.organizationId, type: 'STRIPE', name: 'Stripe', config: { secretKey: secretKey.slice(0, 8) + '••••' }, isActive: true },
        });
        res.json({ success: true, message: 'Stripe connected!' });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.post('/stripe/payment-link', async (req, res) => {
    try {
        const { amount, currency, description, customerEmail, customerName, contactId, conversationId } = req.body;
        const link = await (0, stripeService_1.createPaymentLink)({ amount, currency, description, customerEmail, customerName,
            metadata: { organizationId: req.user.organizationId, contactId: contactId || '', conversationId: conversationId || '' },
        });
        res.json(link);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.post('/stripe/invoice', async (req, res) => {
    try {
        const { customerEmail, customerName, amount, currency, description } = req.body;
        if (!customerEmail)
            return res.status(400).json({ error: 'Customer email required for Stripe invoice' });
        const invoice = await (0, stripeService_1.createAndSendInvoice)({ customerEmail, customerName, amount, currency, description });
        res.json(invoice);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// ─── Zapier ───────────────────────────────────────────────────────────────────
router.post('/zapier/configure', (0, auth_1.requireRole)('ADMIN', 'SUPER_ADMIN'), async (req, res) => {
    try {
        const { webhookUrl, events } = req.body;
        // Test the webhook
        const axios = (await Promise.resolve().then(() => __importStar(require('axios')))).default;
        await axios.post(webhookUrl, {
            event: 'test',
            message: 'WhatsApp CRM connected successfully!',
            timestamp: new Date().toISOString(),
        });
        await database_1.prisma.webhook.upsert({
            where: { id: `zapier-${req.user.organizationId}` },
            update: { url: webhookUrl, events: events || ['*'], isActive: true },
            create: {
                id: `zapier-${req.user.organizationId}`,
                organizationId: req.user.organizationId,
                name: 'Zapier',
                url: webhookUrl,
                events: events || ['*'],
                isActive: true,
            },
        });
        res.json({ success: true, message: 'Zapier webhook connected and tested!' });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.post('/zapier/test', async (req, res) => {
    try {
        const { webhookUrl } = req.body;
        const axios = (await Promise.resolve().then(() => __importStar(require('axios')))).default;
        const result = await axios.post(webhookUrl, {
            event: 'test.ping',
            data: { message: 'Test from WhatsApp CRM', organizationId: req.user.organizationId },
            timestamp: new Date().toISOString(),
        });
        res.json({ success: true, status: result.status });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// ─── Google Sheets ────────────────────────────────────────────────────────────
router.post('/google/sheets/export-contacts', async (req, res) => {
    try {
        const { accessToken, spreadsheetId } = req.body;
        const contacts = await database_1.prisma.contact.findMany({
            where: { organizationId: req.user.organizationId },
            include: { tags: true },
            orderBy: { createdAt: 'desc' },
        });
        const result = await (0, googleService_1.exportContactsToSheet)({ accessToken, spreadsheetId, contacts });
        res.json({ ...result, exported: contacts.length });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.post('/google/sheets/configure', (0, auth_1.requireRole)('ADMIN', 'SUPER_ADMIN'), async (req, res) => {
    try {
        const { accessToken, spreadsheetId, autoSync } = req.body;
        await database_1.prisma.integration.upsert({
            where: { organizationId_type: { organizationId: req.user.organizationId, type: 'CUSTOM_WEBHOOK' } },
            update: { config: { googleSheetsToken: accessToken, spreadsheetId, autoSync }, isActive: true },
            create: {
                organizationId: req.user.organizationId,
                type: 'CUSTOM_WEBHOOK',
                name: 'Google Sheets',
                config: { googleSheetsToken: accessToken, spreadsheetId, autoSync },
                isActive: true,
            },
        });
        res.json({ success: true });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// ─── Google Calendar ──────────────────────────────────────────────────────────
router.post('/google/calendar/events', async (req, res) => {
    try {
        const { accessToken, title, description, startTime, endTime, attendeeEmails, location } = req.body;
        const event = await (0, googleService_1.createCalendarEvent)({
            accessToken,
            title,
            description,
            startTime: new Date(startTime),
            endTime: new Date(endTime),
            attendeeEmails,
            location,
        });
        res.json(event);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.post('/google/calendar/list', async (req, res) => {
    try {
        const { accessToken, timeMin, timeMax } = req.body;
        const events = await (0, googleService_1.listCalendarEvents)({
            accessToken,
            timeMin: timeMin ? new Date(timeMin) : undefined,
            timeMax: timeMax ? new Date(timeMax) : undefined,
        });
        res.json(events);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// Google OAuth URL
router.get('/google/oauth-url', async (req, res) => {
    try {
        const clientId = process.env.GOOGLE_CLIENT_ID;
        if (!clientId)
            return res.status(400).json({ error: 'Google Client ID not configured' });
        const redirectUri = `${process.env.FRONTEND_URL}/settings/integrations?google_callback=1`;
        const scopes = [
            'https://www.googleapis.com/auth/spreadsheets',
            'https://www.googleapis.com/auth/calendar',
            'https://www.googleapis.com/auth/userinfo.email',
        ];
        const url = (0, googleService_1.getGoogleOAuthUrl)(clientId, redirectUri, scopes);
        res.json({ url });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// Google OAuth callback
router.post('/google/oauth-callback', async (req, res) => {
    try {
        const { code } = req.body;
        const tokens = await (0, googleService_1.exchangeGoogleCode)(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, `${process.env.FRONTEND_URL}/settings/integrations?google_callback=1`, code);
        // Save tokens to integration
        await database_1.prisma.integration.upsert({
            where: { organizationId_type: { organizationId: req.user.organizationId, type: 'GOOGLE_CALENDAR' } },
            update: { config: tokens, isActive: true },
            create: {
                organizationId: req.user.organizationId,
                type: 'GOOGLE_CALENDAR',
                name: 'Google',
                config: tokens,
                isActive: true,
            },
        });
        res.json({ success: true });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// Get integration status
router.get('/status', async (req, res) => {
    try {
        const integrations = await database_1.prisma.integration.findMany({
            where: { organizationId: req.user.organizationId },
        });
        const zapierWebhook = await database_1.prisma.webhook.findFirst({
            where: { organizationId: req.user.organizationId, name: 'Zapier' },
        });
        res.json({
            stripe: integrations.find(i => i.type === 'STRIPE')?.isActive || false,
            googleCalendar: integrations.find(i => i.type === 'GOOGLE_CALENDAR')?.isActive || false,
            googleSheets: integrations.find(i => i.type === 'CUSTOM_WEBHOOK' && i.config?.googleSheetsToken)?.isActive || false,
            zapier: zapierWebhook?.isActive || false,
            zapierUrl: zapierWebhook?.url || null,
            stripeConfigured: !!process.env.STRIPE_SECRET_KEY,
        });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
exports.default = router;
//# sourceMappingURL=integrations-extended.js.map