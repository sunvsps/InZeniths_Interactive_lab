// Santa Box API, mounted at /v1/santa-box.
import type { Gift, Prisma } from '@prisma/client';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { AppError, badRequest, conflict, forbidden, notFound } from '../../lib/errors.js';
import { randomSlug, randomToken, sameHash, sha256 } from '../../lib/tokens.js';
import { asLang, checkoutTitle } from './emails.js';
import { CAMPAIGN, createGiftBody, type SantaPayload } from './schema.js';
import { applyPromo, newGiftTiming, onOpened, phaseOf, playableVoiceSeconds, quote, RULES, type QuoteError } from './rules.js';

const UPLOAD_LIMITS = {
  VOICE: { maxBytes: 1_500_000, types: { 'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mp4': 'm4a', 'audio/mpeg': 'mp3', 'audio/aac': 'aac' } },
  PHOTO: { maxBytes: 2_000_000, types: { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' } },
} as const;
const UPLOAD_MAX_AGE_MS = 24 * 3_600_000;

const QUOTE_MESSAGES: Record<QuoteError, string> = {
  EXPIRED: 'This box has expired',
  ALREADY_HAS_PLAN: 'This box already has this plan or a better one',
  RECIPIENT_TOO_EARLY: 'The recipient can pay only to keep the box, after it arrives',
  SCHEDULE_NOT_ALLOWED: 'Only the sender can choose the delivery time, before the box arrives',
  SCHEDULE_OUT_OF_RANGE: 'Delivery time must be in the future and within a year',
};

const slugParams = z.object({ slug: z.string().min(6).max(40) });
const promoCode = z.string().trim().min(2).max(40).regex(/^[A-Za-z0-9_-]+$/, 'letters, digits, - and _ only');
const PROMO_MESSAGES = {
  PROMO_INVALID: 'This code does not exist, has expired or has been used up',
  PROMO_MIN_AMOUNT: 'This code needs a bigger order',
  PROMO_TOO_SMALL_TOTAL: 'After this code the total would be under 10 THB, which cannot be charged',
} as const;

/**
 * SANTA_APP_URL may include a path (https://play.inzeniths.com/santa-box), so links are joined onto it
 * rather than resolved from the site root.
 */
export const appHome = (appUrl: string) => appUrl.replace(/\/+$/, '') + '/';
export const giftLink = (appUrl: string, slug: string) => `${appHome(appUrl)}b/${slug}`;

/** Where the payer lands after checkout: a page inside the Santa Box app, or its home page. */
function backTo(appUrl: string, path: string | undefined): URL {
  const home = new URL(appHome(appUrl));
  if (!path) return home;
  const url = new URL(path, home.origin);
  return url.pathname.startsWith(home.pathname) ? url : home;
}

/** A same-site path on the Santa Box app, never another site (no open redirect). */
const returnPath = z
  .string()
  .max(300)
  .regex(/^\/(?!\/)[^\s\\]*$/, 'must be a path on the Santa Box site')
  .optional();

export default async function santaBoxRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();
  const db = app.prisma;
  const createLimit = { rateLimit: { max: app.env.CREATE_RATE_LIMIT_PER_MINUTE, timeWindow: '1 minute' } };

  async function findGift(slug: string) {
    const gift = await db.gift.findUnique({ where: { slug } });
    if (!gift || gift.campaign !== CAMPAIGN) throw notFound('Box not found');
    return gift;
  }

  function requireSender(gift: Gift, request: FastifyRequest) {
    const token = request.headers['x-sender-token'];
    if (typeof token !== 'string' || !sameHash(token, gift.senderTokenHash)) throw forbidden('Sender token required');
  }

  /** What the recipient's page needs right now. Content and files only once the box has arrived. */
  async function publicView(gift: Gift, now = new Date()) {
    const phase = phaseOf(gift, now);
    const base = { phase, number: gift.number, recipientName: gift.recipientName, senderName: gift.senderName };
    if (phase === 'in_transit') return { ...base, deliverAt: gift.deliverAt.toISOString() };
    if (phase === 'expired') return base;
    return {
      ...base,
      plan: gift.plan,
      payload: gift.payload as SantaPayload,
      voice: gift.voiceKey
        ? { url: await app.storage.signDownload(gift.voiceKey), playableSeconds: playableVoiceSeconds(gift.plan, gift.voiceSeconds) }
        : null,
      photoUrl: gift.photoKey ? await app.storage.signDownload(gift.photoKey) : null,
      openedAt: gift.openedAt?.toISOString() ?? null,
      expiresAt: gift.expiresAt?.toISOString() ?? null,
    };
  }

  r.get('/stats', async () => ({ boxes: await db.gift.count({ where: { campaign: CAMPAIGN } }) }));

  /** Look a discount code up before paying, so the page can show the new price. */
  async function promoPrice(code: string, baseSatang: number) {
    let promo;
    try {
      promo = await app.payments.findPromo(code);
    } catch (e) {
      app.log.error(e, 'promo lookup failed');
      throw new AppError(502, 'PAYMENT_PROVIDER_ERROR', 'Could not check the code, please try again');
    }
    if (!promo) throw conflict('PROMO_INVALID', PROMO_MESSAGES.PROMO_INVALID);
    const r = applyPromo(baseSatang, promo);
    if (!r.ok) throw conflict(r.error, PROMO_MESSAGES[r.error]);
    return { promo, ...r };
  }

  r.post(
    '/promo',
    { config: createLimit, schema: { body: z.object({ code: promoCode, plan: z.enum(['YEAR', 'FOREVER']), upgrade: z.boolean().default(false) }) } },
    async (request) => {
      const { code, plan, upgrade } = request.body;
      const base = RULES.price[plan] - (upgrade ? RULES.price.YEAR : 0);
      const p = await promoPrice(code, base);
      return { code: p.promo.code, percentOff: p.promo.percentOff, baseSatang: base, discountSatang: p.discountSatang, amountSatang: p.amountSatang };
    },
  );

  // 1. The page asks for a file slot, then PUTs the voice note or photo straight to storage.
  r.post(
    '/uploads',
    {
      config: createLimit,
      schema: {
        body: z.object({ kind: z.enum(['VOICE', 'PHOTO']), contentType: z.string().max(100), bytes: z.number().int().min(1) }),
      },
    },
    async (request, reply) => {
      const { kind, contentType, bytes } = request.body;
      const limits = UPLOAD_LIMITS[kind];
      const ext = (limits.types as Record<string, string>)[contentType.split(';')[0]!.trim()];
      if (!ext) throw badRequest('UNSUPPORTED_TYPE', `Allowed types: ${Object.keys(limits.types).join(', ')}`);
      if (bytes > limits.maxBytes) throw badRequest('FILE_TOO_LARGE', `Max ${limits.maxBytes} bytes`);
      const type = contentType.split(';')[0]!.trim();
      const key = `${CAMPAIGN}/${new Date().getUTCFullYear()}/${kind.toLowerCase()}/${randomSlug(20)}.${ext}`;
      await db.upload.create({ data: { key, kind, contentType: type, bytes } });
      const upload = await app.storage.signUpload(key, type, bytes);
      return reply.status(201).send({ key, upload });
    },
  );

  // 2. Send the box. Every box starts free (arrives in 25 h); paying afterwards can deliver it now or on a date.
  r.post('/gifts', { config: createLimit, schema: { body: createGiftBody } }, async (request, reply) => {
    const body = request.body;
    const now = new Date();
    const keys = [body.voiceKey, body.photoKey].filter((k): k is string => !!k);
    if (body.voiceKey && !body.voiceSeconds) throw badRequest('VOICE_SECONDS_REQUIRED', 'voiceSeconds is required with voiceKey');

    const senderToken = randomToken();
    const gift = await db.$transaction(async (tx) => {
      if (keys.length) {
        const uploads = await tx.upload.findMany({ where: { key: { in: keys } } });
        const check = (key: string | undefined, kind: 'VOICE' | 'PHOTO') => {
          if (!key) return;
          const u = uploads.find((x) => x.key === key);
          if (!u || u.kind !== kind || u.giftId || now.getTime() - u.createdAt.getTime() > UPLOAD_MAX_AGE_MS) {
            throw badRequest('BAD_UPLOAD', `${kind.toLowerCase()} upload is missing, used or too old`);
          }
        };
        check(body.voiceKey, 'VOICE');
        check(body.photoKey, 'PHOTO');
      }
      const created = await tx.gift.create({
        data: {
          slug: randomSlug(),
          campaign: CAMPAIGN,
          senderTokenHash: sha256(senderToken),
          payload: body.payload as Prisma.InputJsonValue,
          recipientName: body.recipientName,
          senderName: body.senderName || null,
          senderEmail: body.senderEmail ?? null,
          voiceKey: body.voiceKey ?? null,
          voiceSeconds: body.voiceKey ? (body.voiceSeconds ?? null) : null,
          photoKey: body.photoKey ?? null,
          remindNextYear: body.remindNextYear && !!body.senderEmail,
          showUnderTree: body.showUnderTree,
          lang: body.lang,
          ...newGiftTiming(now),
        },
      });
      if (keys.length) await tx.upload.updateMany({ where: { key: { in: keys } }, data: { giftId: created.id } });
      return created;
    });

    return reply.status(201).send({
      slug: gift.slug,
      number: gift.number,
      link: giftLink(app.env.SANTA_APP_URL, gift.slug),
      /** Keep this on the sender's device: it is needed to pay for delivery and to see the box's status. */
      senderToken,
      deliverAt: gift.deliverAt.toISOString(),
      expiresAt: gift.expiresAt?.toISOString() ?? null,
    });
  });

  // 3. The recipient's link.
  r.get('/gifts/:slug', { schema: { params: slugParams } }, async (request) => publicView(await findGift(request.params.slug)));

  // 4. The recipient opened the box (starts the 7-day clock on free boxes). Safe to call twice.
  r.post('/gifts/:slug/open', { schema: { params: slugParams } }, async (request) => {
    const gift = await findGift(request.params.slug);
    const now = new Date();
    const change = onOpened(gift, now);
    if (!change) return publicView(gift, now);
    // Only the first open wins, even if two tabs open at once.
    const updated = await db.gift.updateMany({ where: { id: gift.id, openedAt: null }, data: change });
    return publicView(updated.count ? await findGift(gift.slug) : gift, now);
  });

  // 5. The sender's view of their box (status and payments).
  r.get('/gifts/:slug/manage', { schema: { params: slugParams } }, async (request) => {
    const gift = await findGift(request.params.slug);
    requireSender(gift, request);
    const payments = await db.payment.findMany({ where: { giftId: gift.id }, orderBy: { createdAt: 'asc' } });
    return {
      phase: phaseOf(gift, new Date()),
      number: gift.number,
      link: giftLink(app.env.SANTA_APP_URL, gift.slug),
      plan: gift.plan,
      deliverAt: gift.deliverAt.toISOString(),
      openedAt: gift.openedAt?.toISOString() ?? null,
      expiresAt: gift.expiresAt?.toISOString() ?? null,
      payments: payments.map((p) => ({ plan: p.plan, payer: p.payer, amountSatang: p.amountSatang, status: p.status, paidAt: p.paidAt?.toISOString() ?? null })),
    };
  });

  // 6. Pay: the sender (deliver now or on a date, keep longer) or the recipient (keep longer, after it arrives).
  r.post(
    '/gifts/:slug/checkout',
    {
      config: createLimit,
      schema: {
        params: slugParams,
        body: z.object({
          plan: z.enum(['YEAR', 'FOREVER']),
          payer: z.enum(['SENDER', 'RECIPIENT']),
          email: z.email().max(200).optional(),
          /** Sender only: when the box should arrive. Omit to deliver as soon as the payment clears. */
          deliverAt: z.iso.datetime({ offset: true }).optional(),
          returnPath,
          /** Language of the checkout page and receipt email. Default: the sender's language. */
          lang: z.enum(['th', 'en']).optional(),
          /** Discount code typed on our page; checked again here and applied on the payment page. */
          promoCode: promoCode.optional(),
        }),
      },
    },
    async (request) => {
      const gift = await findGift(request.params.slug);
      const { plan, payer, email, returnPath: back } = request.body;
      const lang = asLang(request.body.lang ?? gift.lang);
      if (payer === 'SENDER') requireSender(gift, request);
      const requestedDeliverAt = request.body.deliverAt ? new Date(request.body.deliverAt) : null;
      const q = quote(gift, { plan, payer, requestedDeliverAt }, new Date());
      if (!q.ok) throw conflict(q.error, QUOTE_MESSAGES[q.error]);
      const promo = request.body.promoCode ? await promoPrice(request.body.promoCode, q.amountSatang) : null;
      const amountSatang = promo ? promo.amountSatang : q.amountSatang;

      const payment = await db.payment.create({
        data: {
          giftId: gift.id,
          provider: app.payments.name,
          plan,
          payer,
          amountSatang,
          requestedDeliverAt,
          email: email ?? (payer === 'SENDER' ? gift.senderEmail : null),
          lang,
        },
      });
      const backUrl = backTo(app.env.SANTA_APP_URL, back);
      const success = new URL(backUrl);
      success.searchParams.set('paid', payment.id);
      const title = checkoutTitle(lang, plan, gift.plan === 'YEAR');
      try {
        const checkout = await app.payments.createCheckout({
          paymentId: payment.id,
          amountSatang: q.amountSatang,
          promoId: promo?.promo.id,
          title,
          email: payment.email,
          locale: lang,
          successUrl: success.toString(),
          cancelUrl: backUrl.toString(),
        });
        await db.payment.update({ where: { id: payment.id }, data: { providerRef: checkout.providerRef } });
        return { paymentId: payment.id, amountSatang, checkoutUrl: checkout.url };
      } catch (e) {
        await db.payment.update({ where: { id: payment.id }, data: { status: 'EXPIRED' } });
        request.log.error(e, 'checkout failed');
        throw new AppError(502, 'PAYMENT_PROVIDER_ERROR', 'Could not start the payment, please try again');
      }
    },
  );

  // 7. "Keep forever" boxes: download the voice note and photo.
  r.get('/gifts/:slug/download', { schema: { params: slugParams } }, async (request) => {
    const gift = await findGift(request.params.slug);
    if (phaseOf(gift, new Date()) !== 'ready') throw conflict('NOT_READY', 'This box cannot be opened right now');
    if (gift.plan !== 'FOREVER') throw forbidden('Downloads come with the keep-forever plan');
    const name = (key: string, what: string) => `santa-box-${gift.number}-${what}.${key.split('.').pop()}`;
    return {
      voiceUrl: gift.voiceKey ? await app.storage.signDownload(gift.voiceKey, { downloadName: name(gift.voiceKey, 'voice') }) : null,
      photoUrl: gift.photoKey ? await app.storage.signDownload(gift.photoKey, { downloadName: name(gift.photoKey, 'photo') }) : null,
    };
  });
}
