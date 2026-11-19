import { describe, expect, it } from 'vitest';
import Stripe from 'stripe';
import { createPayments, isSettled } from '../src/services/payments.js';
import { loadEnv } from '../src/config/env.js';

const SECRET = 'whsec_test_secret';
const env = loadEnv({ DATABASE_URL: 'x', PAYMENT_DRIVER: 'stripe', STRIPE_SECRET_KEY: 'sk_test_x', STRIPE_WEBHOOK_SECRET: SECRET });
const payments = createPayments(env);

/** A webhook body signed the way Stripe signs it. */
function signed(type: string, paymentStatus: string) {
  const payload = JSON.stringify({
    id: 'evt_1',
    object: 'event',
    type,
    data: { object: { id: 'cs_test_1', object: 'checkout.session', payment_status: paymentStatus, metadata: { paymentId: 'pay_1' }, client_reference_id: 'pay_1', customer_details: { email: 'a@b.co' } } },
  });
  const header = Stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET });
  return { body: Buffer.from(payload), header };
}

describe('Stripe webhook', () => {
  it('a paid PromptPay checkout counts as paid', () => {
    const { body, header } = signed('checkout.session.completed', 'paid');
    expect(payments.parseWebhook(body, header)).toMatchObject({ type: 'paid', paymentId: 'pay_1', providerRef: 'cs_test_1' });
  });

  it('a 100% discount code (nothing to pay) also counts as paid', () => {
    const { body, header } = signed('checkout.session.completed', 'no_payment_required');
    expect(payments.parseWebhook(body, header)).toMatchObject({ type: 'paid', paymentId: 'pay_1' });
  });

  it('waits while PromptPay is still unpaid', () => {
    const { body, header } = signed('checkout.session.completed', 'unpaid');
    expect(payments.parseWebhook(body, header)).toEqual({ type: 'ignored' });
  });

  it('refuses a body without a valid Stripe signature', () => {
    const { body } = signed('checkout.session.completed', 'paid');
    expect(() => payments.parseWebhook(body, 't=1,v1=bad')).toThrow();
  });

  it('settled statuses', () => {
    expect([isSettled('paid'), isSettled('no_payment_required'), isSettled('unpaid'), isSettled(null)]).toEqual([true, true, false, false]);
  });
});
