export declare function exportContactsToSheet(params: {
    accessToken: string;
    spreadsheetId?: string;
    sheetName?: string;
    contacts: any[];
}): Promise<{
    spreadsheetId: string;
    url: string;
}>;
export declare function appendContactToSheet(params: {
    accessToken: string;
    spreadsheetId: string;
    contact: any;
}): Promise<void>;
export declare function createCalendarEvent(params: {
    accessToken: string;
    title: string;
    description?: string;
    startTime: Date;
    endTime: Date;
    attendeeEmails?: string[];
    location?: string;
    calendarId?: string;
}): Promise<{
    eventId: string;
    url: string;
}>;
export declare function listCalendarEvents(params: {
    accessToken: string;
    calendarId?: string;
    timeMin?: Date;
    timeMax?: Date;
    maxResults?: number;
}): Promise<any[]>;
export declare function getGoogleOAuthUrl(clientId: string, redirectUri: string, scopes: string[]): string;
export declare function exchangeGoogleCode(clientId: string, clientSecret: string, redirectUri: string, code: string): Promise<{
    access_token: string;
    refresh_token: string;
    expiry_date: number;
}>;
//# sourceMappingURL=googleService.d.ts.map