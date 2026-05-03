import { Router, Response } from 'express';
import { prisma } from '../config/database';
import { AuthRequest, requireRole } from '../middleware/auth';
import { createPaymentLink, createAndSendInvoice, validateStripeKey, reinitStripe } from '../services/stripeService';
import { exportContactsToSheet, appendContactToSheet, createCalendarEvent, listCalendarEvents, getGoogleOAuthUrl, exchangeGoogleCode } from '../services/googleService';
import { logger } from '../utils/logger';

const router = Router();

// ─── Stripe ───────────────────────────────────────────────────────────────────

router.post('/stripe/configure', requireRole('ADMIN', 'SUPER_ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { secretKey } = req.body;
    const valid = await validateStripeKey(secretKey);
    if (!valid) return res.status(400).json({ error: 'Invalid Stripe key' });

    reinitStripe(secretKey);
    process.env.STRIPE_SECRET_KEY = secretKey;

    // Persist to DB
    await prisma.integration.upsert({
      where: { organizationId_type: { organizationId: req.user!.organizationId, type: 'STRIPE' } },
      update: { config: { secretKey: secretKey.slice(0, 8) + '••••' }, isActive: true },
      create: { organizationId: req.user!.organizationId, type: 'STRIPE', name: 'Stripe', config: { secretKey: secretKey.slice(0, 8) + '••••' }, isActive: true },
    });

    res.json({ success: true, message: 'Stripe connected!' });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/stripe/payment-link', async (req: AuthRequest, res: Response) => {
  try {
    const { amount, currency, description, customerEmail, customerName, contactId, conversationId } = req.body;
    const link = await createPaymentLink({ amount, currency, description, customerEmail, customerName,
      metadata: { organizationId: req.user!.organizationId, contactId: contactId || '', conversationId: conversationId || '' },
    });
    res.json(link);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/stripe/invoice', async (req: AuthRequest, res: Response) => {
  try {
    const { customerEmail, customerName, amount, currency, description } = req.body;
    if (!customerEmail) return res.status(400).json({ error: 'Customer email required for Stripe invoice' });
    const invoice = await createAndSendInvoice({ customerEmail, customerName, amount, currency, description });
    res.json(invoice);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ─── Zapier ───────────────────────────────────────────────────────────────────

router.post('/zapier/configure', requireRole('ADMIN', 'SUPER_ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { webhookUrl, events } = req.body;

    // Test the webhook
    const axios = (await import('axios')).default;
    await axios.post(webhookUrl, {
      event: 'test',
      message: 'WhatsApp CRM connected successfully!',
      timestamp: new Date().toISOString(),
    });

    await prisma.webhook.upsert({
      where: { id: `zapier-${req.user!.organizationId}` },
      update: { url: webhookUrl, events: events || ['*'], isActive: true },
      create: {
        id: `zapier-${req.user!.organizationId}`,
        organizationId: req.user!.organizationId,
        name: 'Zapier',
        url: webhookUrl,
        events: events || ['*'],
        isActive: true,
      },
    });

    res.json({ success: true, message: 'Zapier webhook connected and tested!' });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/zapier/test', async (req: AuthRequest, res: Response) => {
  try {
    const { webhookUrl } = req.body;
    const axios = (await import('axios')).default;
    const result = await axios.post(webhookUrl, {
      event: 'test.ping',
      data: { message: 'Test from WhatsApp CRM', organizationId: req.user!.organizationId },
      timestamp: new Date().toISOString(),
    });
    res.json({ success: true, status: result.status });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ─── Google Sheets ────────────────────────────────────────────────────────────

router.post('/google/sheets/export-contacts', async (req: AuthRequest, res: Response) => {
  try {
    const { accessToken, spreadsheetId } = req.body;

    const contacts = await prisma.contact.findMany({
      where: { organizationId: req.user!.organizationId },
      include: { tags: true },
      orderBy: { createdAt: 'desc' },
    });

    const result = await exportContactsToSheet({ accessToken, spreadsheetId, contacts });

    res.json({ ...result, exported: contacts.length });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/google/sheets/configure', requireRole('ADMIN', 'SUPER_ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { accessToken, spreadsheetId, autoSync } = req.body;

    await prisma.integration.upsert({
      where: { organizationId_type: { organizationId: req.user!.organizationId, type: 'CUSTOM_WEBHOOK' } },
      update: { config: { googleSheetsToken: accessToken, spreadsheetId, autoSync }, isActive: true },
      create: {
        organizationId: req.user!.organizationId,
        type: 'CUSTOM_WEBHOOK',
        name: 'Google Sheets',
        config: { googleSheetsToken: accessToken, spreadsheetId, autoSync },
        isActive: true,
      },
    });

    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ─── Google Calendar ──────────────────────────────────────────────────────────

router.post('/google/calendar/events', async (req: AuthRequest, res: Response) => {
  try {
    const { accessToken, title, description, startTime, endTime, attendeeEmails, location } = req.body;

    const event = await createCalendarEvent({
      accessToken,
      title,
      description,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      attendeeEmails,
      location,
    });

    res.json(event);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/google/calendar/list', async (req: AuthRequest, res: Response) => {
  try {
    const { accessToken, timeMin, timeMax } = req.body;
    const events = await listCalendarEvents({
      accessToken,
      timeMin: timeMin ? new Date(timeMin) : undefined,
      timeMax: timeMax ? new Date(timeMax) : undefined,
    });
    res.json(events);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Google OAuth URL
router.get('/google/oauth-url', async (req: AuthRequest, res: Response) => {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) return res.status(400).json({ error: 'Google Client ID not configured' });

    const redirectUri = `${process.env.FRONTEND_URL}/settings/integrations?google_callback=1`;
    const scopes = [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/userinfo.email',
    ];
    const url = getGoogleOAuthUrl(clientId, redirectUri, scopes);
    res.json({ url });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Google OAuth callback
router.post('/google/oauth-callback', async (req: AuthRequest, res: Response) => {
  try {
    const { code } = req.body;
    const tokens = await exchangeGoogleCode(
      process.env.GOOGLE_CLIENT_ID!,
      process.env.GOOGLE_CLIENT_SECRET!,
      `${process.env.FRONTEND_URL}/settings/integrations?google_callback=1`,
      code
    );

    // Save tokens to integration
    await prisma.integration.upsert({
      where: { organizationId_type: { organizationId: req.user!.organizationId, type: 'GOOGLE_CALENDAR' } },
      update: { config: tokens, isActive: true },
      create: {
        organizationId: req.user!.organizationId,
        type: 'GOOGLE_CALENDAR',
        name: 'Google',
        config: tokens,
        isActive: true,
      },
    });

    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Get integration status
router.get('/status', async (req: AuthRequest, res: Response) => {
  try {
    const integrations = await prisma.integration.findMany({
      where: { organizationId: req.user!.organizationId },
    });

    const zapierWebhook = await prisma.webhook.findFirst({
      where: { organizationId: req.user!.organizationId, name: 'Zapier' },
    });

    res.json({
      stripe: integrations.find(i => i.type === 'STRIPE')?.isActive || false,
      googleCalendar: integrations.find(i => i.type === 'GOOGLE_CALENDAR')?.isActive || false,
      googleSheets: integrations.find(i => i.type === 'CUSTOM_WEBHOOK' && (i.config as any)?.googleSheetsToken)?.isActive || false,
      zapier: zapierWebhook?.isActive || false,
      zapierUrl: zapierWebhook?.url || null,
      stripeConfigured: !!process.env.STRIPE_SECRET_KEY,
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
