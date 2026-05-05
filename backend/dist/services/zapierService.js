"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ZAPIER_EVENTS = void 0;
exports.triggerZapier = triggerZapier;
exports.triggerOrgZapiers = triggerOrgZapiers;
const axios_1 = __importDefault(require("axios"));
const logger_1 = require("../utils/logger");
// Send event to all registered Zapier webhook URLs for an organization
async function triggerZapier(webhookUrl, event) {
    try {
        await axios_1.default.post(webhookUrl, event, {
            headers: { 'Content-Type': 'application/json', 'User-Agent': 'WhatsApp-CRM/1.0' },
            timeout: 10000,
        });
        logger_1.logger.info(`Zapier triggered: ${event.event}`);
    }
    catch (err) {
        logger_1.logger.error(`Zapier webhook failed: ${err.message}`);
    }
}
// Trigger all registered webhooks for an org
async function triggerOrgZapiers(webhooks, event) {
    const matching = webhooks.filter(w => w.events.includes('*') || w.events.includes(event.event));
    await Promise.allSettled(matching.map(w => triggerZapier(w.url, event)));
}
// Common event types
exports.ZAPIER_EVENTS = {
    CONTACT_CREATED: 'contact.created',
    CONTACT_UPDATED: 'contact.updated',
    LEAD_CREATED: 'lead.created',
    LEAD_CONVERTED: 'lead.converted',
    DEAL_WON: 'deal.won',
    DEAL_LOST: 'deal.lost',
    MESSAGE_RECEIVED: 'message.received',
    CONVERSATION_RESOLVED: 'conversation.resolved',
    FOLLOWUP_SENT: 'followup.sent',
    PAYMENT_RECEIVED: 'payment.received',
};
//# sourceMappingURL=zapierService.js.map