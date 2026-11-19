import { describe, expect, it } from 'vitest';
import { loadEnv } from '../src/config/env.js';

describe('environment', () => {
  it('refuses fake payments and memory storage in production', () => {
    expect(() => loadEnv({ DATABASE_URL: 'x', NODE_ENV: 'production' })).toThrow(/fake payments.*|memory storage/);
  });
  it('needs the Stripe keys when Stripe is on', () => {
    expect(() => loadEnv({ DATABASE_URL: 'x', PAYMENT_DRIVER: 'stripe' })).toThrow(/STRIPE_SECRET_KEY/);
  });
});
