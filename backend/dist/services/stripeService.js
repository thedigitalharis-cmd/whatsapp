"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.reinitStripe = void 0;
exports.getStripe = getStripe;
exports.createPaymentLink = createPaymentLink;
exports.createAndSendInvoice = createAndSendInvoice;
exports.validateStripeKey = validateStripeKey;
const stripe_1 = __importDefault(require("stripe"));
let stripeClient = null;
function getStripe() {
    if (!stripeClient) {
        if (!process.env.STRIPE_SECRET_KEY)
            throw new Error('Stripe not configured. Add STRIPE_SECRET_KEY in Settings → Integrations.');
        stripeClient = new stripe_1.default(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });
    }
    return stripeClient;
}
const reinitStripe = (key) => {
    process.env.STRIPE_SECRET_KEY = key;
    stripeClient = new stripe_1.default(key, { apiVersion: '2023-10-16' });
};
exports.reinitStripe = reinitStripe;
// Create a payment link
async function createPaymentLink(params) {
    const stripe = getStripe();
    // Create a price
    const price = await stripe.prices.create({
        unit_amount: Math.round(params.amount * 100), // convert to cents
        currency: params.currency.toLowerCase(),
        product_data: {
            name: params.description,
        },
    });
    // Create payment link
    const link = await stripe.paymentLinks.create({
        line_items: [{ price: price.id, quantity: 1 }],
        metadata: params.metadata || {},
        after_completion: {
            type: 'hosted_confirmation',
            hosted_confirmation: { custom_message: 'Thank you for your payment!' },
        },
    });
    return { url: link.url, id: link.id };
}
// Create an invoice
async function createAndSendInvoice(params) {
    const stripe = getStripe();
    // Find or create customer
    const existing = await stripe.customers.list({ email: params.customerEmail, limit: 1 });
    let customer = existing.data[0];
    if (!customer) {
        customer = await stripe.customers.create({
            email: params.customerEmail,
            name: params.customerName,
        });
    }
    // Create invoice item
    await stripe.invoiceItems.create({
        customer: customer.id,
        amount: Math.round(params.amount * 100),
        currency: params.currency.toLowerCase(),
        description: params.description,
    });
    // Create and finalize invoice
    const invoice = await stripe.invoices.create({
        customer: customer.id,
        collection_method: 'send_invoice',
        days_until_due: 7,
    });
    const finalized = await stripe.invoices.finalizeInvoice(invoice.id);
    await stripe.invoices.sendInvoice(finalized.id);
    return { url: finalized.hosted_invoice_url || '', id: finalized.id };
}
// Validate Stripe key
async function validateStripeKey(key) {
    try {
        const client = new stripe_1.default(key, { apiVersion: '2023-10-16' });
        await client.balance.retrieve();
        return true;
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=stripeService.js.map