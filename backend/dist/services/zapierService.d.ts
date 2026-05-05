export interface ZapierEvent {
    event: string;
    data: Record<string, any>;
    timestamp: string;
    organizationId: string;
}
export declare function triggerZapier(webhookUrl: string, event: ZapierEvent): Promise<void>;
export declare function triggerOrgZapiers(webhooks: {
    url: string;
    events: string[];
}[], event: ZapierEvent): Promise<void>;
export declare const ZAPIER_EVENTS: {
    CONTACT_CREATED: string;
    CONTACT_UPDATED: string;
    LEAD_CREATED: string;
    LEAD_CONVERTED: string;
    DEAL_WON: string;
    DEAL_LOST: string;
    MESSAGE_RECEIVED: string;
    CONVERSATION_RESOLVED: string;
    FOLLOWUP_SENT: string;
    PAYMENT_RECEIVED: string;
};
//# sourceMappingURL=zapierService.d.ts.map