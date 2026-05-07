"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.publicBaseUrl = publicBaseUrl;
/**
 * Public HTTPS origin for links Meta/WhatsApp fetch (voice uploads, media).
 * Set FRONTEND_URL in Docker (see docker-compose.server.yml) or PUBLIC_URL to override.
 */
function publicBaseUrl() {
    const raw = (process.env.PUBLIC_URL || process.env.FRONTEND_URL || '').trim();
    if (!raw)
        return 'http://localhost:5000';
    try {
        const u = new URL(raw.includes('://') ? raw : `https://${raw}`);
        return `${u.protocol}//${u.host}`;
    }
    catch {
        return raw.replace(/\/$/, '');
    }
}
//# sourceMappingURL=publicUrl.js.map