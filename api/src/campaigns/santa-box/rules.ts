// Santa Box business rules, as plain functions (no database), so every rule has a test.
// Source: the Santa Box requirements doc (pricing table and "กติกา").

import type { Payer, Plan } from '@prisma/client';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export const RULES = {
  /** Free gifts: Santa travels this long before the recipient can open the box. */
  freeTravelMs: 25 * HOUR,
  /** Free gifts: the link waits this long after arrival for the recipient to open it. */
  freeWaitToOpenMs: 7 * DAY,
  /** Free gifts: the box stays this long after the recipient opens it. */
  freeAfterOpenMs: 7 * DAY,
  /** YEAR plan: the box lasts this long from the payment. */
  yearMs: 365 * DAY,
  /** Furthest ahead a paid sender may schedule delivery. */
  maxScheduleAheadMs: 366 * DAY,
  voiceSeconds: { FREE: 15, YEAR: 60, FOREVER: 60 } satisfies Record<Plan, number>,
  /** Prices in satang (1 THB = 100). */
  price: { YEAR: 2_500, FOREVER: 12_500 },
} as const;

const rank: Record<Plan, number> = { FREE: 0, YEAR: 1, FOREVER: 2 };

export type GiftState = {
  plan: Plan;
  deliverAt: Date;
  openedAt: Date | null;
  expiresAt: Date | null;
  purgedAt: Date | null;
};

/** What the recipient's link shows right now. */
export type Phase = 'in_transit' | 'ready' | 'expired';

export function phaseOf(gift: GiftState, now: Date): Phase {
  if (gift.purgedAt) return 'expired';
  if (gift.expiresAt && gift.expiresAt.getTime() <= now.getTime()) return 'expired';
  if (now.getTime() < gift.deliverAt.getTime()) return 'in_transit';
  return 'ready';
}

/** Timing of a newly sent gift. Every gift starts free; a payment can change it later. */
export function newGiftTiming(now: Date): Pick<GiftState, 'deliverAt' | 'expiresAt'> {
  const deliverAt = new Date(now.getTime() + RULES.freeTravelMs);
  return { deliverAt, expiresAt: new Date(deliverAt.getTime() + RULES.freeWaitToOpenMs) };
}

/** First time the recipient opens the box. Free boxes then last 7 more days. Paid plans are unchanged. */
export function onOpened(gift: GiftState, now: Date): Partial<GiftState> | null {
  if (gift.openedAt || phaseOf(gift, now) !== 'ready') return null;
  const change: Partial<GiftState> = { openedAt: now };
  if (gift.plan === 'FREE') change.expiresAt = new Date(now.getTime() + RULES.freeAfterOpenMs);
  return change;
}

export type QuoteError =
  | 'EXPIRED' // nothing left to keep
  | 'ALREADY_HAS_PLAN' // same plan or a better one is already paid
  | 'RECIPIENT_TOO_EARLY' // the recipient can pay only to keep the box, never to open it early
  | 'SCHEDULE_NOT_ALLOWED' // only the sender chooses the delivery time, before the box arrives
  | 'SCHEDULE_OUT_OF_RANGE';

export type Quote = { ok: true; amountSatang: number } | { ok: false; error: QuoteError };

/**
 * Price for moving a gift to `plan`. YEAR → FOREVER costs the difference (100 THB).
 * `requestedDeliverAt` is the sender's chosen delivery time (null = as soon as paid).
 */
export function quote(
  gift: GiftState,
  input: { plan: Exclude<Plan, 'FREE'>; payer: Payer; requestedDeliverAt?: Date | null },
  now: Date,
): Quote {
  const phase = phaseOf(gift, now);
  if (phase === 'expired') return { ok: false, error: 'EXPIRED' };
  if (rank[gift.plan] >= rank[input.plan]) return { ok: false, error: 'ALREADY_HAS_PLAN' };
  if (input.payer === 'RECIPIENT' && phase === 'in_transit') return { ok: false, error: 'RECIPIENT_TOO_EARLY' };
  if (input.requestedDeliverAt) {
    if (input.payer !== 'SENDER' || phase !== 'in_transit') return { ok: false, error: 'SCHEDULE_NOT_ALLOWED' };
    const ahead = input.requestedDeliverAt.getTime() - now.getTime();
    if (ahead < 0 || ahead > RULES.maxScheduleAheadMs) return { ok: false, error: 'SCHEDULE_OUT_OF_RANGE' };
  }
  const paid = gift.plan === 'YEAR' ? RULES.price.YEAR : 0;
  return { ok: true, amountSatang: RULES.price[input.plan] - paid };
}

/**
 * A payment cleared. Returns the gift's new plan, expiry and (for a sender paying before arrival) delivery time.
 * A scheduled time that has already passed while the payment was pending means "deliver now".
 */
export function onPaid(
  gift: GiftState,
  payment: { plan: Plan; payer: Payer; requestedDeliverAt: Date | null },
  paidAt: Date,
): Partial<GiftState> {
  const change: Partial<GiftState> = {};
  const stillTravelling = paidAt.getTime() < gift.deliverAt.getTime() && !gift.openedAt;
  if (payment.payer === 'SENDER' && stillTravelling) {
    const wanted = payment.requestedDeliverAt;
    change.deliverAt = wanted && wanted.getTime() > paidAt.getTime() ? wanted : paidAt;
  }

  if (rank[payment.plan] > rank[gift.plan]) change.plan = payment.plan;
  const plan = change.plan ?? gift.plan;
  if (plan === 'FOREVER') change.expiresAt = null;
  else if (plan === 'YEAR' && change.plan) {
    // One year from payment; a box scheduled further ahead still gets a full year after it arrives.
    const from = Math.max(paidAt.getTime(), (change.deliverAt ?? gift.deliverAt).getTime());
    change.expiresAt = new Date(from + RULES.yearMs);
  }
  return change;
}

/** How many seconds of the voice message the recipient may hear on this plan. */
export const playableVoiceSeconds = (plan: Plan, recorded: number | null) =>
  recorded == null ? null : Math.min(recorded, RULES.voiceSeconds[plan]);

/** Year of the Christmas reminder due on `now` (18–24 Dec, Bangkok time), or null outside that window. */
export function reminderYear(now: Date): number | null {
  const bkk = new Date(now.getTime() + 7 * HOUR);
  return bkk.getUTCMonth() === 11 && bkk.getUTCDate() >= 18 && bkk.getUTCDate() <= 24 ? bkk.getUTCFullYear() : null;
}
