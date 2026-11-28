import { PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { inject } from 'vitest';
import { buildApp } from '../src/app.js';
import { loadEnv } from '../src/config/env.js';
import { memoryMailer } from '../src/services/mailer.js';
import { fakePayments } from '../src/services/payments.js';
import { memoryStorage } from '../src/services/storage.js';

export async function testApp(extraEnv: Record<string, string> = {}) {
  const url = inject('databaseUrl');
  const prisma = new PrismaClient({ datasourceUrl: url });
  const env = loadEnv({
    DATABASE_URL: url,
    LOG_LEVEL: 'silent',
    NODE_ENV: 'test',
    SANTA_APP_URL: 'https://example.com/santa',
    RATE_LIMIT_PER_MINUTE: '10000',
    CREATE_RATE_LIMIT_PER_MINUTE: '10000',
    ...extraEnv,
  });
  const storage = memoryStorage();
  const mailer = memoryMailer();
  const app: FastifyInstance = await buildApp({ env, prisma, storage, mailer, payments: fakePayments(env, 'http://api.test') });
  await app.ready();
  return { app, prisma, storage, mailer };
}

export const payload = {
  design: { box: 1, ribbon: 2, accents: ['b', 'h'], paper: 0, font: 1 },
  card: { message: 'ปีนี้ขอบคุณที่อยู่ข้างกันเสมอ' },
  gift: { item: 'orn', engraving: 'แม่ · 2026', coupon: 'พาไปกินข้าว 1 มื้อ' },
  music: 'jingle',
};

/** Sends a box the way the page does: voice slot, then the gift. */
export async function sendBox(app: FastifyInstance, extra: Record<string, unknown> = {}) {
  const up = await app.inject({ method: 'POST', url: '/v1/santa-box/uploads', payload: { kind: 'VOICE', contentType: 'audio/webm;codecs=opus', bytes: 90_000 } });
  if (up.statusCode !== 201) throw new Error(up.body);
  const res = await app.inject({
    method: 'POST',
    url: '/v1/santa-box/gifts',
    payload: { recipientName: 'แม่', senderName: 'ลูกคนเล็ก', senderEmail: 'sender@example.com', payload, voiceKey: up.json().key, voiceSeconds: 40, ...extra },
  });
  if (res.statusCode !== 201) throw new Error(res.body);
  return res.json() as { slug: string; number: number; link: string; senderToken: string; deliverAt: string; expiresAt: string };
}

/** The provider calls back: payment cleared. */
export const webhookPaid = (app: FastifyInstance, paymentId: string) =>
  app.inject({ method: 'POST', url: '/v1/payments/webhook', headers: { 'content-type': 'application/json' }, payload: JSON.stringify({ type: 'paid', paymentId }) });
