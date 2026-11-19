// Email over HTTPS (port 443). Railway Hobby blocks SMTP, so no SMTP driver here.
import type { FastifyBaseLogger } from 'fastify';
import type { Env } from '../config/env.js';

export type Mail = { to: string; subject: string; text: string; html?: string };

/** Every email comes from noreply@, so each one says where to reach a person. */
export const SUPPORT_FOOTER = '\n\n—\nมีปัญหาหรือคำถาม ติดต่อ support@inzeniths.com\nSanta Box by IN ZENITHS';
export interface Mailer {
  send(mail: Mail): Promise<void>;
}

/** "Santa Box <hello@inzeniths.com>" → { name, email } */
export function parseAddress(from: string): { name?: string; email: string } {
  const m = from.trim().match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (m) return { ...(m[1]!.trim() ? { name: m[1]!.trim() } : {}), email: m[2]!.trim() };
  return { email: from.trim() };
}

async function post(url: string, headers: Record<string, string>, body: unknown, provider: string, fetchImpl: typeof fetch) {
  let res: Response;
  try {
    res = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    });
  } catch (e) {
    const timedOut = e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError');
    throw new Error(timedOut ? `No answer from ${provider} within 20 s` : `Could not reach ${provider}: ${(e as Error).message}`);
  }
  if (!res.ok) throw new Error(`${provider} refused the email (${res.status}): ${(await res.text()).slice(0, 300)}`);
}

/** Brevo transactional API v3. Free plan: 300 emails a day. */
export function brevoMailer(apiKey: string, from: string, fetchImpl: typeof fetch = fetch): Mailer {
  return {
    send: (mail) =>
      post(
        'https://api.brevo.com/v3/smtp/email',
        { 'api-key': apiKey },
        { sender: parseAddress(from), to: [{ email: mail.to }], subject: mail.subject, textContent: mail.text, ...(mail.html ? { htmlContent: mail.html } : {}) },
        'Brevo',
        fetchImpl,
      ),
  };
}

export function resendMailer(apiKey: string, from: string, fetchImpl: typeof fetch = fetch): Mailer {
  return {
    send: (mail) =>
      post('https://api.resend.com/emails', { Authorization: `Bearer ${apiKey}` }, { from, to: [mail.to], subject: mail.subject, text: mail.text, html: mail.html }, 'Resend', fetchImpl),
  };
}

export function createMailer(env: Env, log: FastifyBaseLogger): Mailer {
  if (env.MAIL_DRIVER === 'brevo') {
    log.info({ driver: 'brevo', from: env.MAIL_FROM }, 'email driver: brevo (emails are really sent)');
    return brevoMailer(env.BREVO_API_KEY!.trim(), env.MAIL_FROM);
  }
  if (env.MAIL_DRIVER === 'resend') {
    log.info({ driver: 'resend', from: env.MAIL_FROM }, 'email driver: resend (emails are really sent)');
    return resendMailer(env.RESEND_API_KEY!.trim(), env.MAIL_FROM);
  }
  log.warn({ driver: 'console' }, 'email driver: console. Emails are only printed here and NOT sent. Set MAIL_DRIVER=brevo, MAIL_FROM and BREVO_API_KEY to send them');
  return { send: async (mail) => log.info({ mail }, 'email (console driver, not sent)') };
}

/** Collects mail instead of sending it (tests). */
export function memoryMailer(): Mailer & { sent: Mail[] } {
  const sent: Mail[] = [];
  return { sent, send: async (mail) => void sent.push(mail) };
}
