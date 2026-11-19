import { z } from 'zod';

const list = (fallback: string) =>
  z
    .string()
    .default(fallback)
    .transform((s) =>
      s
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean),
    );
const csv = list('');

const bool = z
  .enum(['true', 'false', '1', '0'])
  .default('true')
  .transform((v) => v === 'true' || v === '1');

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    HOST: z.string().default('127.0.0.1'),
    PORT: z.coerce.number().int().default(3100),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
    /** Railway: x-real-ip. Replaces any X-Forwarded-For the visitor sent, so nobody can dodge the per-IP limits. */
    REAL_IP_HEADER: z.string().trim().toLowerCase().optional(),
    DATABASE_URL: z.string().min(1),
    /** Browser origins allowed to call the API, e.g. https://play.inzeniths.com,https://inzeniths.com */
    CORS_ORIGINS: csv,
    /** Where the Santa Box pages live. Used for payment return links and links in emails. */
    SANTA_APP_URL: z.string().url().default('http://localhost:8765'),
    RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(120),
    /** Creating gifts and asking for upload slots, per minute per IP. */
    CREATE_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(10),

    /** memory = files kept in this process (dev and tests only); r2 = Cloudflare R2 (any S3-compatible store). */
    STORAGE_DRIVER: z.enum(['memory', 'r2']).default('memory'),
    /** Just the ID. A pasted endpoint (https://<id>.r2.cloudflarestorage.com/...) is cut back to the ID. */
    R2_ACCOUNT_ID: z
      .string()
      .optional()
      .transform((v) =>
        v
          ?.trim()
          .replace(/^[a-z]+:\/\//i, '')
          .replace(/\.r2\.cloudflarestorage\.com.*$/i, '')
          .replace(/\/.*$/, '') || undefined,
      ),
    R2_ACCESS_KEY_ID: z.string().optional(),
    R2_SECRET_ACCESS_KEY: z.string().optional(),
    R2_BUCKET: z.string().optional(),
    /** Override for other S3-compatible stores. Default: https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com */
    R2_ENDPOINT: z
      .string()
      .trim()
      .url()
      .optional()
      .transform((v) => v?.replace(/\/+$/, '')),

    /** fake = a local "pay" link that marks the payment paid (never in production); stripe = Stripe Checkout. */
    PAYMENT_DRIVER: z.enum(['fake', 'stripe']).default('fake'),
    STRIPE_SECRET_KEY: z.string().optional(),
    STRIPE_WEBHOOK_SECRET: z.string().optional(),
    /** Stripe payment methods shown at checkout. */
    STRIPE_PAYMENT_METHODS: list('promptpay'),

    /** console = print emails to the log; brevo / resend = send through their HTTPS API (Railway Hobby blocks SMTP). */
    MAIL_DRIVER: z.enum(['console', 'brevo', 'resend']).default('console'),
    MAIL_FROM: z.string().default('Santa Box <no-reply@example.com>'),
    BREVO_API_KEY: z.string().optional(),
    RESEND_API_KEY: z.string().optional(),

    /** Clean-up and reminder jobs inside this process. Run the API as one instance only. */
    JOBS_ENABLED: bool,
    JOB_INTERVAL_MINUTES: z.coerce.number().int().min(1).default(60),
  })
  .superRefine((env, ctx) => {
    const need = (cond: boolean, keys: (keyof typeof env)[], why: string) => {
      if (!cond) return;
      for (const k of keys) if (!env[k]) ctx.addIssue({ code: 'custom', path: [k], message: `required when ${why}` });
    };
    need(env.STORAGE_DRIVER === 'r2', ['R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET'], 'STORAGE_DRIVER=r2');
    if (env.STORAGE_DRIVER === 'r2' && !env.R2_ACCOUNT_ID && !env.R2_ENDPOINT) {
      ctx.addIssue({ code: 'custom', path: ['R2_ACCOUNT_ID'], message: 'R2_ACCOUNT_ID or R2_ENDPOINT is required when STORAGE_DRIVER=r2' });
    }
    if (env.R2_ACCOUNT_ID && !/^[a-z0-9]+$/i.test(env.R2_ACCOUNT_ID)) {
      ctx.addIssue({ code: 'custom', path: ['R2_ACCOUNT_ID'], message: 'should be the account ID only, e.g. ea308ea1…' });
    }
    need(env.PAYMENT_DRIVER === 'stripe', ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'], 'PAYMENT_DRIVER=stripe');
    need(env.MAIL_DRIVER === 'brevo', ['BREVO_API_KEY'], 'MAIL_DRIVER=brevo');
    need(env.MAIL_DRIVER === 'resend', ['RESEND_API_KEY'], 'MAIL_DRIVER=resend');
    if (env.NODE_ENV === 'production') {
      if (env.PAYMENT_DRIVER === 'fake') ctx.addIssue({ code: 'custom', path: ['PAYMENT_DRIVER'], message: 'fake payments are not allowed in production' });
      if (env.STORAGE_DRIVER === 'memory') ctx.addIssue({ code: 'custom', path: ['STORAGE_DRIVER'], message: 'memory storage loses every file on restart; use r2 in production' });
    }
  });

export type Env = z.infer<typeof schema>;

export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment: ${problems}`);
  }
  return parsed.data;
}
