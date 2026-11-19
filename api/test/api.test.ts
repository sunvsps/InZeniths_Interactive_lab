import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runJobs } from '../src/services/jobs.js';
import { payload, sendBox, testApp, webhookPaid } from './helpers.js';

let ctx: Awaited<ReturnType<typeof testApp>>;
beforeAll(async () => {
  ctx = await testApp();
});
afterAll(async () => {
  await ctx.app.close();
  await ctx.prisma.$disconnect();
});

const arrive = (slug: string) => ctx.prisma.gift.update({ where: { slug }, data: { deliverAt: new Date(Date.now() - 1000) } });

describe('sending a box', () => {
  it('creates a free box that travels 25 h and hides its content until then', async () => {
    const box = await sendBox(ctx.app);
    expect(box.link).toBe(`https://play.example.com/santa-box/b/${box.slug}`);
    expect(new Date(box.deliverAt).getTime() - Date.now()).toBeGreaterThan(24.9 * 3_600_000);

    const view = (await ctx.app.inject({ url: `/v1/santa-box/gifts/${box.slug}` })).json();
    expect(view).toMatchObject({ phase: 'in_transit', recipientName: 'แม่', senderName: 'ลูกคนเล็ก' });
    expect(view.payload).toBeUndefined();
    expect(view.voice).toBeUndefined();
  });

  it('rejects bad content and file tricks', async () => {
    const bad = await ctx.app.inject({ method: 'POST', url: '/v1/santa-box/gifts', payload: { recipientName: 'x', payload: { ...payload, gift: { item: 'car', coupon: null } } } });
    expect(bad.statusCode).toBe(422);

    const wrongType = await ctx.app.inject({ method: 'POST', url: '/v1/santa-box/uploads', payload: { kind: 'VOICE', contentType: 'image/png', bytes: 10 } });
    expect(wrongType.json().error.code).toBe('UNSUPPORTED_TYPE');
    const tooBig = await ctx.app.inject({ method: 'POST', url: '/v1/santa-box/uploads', payload: { kind: 'PHOTO', contentType: 'image/jpeg', bytes: 9_000_000 } });
    expect(tooBig.json().error.code).toBe('FILE_TOO_LARGE');

    const box = await sendBox(ctx.app);
    const voiceKey = (await ctx.prisma.gift.findUniqueOrThrow({ where: { slug: box.slug } })).voiceKey;
    const reuse = await ctx.app.inject({ method: 'POST', url: '/v1/santa-box/gifts', payload: { recipientName: 'x', payload, voiceKey, voiceSeconds: 5 } });
    expect(reuse.json().error.code).toBe('BAD_UPLOAD');
  });

  it('shows the box once it arrives; free boxes play 15 s of the voice', async () => {
    const box = await sendBox(ctx.app);
    await arrive(box.slug);
    const view = (await ctx.app.inject({ url: `/v1/santa-box/gifts/${box.slug}` })).json();
    expect(view.phase).toBe('ready');
    expect(view.payload).toEqual(payload);
    expect(view.voice.playableSeconds).toBe(15);
    expect(view.voice.url).toMatch(/^memory:\/\/download\/santa-box\//);

    const opened = (await ctx.app.inject({ method: 'POST', url: `/v1/santa-box/gifts/${box.slug}/open` })).json();
    const days = (new Date(opened.expiresAt).getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(6.9);
    expect(days).toBeLessThanOrEqual(7);
  });
});

describe('paying', () => {
  it('sender pays 25 THB: delivered now, kept a year, link emailed', async () => {
    const box = await sendBox(ctx.app);
    const noToken = await ctx.app.inject({ method: 'POST', url: `/v1/santa-box/gifts/${box.slug}/checkout`, payload: { plan: 'YEAR', payer: 'SENDER' } });
    expect(noToken.statusCode).toBe(403);

    const res = await ctx.app.inject({
      method: 'POST',
      url: `/v1/santa-box/gifts/${box.slug}/checkout`,
      headers: { 'x-sender-token': box.senderToken },
      payload: { plan: 'YEAR', payer: 'SENDER', returnPath: '/santa-box/?sent=' + box.slug },
    });
    expect(res.statusCode).toBe(200);
    const { paymentId, amountSatang, checkoutUrl } = res.json();
    expect(amountSatang).toBe(2_500);
    expect(decodeURIComponent(checkoutUrl)).toContain(`https://play.example.com/santa-box/?sent=${box.slug}&paid=`);

    expect((await webhookPaid(ctx.app, paymentId)).statusCode).toBe(200);
    await webhookPaid(ctx.app, paymentId); // providers retry: must not apply twice

    const manage = (await ctx.app.inject({ url: `/v1/santa-box/gifts/${box.slug}/manage`, headers: { 'x-sender-token': box.senderToken } })).json();
    expect(manage).toMatchObject({ phase: 'ready', plan: 'YEAR' });
    expect(manage.payments).toHaveLength(1);
    expect(manage.payments[0].status).toBe('PAID');
    const view = (await ctx.app.inject({ url: `/v1/santa-box/gifts/${box.slug}` })).json();
    expect(view.voice.playableSeconds).toBe(40);
    expect(ctx.mailer.sent.filter((m) => m.text.includes(box.link))).toHaveLength(1);
    expect(ctx.mailer.sent.find((m) => m.text.includes(box.link))!.text).toContain('support@inzeniths.com');
  });

  it('recipient cannot pay before arrival, can keep forever after, then download', async () => {
    const box = await sendBox(ctx.app);
    const early = await ctx.app.inject({ method: 'POST', url: `/v1/santa-box/gifts/${box.slug}/checkout`, payload: { plan: 'FOREVER', payer: 'RECIPIENT' } });
    expect(early.json().error.code).toBe('RECIPIENT_TOO_EARLY');

    await arrive(box.slug);
    const locked = await ctx.app.inject({ url: `/v1/santa-box/gifts/${box.slug}/download` });
    expect(locked.statusCode).toBe(403);

    const res = await ctx.app.inject({ method: 'POST', url: `/v1/santa-box/gifts/${box.slug}/checkout`, payload: { plan: 'FOREVER', payer: 'RECIPIENT', email: 'mom@example.com' } });
    await webhookPaid(ctx.app, res.json().paymentId);
    const view = (await ctx.app.inject({ url: `/v1/santa-box/gifts/${box.slug}` })).json();
    expect(view).toMatchObject({ plan: 'FOREVER', expiresAt: null });
    const dl = (await ctx.app.inject({ url: `/v1/santa-box/gifts/${box.slug}/download` })).json();
    expect(dl.voiceUrl).toContain(`santa-box-${box.number}-voice.webm`);
  });

  it('sends the payer back inside the Santa Box app only', async () => {
    const box = await sendBox(ctx.app);
    const pay = (returnPath?: string) =>
      ctx.app.inject({ method: 'POST', url: `/v1/santa-box/gifts/${box.slug}/checkout`, headers: { 'x-sender-token': box.senderToken }, payload: { plan: 'YEAR', payer: 'SENDER', returnPath } });
    const home = decodeURIComponent((await pay()).json().checkoutUrl);
    expect(home).toContain('next=https://play.example.com/santa-box/?paid=');
    const outside = decodeURIComponent((await pay('/other-campaign/')).json().checkoutUrl);
    expect(outside).toContain('next=https://play.example.com/santa-box/?paid=');
  });

  it('refuses a return link to another site', async () => {
    const box = await sendBox(ctx.app);
    const res = await ctx.app.inject({
      method: 'POST',
      url: `/v1/santa-box/gifts/${box.slug}/checkout`,
      headers: { 'x-sender-token': box.senderToken },
      payload: { plan: 'YEAR', payer: 'SENDER', returnPath: '//evil.example.com' },
    });
    expect(res.statusCode).toBe(422);
  });
});

describe('clean-up', () => {
  it('deletes expired content and files, keeps names', async () => {
    const box = await sendBox(ctx.app);
    const gift = await ctx.prisma.gift.update({ where: { slug: box.slug }, data: { deliverAt: new Date(Date.now() - 9e8), expiresAt: new Date(Date.now() - 1000) } });
    expect(ctx.storage.keys.has(gift.voiceKey!)).toBe(true);

    await runJobs(ctx.app);
    const after = await ctx.prisma.gift.findUniqueOrThrow({ where: { slug: box.slug } });
    expect(after.purgedAt).not.toBeNull();
    expect(after.payload).toEqual({});
    expect(after.voiceKey).toBeNull();
    expect(after.senderEmail).toBeNull();
    expect(ctx.storage.keys.has(gift.voiceKey!)).toBe(false);
    const view = (await ctx.app.inject({ url: `/v1/santa-box/gifts/${box.slug}` })).json();
    expect(view).toEqual({ phase: 'expired', number: gift.number, recipientName: 'แม่', senderName: 'ลูกคนเล็ก' });
  });

  it('removes file slots nobody used after a day', async () => {
    const up = (await ctx.app.inject({ method: 'POST', url: '/v1/santa-box/uploads', payload: { kind: 'PHOTO', contentType: 'image/jpeg', bytes: 1000 } })).json();
    await ctx.prisma.upload.update({ where: { key: up.key }, data: { createdAt: new Date(Date.now() - 2 * 86_400_000) } });
    await runJobs(ctx.app);
    expect(await ctx.prisma.upload.findUnique({ where: { key: up.key } })).toBeNull();
    expect(ctx.storage.keys.has(up.key)).toBe(false);
  });

  it('health check answers', async () => {
    expect((await ctx.app.inject({ url: '/v1/health' })).json()).toEqual({ ok: true });
  });
});
