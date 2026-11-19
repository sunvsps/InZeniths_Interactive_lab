import type { PrismaClient } from '@prisma/client';
import type { Env } from './config/env.js';
import type { Mailer } from './services/mailer.js';
import type { Payments } from './services/payments.js';
import type { Storage } from './services/storage.js';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
    env: Env;
    storage: Storage;
    payments: Payments;
    mailer: Mailer;
  }
}
