import { AxiosInstance } from 'axios';
/** Cloud API expects international number with digits only (no +, spaces, or dashes). */
export declare function normalizeWaRecipient(phone: string): string;
export declare function waClient(accessToken: string): AxiosInstance;
export declare function verifyAccount(phoneNumberId: string, accessToken: string): Promise<any>;
export declare function getBusinessProfile(phoneNumberId: string, accessToken: string): Promise<any>;
export declare function updateBusinessProfile(phoneNumberId: string, accessToken: string, profile: {
    about?: string;
    address?: string;
    description?: string;
    email?: string;
    websites?: string[];
    vertical?: string;
}): Promise<any>;
export declare function sendText(phoneNumberId: string, accessToken: string, to: string, text: string, previewUrl?: boolean): Promise<any>;
export declare function sendTemplate(phoneNumberId: string, accessToken: string, to: string, templateName: string, languageCode: string, components?: any[]): Promise<any>;
export declare function sendImage(phoneNumberId: string, accessToken: string, to: string, imageUrl: string, caption?: string): Promise<any>;
export declare function sendDocument(phoneNumberId: string, accessToken: string, to: string, documentUrl: string, filename: string, caption?: string): Promise<any>;
export declare function sendAudio(phoneNumberId: string, accessToken: string, to: string, audioUrl: string): Promise<any>;
export declare function sendVideo(phoneNumberId: string, accessToken: string, to: string, videoUrl: string, caption?: string): Promise<any>;
export declare function sendLocation(phoneNumberId: string, accessToken: string, to: string, lat: number, lng: number, name?: string, address?: string): Promise<any>;
export declare function sendInteractiveButtons(phoneNumberId: string, accessToken: string, to: string, bodyText: string, buttons: {
    id: string;
    title: string;
}[], headerText?: string, footerText?: string): Promise<any>;
export declare function sendInteractiveList(phoneNumberId: string, accessToken: string, to: string, bodyText: string, buttonLabel: string, sections: {
    title: string;
    rows: {
        id: string;
        title: string;
        description?: string;
    }[];
}[]): Promise<any>;
export declare function markMessageRead(phoneNumberId: string, accessToken: string, messageId: string): Promise<any>;
export declare function sendReaction(phoneNumberId: string, accessToken: string, to: string, messageId: string, emoji: string): Promise<any>;
export declare function getMediaUrl(mediaId: string, accessToken: string): Promise<string>;
export declare function downloadMedia(mediaUrl: string, accessToken: string): Promise<Buffer>;
export declare function fetchTemplatesFromMeta(businessAccountId: string, accessToken: string): Promise<any[]>;
export declare function deleteTemplate(businessAccountId: string, accessToken: string, templateName: string): Promise<any>;
export declare function getPhoneQuality(phoneNumberId: string, accessToken: string): Promise<any>;
export declare function validateWebhookSignature(rawBody: string, signature: string, appSecret: string): boolean;
export declare function uploadMedia(phoneNumberId: string, accessToken: string, fileBuffer: Buffer, mimeType: string, filename: string): Promise<string>;
//# sourceMappingURL=whatsappService.d.ts.map