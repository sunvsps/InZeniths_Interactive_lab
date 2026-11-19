import { describe, expect, it } from 'vitest';
import { loadEnv } from '../src/config/env.js';

describe('environment', () => {
  it('refuses fake payments and memory storage in production', () => {
    expect(() => loadEnv({ DATABASE_URL: 'x', NODE_ENV: 'production' })).toThrow(/fake payments.*|memory storage/);
  });
  it('cuts a pasted R2 endpoint back to the account ID', () => {
    const id = 'ea308ea102692884955b258ae69db26c';
    for (const v of [id, ` ${id} `, `https://${id}.r2.cloudflarestorage.com`, `https://${id}.r2.cloudflarestorage.com/santa-box/`, `${id}.r2.cloudflarestorage.com`]) {
      expect(loadEnv({ DATABASE_URL: 'x', R2_ACCOUNT_ID: v }).R2_ACCOUNT_ID).toBe(id);
    }
    expect(loadEnv({ DATABASE_URL: 'x', R2_ENDPOINT: 'https://x.example.com/' }).R2_ENDPOINT).toBe('https://x.example.com');
    expect(() => loadEnv({ DATABASE_URL: 'x', R2_ACCOUNT_ID: 'my account' })).toThrow(/R2_ACCOUNT_ID/);
  });
  it('needs the Stripe keys when Stripe is on', () => {
    expect(() => loadEnv({ DATABASE_URL: 'x', PAYMENT_DRIVER: 'stripe' })).toThrow(/STRIPE_SECRET_KEY/);
  });
});
