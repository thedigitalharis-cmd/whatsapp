import Stripe from 'stripe';
export declare function getStripe(): Stripe;
export declare const reinitStripe: (key: string) => void;
export declare function createPaymentLink(params: {
    amount: number;
    currency: string;
    description: string;
    customerEmail?: string;
    customerName?: string;
    metadata?: Record<string, string>;
}): Promise<{
    url: string;
    id: string;
}>;
export declare function createAndSendInvoice(params: {
    customerEmail: string;
    customerName: string;
    amount: number;
    currency: string;
    description: string;
    dueDate?: Date;
}): Promise<{
    url: string;
    id: string;
}>;
export declare function validateStripeKey(key: string): Promise<boolean>;
//# sourceMappingURL=stripeService.d.ts.map