import axios from 'axios';
import { logger } from '../utils/logger';

export interface ZapierEvent {
  event: string;
  data: Record<string, any>;
  timestamp: string;
  organizationId: string;
}

// Send event to all registered Zapier webhook URLs for an organization
export async function triggerZapier(webhookUrl: string, event: ZapierEvent): Promise<void> {
  try {
    await axios.post(webhookUrl, event, {
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'WhatsApp-CRM/1.0' },
      timeout: 10000,
    });
    logger.info(`Zapier triggered: ${event.event}`);
  } catch (err: any) {
    logger.error(`Zapier webhook failed: ${err.message}`);
  }
}

// Trigger all registered webhooks for an org
export async function triggerOrgZapiers(
  webhooks: { url: string; events: string[] }[],
  event: ZapierEvent
): Promise<void> {
  const matching = webhooks.filter(w =>
    w.events.includes('*') || w.events.includes(event.event)
  );
  await Promise.allSettled(matching.map(w => triggerZapier(w.url, event)));
}

// Common event types
export const ZAPIER_EVENTS = {
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
