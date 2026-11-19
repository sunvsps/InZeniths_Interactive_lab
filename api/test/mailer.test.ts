import { describe, expect, it } from 'vitest';
import { loadEnv } from '../src/config/env.js';
import { brevoMailer, parseAddress } from '../src/services/mailer.js';

describe('Brevo email', () => {
  it('sends over HTTPS with the API key and a named sender', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fakeFetch = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response('{"messageId":"1"}', { status: 201 });
    }) as unknown as typeof fetch;
    await brevoMailer('key-123', 'Santa Box <hello@inzeniths.com>', fakeFetch).send({ to: 'mom@example.com', subject: 'สวัสดี', text: 'ลิงก์กล่อง' });

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe('https://api.brevo.com/v3/smtp/email');
    expect((calls[0]!.init.headers as Record<string, string>)['api-key']).toBe('key-123');
    expect(JSON.parse(calls[0]!.init.body as string)).toEqual({
      sender: { name: 'Santa Box', email: 'hello@inzeniths.com' },
      to: [{ email: 'mom@example.com' }],
      subject: 'สวัสดี',
      textContent: 'ลิงก์กล่อง',
    });
  });

  it('reports what Brevo said when it refuses', async () => {
    const fakeFetch = (async () => new Response('{"code":"unauthorized","message":"Key not found"}', { status: 401 })) as unknown as typeof fetch;
    await expect(brevoMailer('bad', 'a@b.co', fakeFetch).send({ to: 'x@y.co', subject: 's', text: 't' })).rejects.toThrow(/Brevo refused the email \(401\).*Key not found/);
  });

  it('reads plain and named sender addresses', () => {
    expect(parseAddress('hello@inzeniths.com')).toEqual({ email: 'hello@inzeniths.com' });
    expect(parseAddress('"Santa Box" <hello@inzeniths.com>')).toEqual({ name: 'Santa Box', email: 'hello@inzeniths.com' });
  });

  it('needs the API key when Brevo is on', () => {
    expect(() => loadEnv({ DATABASE_URL: 'x', MAIL_DRIVER: 'brevo' })).toThrow(/BREVO_API_KEY/);
    expect(loadEnv({ DATABASE_URL: 'x', MAIL_DRIVER: 'brevo', BREVO_API_KEY: 'k' }).MAIL_DRIVER).toBe('brevo');
  });
});
