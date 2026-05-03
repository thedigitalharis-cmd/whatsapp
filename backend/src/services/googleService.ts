import { google } from 'googleapis';
import { logger } from '../utils/logger';

// ─── Google Sheets ────────────────────────────────────────────────────────────

export async function exportContactsToSheet(params: {
  accessToken: string;
  spreadsheetId?: string;
  sheetName?: string;
  contacts: any[];
}): Promise<{ spreadsheetId: string; url: string }> {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: params.accessToken });
  const sheets = google.sheets({ version: 'v4', auth });

  let spreadsheetId = params.spreadsheetId;

  // Create new spreadsheet if not provided
  if (!spreadsheetId) {
    const ss = await sheets.spreadsheets.create({
      requestBody: {
        properties: { title: `WhatsApp CRM Contacts - ${new Date().toLocaleDateString()}` },
        sheets: [{ properties: { title: params.sheetName || 'Contacts' } }],
      },
    });
    spreadsheetId = ss.data.spreadsheetId!;
  }

  // Build rows
  const headers = ['Name', 'Phone', 'Email', 'Company', 'Job Title', 'Source', 'Tags', 'GDPR', 'Created'];
  const rows = params.contacts.map(c => [
    `${c.firstName} ${c.lastName || ''}`.trim(),
    c.phone,
    c.email || '',
    c.company || '',
    c.jobTitle || '',
    c.source || '',
    (c.tags || []).map((t: any) => t.name).join(', '),
    c.gdprConsent ? 'Yes' : 'No',
    new Date(c.createdAt).toLocaleDateString(),
  ]);

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `A1:I${rows.length + 1}`,
    valueInputOption: 'RAW',
    requestBody: { values: [headers, ...rows] },
  });

  return {
    spreadsheetId,
    url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
  };
}

// Append new contact row to sheet
export async function appendContactToSheet(params: {
  accessToken: string;
  spreadsheetId: string;
  contact: any;
}): Promise<void> {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: params.accessToken });
  const sheets = google.sheets({ version: 'v4', auth });
  const c = params.contact;

  await sheets.spreadsheets.values.append({
    spreadsheetId: params.spreadsheetId,
    range: 'A:I',
    valueInputOption: 'RAW',
    requestBody: {
      values: [[
        `${c.firstName} ${c.lastName || ''}`.trim(),
        c.phone, c.email || '', c.company || '',
        c.jobTitle || '', c.source || '',
        (c.tags || []).map((t: any) => t.name).join(', '),
        c.gdprConsent ? 'Yes' : 'No',
        new Date(c.createdAt).toLocaleDateString(),
      ]],
    },
  });
}

// ─── Google Calendar ──────────────────────────────────────────────────────────

export async function createCalendarEvent(params: {
  accessToken: string;
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  attendeeEmails?: string[];
  location?: string;
  calendarId?: string;
}): Promise<{ eventId: string; url: string }> {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: params.accessToken });
  const calendar = google.calendar({ version: 'v3', auth });

  const event = await calendar.events.insert({
    calendarId: params.calendarId || 'primary',
    sendNotifications: true,
    requestBody: {
      summary: params.title,
      description: params.description,
      location: params.location,
      start: { dateTime: params.startTime.toISOString(), timeZone: 'UTC' },
      end: { dateTime: params.endTime.toISOString(), timeZone: 'UTC' },
      attendees: (params.attendeeEmails || []).map(email => ({ email })),
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 60 },
          { method: 'popup', minutes: 15 },
        ],
      },
    },
  });

  return {
    eventId: event.data.id!,
    url: event.data.htmlLink!,
  };
}

export async function listCalendarEvents(params: {
  accessToken: string;
  calendarId?: string;
  timeMin?: Date;
  timeMax?: Date;
  maxResults?: number;
}): Promise<any[]> {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: params.accessToken });
  const calendar = google.calendar({ version: 'v3', auth });

  const res = await calendar.events.list({
    calendarId: params.calendarId || 'primary',
    timeMin: (params.timeMin || new Date()).toISOString(),
    timeMax: params.timeMax?.toISOString(),
    maxResults: params.maxResults || 20,
    singleEvents: true,
    orderBy: 'startTime',
  });

  return res.data.items || [];
}

// Generate Google OAuth URL
export function getGoogleOAuthUrl(clientId: string, redirectUri: string, scopes: string[]): string {
  const oauth2Client = new google.auth.OAuth2(clientId, undefined, redirectUri);
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent',
  });
}

// Exchange code for tokens
export async function exchangeGoogleCode(
  clientId: string,
  clientSecret: string,
  redirectUri: string,
  code: string
): Promise<{ access_token: string; refresh_token: string; expiry_date: number }> {
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  const { tokens } = await oauth2Client.getToken(code);
  return tokens as any;
}
