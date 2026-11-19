// Checkout at the payment provider. Stripe in production; a fake provider for local work and tests.
import Stripe from 'stripe';
import type { Env } from '../config/env.js';

export type CheckoutInput = {
  paymentId: string;
  amountSatang: number;
  title: string;
  email?: string | null;
  /** Language of the checkout page. */
  locale?: 'th' | 'en';
  successUrl: string;
  cancelUrl: string;
};

/** A provider event this API acts on, already verified. */
export type PaymentEvent =
  | { type: 'paid'; providerRef: string; paymentId: string | null; email: string | null }
  | { type: 'expired'; providerRef: string; paymentId: string | null }
  | { type: 'ignored' };

export interface Payments {
  name: string;
  createCheckout(input: CheckoutInput): Promise<{ providerRef: string; url: string }>;
  /** Throws when the signature does not match. */
  parseWebhook(rawBody: Buffer, signature: string | undefined): PaymentEvent;
}

/** Stripe checkout statuses that mean the order is settled: paid, or free because a discount code covered all of it. */
export const isSettled = (status: string | null | undefined) => status === 'paid' || status === 'no_payment_required';

export function createPayments(env: Env): Payments {
  if (env.PAYMENT_DRIVER === 'fake') return fakePayments(env);
  const stripe = new Stripe(env.STRIPE_SECRET_KEY!);
  const methods = env.STRIPE_PAYMENT_METHODS as Stripe.Checkout.SessionCreateParams.AllowedPaymentMethodType[];
  return {
    name: 'stripe',
    async createCheckout(input) {
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        allowed_payment_method_types: methods,
        line_items: [
          { quantity: 1, price_data: { currency: 'thb', unit_amount: input.amountSatang, product_data: { name: input.title } } },
        ],
        customer_email: input.email ?? undefined,
        allow_promotion_codes: true,
        locale: input.locale ?? 'th',
        client_reference_id: input.paymentId,
        metadata: { paymentId: input.paymentId },
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
      });
      if (!session.url) throw new Error('Stripe returned no checkout URL');
      return { providerRef: session.id, url: session.url };
    },
    parseWebhook(rawBody, signature) {
      const event = stripe.webhooks.constructEvent(rawBody, signature ?? '', env.STRIPE_WEBHOOK_SECRET!);
      const session = event.data.object as Stripe.Checkout.Session;
      const paymentId = session.metadata?.paymentId ?? session.client_reference_id ?? null;
      switch (event.type) {
        case 'checkout.session.completed':
        case 'checkout.session.async_payment_succeeded':
          // PromptPay can finish later than the checkout page: "completed" may still be unpaid.
          // A 100% discount code makes the total 0: Stripe then says "no_payment_required", which counts as paid.
          if (!isSettled(session.payment_status)) return { type: 'ignored' };
          return { type: 'paid', providerRef: session.id, paymentId, email: session.customer_details?.email ?? null };
        case 'checkout.session.expired':
        case 'checkout.session.async_payment_failed':
          return { type: 'expired', providerRef: session.id, paymentId };
        default:
          return { type: 'ignored' };
      }
    },
  };
}

/**
 * Local only: the "checkout page" is GET /v1/dev/pay/:paymentId on this API, which marks the payment paid and
 * sends you back to the success URL. Refused in production by the env check.
 */
export function fakePayments(env: Pick<Env, 'PORT'>, base = `http://localhost:${env.PORT}`): Payments {
  return {
    name: 'fake',
    async createCheckout(input) {
      const providerRef = `fake_${input.paymentId}`;
      const url = `${base}/v1/dev/pay/${input.paymentId}?next=${encodeURIComponent(input.successUrl)}`;
      return { providerRef, url };
    },
    parseWebhook(rawBody) {
      const body = JSON.parse(rawBody.toString('utf8')) as { type: 'paid' | 'expired'; paymentId: string };
      return body.type === 'paid'
        ? { type: 'paid', providerRef: `fake_${body.paymentId}`, paymentId: body.paymentId, email: null }
        : { type: 'expired', providerRef: `fake_${body.paymentId}`, paymentId: body.paymentId };
    },
  };
}
