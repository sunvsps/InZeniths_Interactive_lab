import type { FastifyBaseLogger } from 'fastify';
import type { Env } from '../config/env.js';

export type Mail = { to: string; subject: string; text: string; html?: string };
export interface Mailer {
  send(mail: Mail): Promise<void>;
}

export function createMailer(env: Env, log: FastifyBaseLogger): Mailer {
  if (env.MAIL_DRIVER === 'console') {
    return { send: async (mail) => log.info({ mail }, 'email (console driver, not sent)') };
  }
  return {
    async send(mail) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: env.MAIL_FROM, to: [mail.to], subject: mail.subject, text: mail.text, html: mail.html }),
      });
      if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
    },
  };
}

/** Collects mail instead of sending it (tests). */
export function memoryMailer(): Mailer & { sent: Mail[] } {
  const sent: Mail[] = [];
  return { sent, send: async (mail) => void sent.push(mail) };
}
