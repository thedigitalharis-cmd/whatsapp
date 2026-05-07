/** WhatsApp Cloud API requires Opus in OGG for voice links it fetches from our URL. */
export declare function transcodeWebmToWhatsAppOgg(inputPath: string, outputPath: string): Promise<void>;
export declare function whatsAppVoiceOutputPath(uploadDir: string, multerSavedPath: string): string;
//# sourceMappingURL=voiceTranscode.d.ts.map