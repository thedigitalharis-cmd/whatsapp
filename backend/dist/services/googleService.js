"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportContactsToSheet = exportContactsToSheet;
exports.appendContactToSheet = appendContactToSheet;
exports.createCalendarEvent = createCalendarEvent;
exports.listCalendarEvents = listCalendarEvents;
exports.getGoogleOAuthUrl = getGoogleOAuthUrl;
exports.exchangeGoogleCode = exchangeGoogleCode;
const googleapis_1 = require("googleapis");
// ─── Google Sheets ────────────────────────────────────────────────────────────
async function exportContactsToSheet(params) {
    const auth = new googleapis_1.google.auth.OAuth2();
    auth.setCredentials({ access_token: params.accessToken });
    const sheets = googleapis_1.google.sheets({ version: 'v4', auth });
    let spreadsheetId = params.spreadsheetId;
    // Create new spreadsheet if not provided
    if (!spreadsheetId) {
        const ss = await sheets.spreadsheets.create({
            requestBody: {
                properties: { title: `WhatsApp CRM Contacts - ${new Date().toLocaleDateString()}` },
                sheets: [{ properties: { title: params.sheetName || 'Contacts' } }],
            },
        });
        spreadsheetId = ss.data.spreadsheetId;
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
        (c.tags || []).map((t) => t.name).join(', '),
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
async function appendContactToSheet(params) {
    const auth = new googleapis_1.google.auth.OAuth2();
    auth.setCredentials({ access_token: params.accessToken });
    const sheets = googleapis_1.google.sheets({ version: 'v4', auth });
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
                    (c.tags || []).map((t) => t.name).join(', '),
                    c.gdprConsent ? 'Yes' : 'No',
                    new Date(c.createdAt).toLocaleDateString(),
                ]],
        },
    });
}
// ─── Google Calendar ──────────────────────────────────────────────────────────
async function createCalendarEvent(params) {
    const auth = new googleapis_1.google.auth.OAuth2();
    auth.setCredentials({ access_token: params.accessToken });
    const calendar = googleapis_1.google.calendar({ version: 'v3', auth });
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
        eventId: event.data.id,
        url: event.data.htmlLink,
    };
}
async function listCalendarEvents(params) {
    const auth = new googleapis_1.google.auth.OAuth2();
    auth.setCredentials({ access_token: params.accessToken });
    const calendar = googleapis_1.google.calendar({ version: 'v3', auth });
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
function getGoogleOAuthUrl(clientId, redirectUri, scopes) {
    const oauth2Client = new googleapis_1.google.auth.OAuth2(clientId, undefined, redirectUri);
    return oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: scopes,
        prompt: 'consent',
    });
}
// Exchange code for tokens
async function exchangeGoogleCode(clientId, clientSecret, redirectUri, code) {
    const oauth2Client = new googleapis_1.google.auth.OAuth2(clientId, clientSecret, redirectUri);
    const { tokens } = await oauth2Client.getToken(code);
    return tokens;
}
//# sourceMappingURL=googleService.js.map