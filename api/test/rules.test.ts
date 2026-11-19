import { describe, expect, it } from 'vitest';
import { newGiftTiming, onOpened, onPaid, phaseOf, playableVoiceSeconds, quote, reminderYear, RULES, type GiftState } from '../src/campaigns/santa-box/rules.js';

const H = 3_600_000;
const D = 24 * H;
const t0 = new Date('2026-12-01T00:00:00Z');
const at = (ms: number) => new Date(t0.getTime() + ms);
const fresh = (): GiftState => ({ plan: 'FREE', openedAt: null, purgedAt: null, ...newGiftTiming(t0) });

describe('free box timing', () => {
  it('travels 25 h, then waits 7 days to be opened', () => {
    const g = fresh();
    expect(g.deliverAt).toEqual(at(25 * H));
    expect(phaseOf(g, at(24 * H))).toBe('in_transit');
    expect(phaseOf(g, at(25 * H))).toBe('ready');
    expect(phaseOf(g, at(25 * H + 7 * D))).toBe('expired');
  });

  it('lasts 7 days after the recipient opens it', () => {
    const g = fresh();
    const change = onOpened(g, at(2 * D))!;
    expect(change.expiresAt).toEqual(at(9 * D));
    expect(onOpened({ ...g, ...change }, at(3 * D))).toBeNull(); // second open changes nothing
  });

  it('cannot be opened before it arrives', () => {
    expect(onOpened(fresh(), at(H))).toBeNull();
  });
});

describe('prices', () => {
  it('25 THB for a year, 125 forever, 100 to upgrade', () => {
    const g = fresh();
    expect(quote(g, { plan: 'YEAR', payer: 'SENDER' }, t0)).toEqual({ ok: true, amountSatang: 2_500 });
    expect(quote(g, { plan: 'FOREVER', payer: 'SENDER' }, t0)).toEqual({ ok: true, amountSatang: 12_500 });
    expect(quote({ ...g, plan: 'YEAR' }, { plan: 'FOREVER', payer: 'SENDER' }, t0)).toEqual({ ok: true, amountSatang: 10_000 });
  });

  it('never charges twice for the same plan or a downgrade', () => {
    expect(quote({ ...fresh(), plan: 'YEAR' }, { plan: 'YEAR', payer: 'RECIPIENT' }, at(2 * D))).toEqual({ ok: false, error: 'ALREADY_HAS_PLAN' });
    expect(quote({ ...fresh(), plan: 'FOREVER', expiresAt: null }, { plan: 'YEAR', payer: 'SENDER' }, t0)).toEqual({ ok: false, error: 'ALREADY_HAS_PLAN' });
  });

  it('the recipient cannot pay to open early', () => {
    expect(quote(fresh(), { plan: 'YEAR', payer: 'RECIPIENT' }, at(H))).toEqual({ ok: false, error: 'RECIPIENT_TOO_EARLY' });
    expect(quote(fresh(), { plan: 'YEAR', payer: 'RECIPIENT' }, at(26 * H)).ok).toBe(true);
  });

  it('only the sender schedules, before arrival, within a year', () => {
    const g = fresh();
    expect(quote(g, { plan: 'YEAR', payer: 'SENDER', requestedDeliverAt: at(10 * D) }, t0).ok).toBe(true);
    expect(quote(g, { plan: 'YEAR', payer: 'SENDER', requestedDeliverAt: at(-H) }, t0)).toEqual({ ok: false, error: 'SCHEDULE_OUT_OF_RANGE' });
    expect(quote(g, { plan: 'YEAR', payer: 'SENDER', requestedDeliverAt: at(400 * D) }, t0)).toEqual({ ok: false, error: 'SCHEDULE_OUT_OF_RANGE' });
    expect(quote(g, { plan: 'YEAR', payer: 'SENDER', requestedDeliverAt: at(3 * D) }, at(26 * H))).toEqual({ ok: false, error: 'SCHEDULE_NOT_ALLOWED' });
  });

  it('nothing to pay for once expired', () => {
    expect(quote(fresh(), { plan: 'FOREVER', payer: 'RECIPIENT' }, at(40 * D))).toEqual({ ok: false, error: 'EXPIRED' });
  });
});

describe('after payment', () => {
  it('sender paying delivers now', () => {
    const change = onPaid(fresh(), { plan: 'YEAR', payer: 'SENDER', requestedDeliverAt: null }, at(H));
    expect(change).toEqual({ plan: 'YEAR', deliverAt: at(H), expiresAt: at(H + RULES.yearMs) });
  });

  it('sender scheduling for Christmas: the year starts on arrival', () => {
    const xmas = new Date('2026-12-24T17:00:00Z');
    const change = onPaid(fresh(), { plan: 'YEAR', payer: 'SENDER', requestedDeliverAt: xmas }, at(H));
    expect(change.deliverAt).toEqual(xmas);
    expect(change.expiresAt).toEqual(new Date(xmas.getTime() + RULES.yearMs));
  });

  it('a schedule that passed while paying means now', () => {
    expect(onPaid(fresh(), { plan: 'YEAR', payer: 'SENDER', requestedDeliverAt: at(H) }, at(2 * H)).deliverAt).toEqual(at(2 * H));
  });

  it('recipient paying keeps the box, does not move delivery', () => {
    const g = { ...fresh(), openedAt: at(2 * D) };
    expect(onPaid(g, { plan: 'FOREVER', payer: 'RECIPIENT', requestedDeliverAt: null }, at(3 * D))).toEqual({ plan: 'FOREVER', expiresAt: null });
  });

  it('a late lower payment never downgrades', () => {
    const g = { ...fresh(), plan: 'FOREVER' as const, expiresAt: null };
    expect(onPaid(g, { plan: 'YEAR', payer: 'RECIPIENT', requestedDeliverAt: null }, at(3 * D))).toEqual({ expiresAt: null });
  });
});

describe('voice and reminders', () => {
  it('free plays 15 s, paid 60 s', () => {
    expect(playableVoiceSeconds('FREE', 40)).toBe(15);
    expect(playableVoiceSeconds('YEAR', 40)).toBe(40);
    expect(playableVoiceSeconds('FREE', null)).toBeNull();
  });

  it('reminders run 18–24 Dec Bangkok time', () => {
    expect(reminderYear(new Date('2027-12-17T16:59:00Z'))).toBeNull(); // 17 Dec 23:59 BKK
    expect(reminderYear(new Date('2027-12-17T17:00:00Z'))).toBe(2027); // 18 Dec 00:00 BKK
    expect(reminderYear(new Date('2027-12-24T16:59:00Z'))).toBe(2027);
    expect(reminderYear(new Date('2027-12-24T17:00:00Z'))).toBeNull();
  });
});
