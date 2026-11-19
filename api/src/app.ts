import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { PrismaClient } from '@prisma/client';
import Fastify from 'fastify';
import { hasZodFastifySchemaValidationErrors, serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import santaBoxRoutes from './campaigns/santa-box/routes.js';
import type { Env } from './config/env.js';
import { AppError } from './lib/errors.js';
import healthRoutes from './routes/health.js';
import devFileRoutes from './routes/devFiles.js';
import paymentRoutes from './routes/payments.js';
import { createMailer, type Mailer } from './services/mailer.js';
import { createPayments, type Payments } from './services/payments.js';
import { createStorage, type Storage } from './services/storage.js';
import './types.js';

export type BuildOptions = { env: Env; prisma?: PrismaClient; storage?: Storage; payments?: Payments; mailer?: Mailer };

export async function buildApp({ env, prisma, storage, payments, mailer }: BuildOptions) {
  const app = Fastify({
    logger: { level: env.LOG_LEVEL, redact: { paths: ['req.headers["x-sender-token"]'], censor: '[redacted]' } },
    trustProxy: env.NODE_ENV === 'production' || !!env.REAL_IP_HEADER,
  });

  // Railway's edge puts the visitor's true address in REAL_IP_HEADER; X-Forwarded-For can be forged by the visitor.
  if (env.REAL_IP_HEADER) {
    const header = env.REAL_IP_HEADER;
    app.addHook('onRequest', async (request) => {
      const real = request.headers[header];
      const value = Array.isArray(real) ? real[0] : real;
      if (value) request.raw.headers['x-forwarded-for'] = value.trim();
      else delete request.raw.headers['x-forwarded-for'];
    });
  }

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  const db = prisma ?? new PrismaClient({ datasourceUrl: env.DATABASE_URL });
  app.decorate('prisma', db);
  app.decorate('env', env);
  app.decorate('storage', storage ?? createStorage(env));
  app.decorate('payments', payments ?? createPayments(env));
  app.decorate('mailer', mailer ?? createMailer(env, app.log));
  if (!prisma) app.addHook('onClose', async () => db.$disconnect());

  await app.register(helmet);
  const origins = new Set(env.CORS_ORIGINS);
  await app.register(cors, {
    // Same-origin and server-to-server calls carry no Origin header. Dev: allow every origin.
    origin: (origin, cb) => cb(null, !origin || env.NODE_ENV !== 'production' || origins.has(origin)),
    // PUT: only the local dev file store takes uploads here (production uploads go straight to R2)
    methods: ['GET', 'POST', 'PUT', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-Sender-Token'],
    maxAge: 600,
  });
  await app.register(rateLimit, { max: env.RATE_LIMIT_PER_MINUTE, timeWindow: '1 minute' });

  app.setNotFoundHandler((_request, reply) => reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Route not found' } }));

  app.setErrorHandler((error: unknown, request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.status).send({ error: { code: error.code, message: error.message, details: error.details } });
    }
    if (hasZodFastifySchemaValidationErrors(error)) {
      return reply.status(422).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request',
          details: error.validation.map((v) => ({ path: v.instancePath || '/', message: v.message })),
        },
      });
    }
    const status = (error as { statusCode?: number }).statusCode ?? 500;
    if (status === 429) return reply.status(429).send({ error: { code: 'RATE_LIMITED', message: 'Too many requests, slow down' } });
    if (status < 500) return reply.status(status).send({ error: { code: 'BAD_REQUEST', message: (error as Error).message } });
    request.log.error(error);
    return reply.status(500).send({ error: { code: 'INTERNAL', message: 'Internal server error' } });
  });

  await app.register(
    async (v1) => {
      await v1.register(healthRoutes);
      await v1.register(paymentRoutes);
      await v1.register(santaBoxRoutes, { prefix: '/santa-box' });
      const files = (app.storage as { files?: Map<string, { type: string; body: Buffer }> }).files;
      if (files && env.NODE_ENV !== 'production') await v1.register(devFileRoutes, { files });
      // Next campaign: await v1.register(nextCampaignRoutes, { prefix: '/<campaign>' });
    },
    { prefix: '/v1' },
  );

  return app;
}
