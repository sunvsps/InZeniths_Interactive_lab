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
    expect(box.link).toBe(`https://example.com/santa/box-${box.slug}`);
    expect(new Date(box.deliverAt).getTime() - Date.now()).toBeGreaterThan(24.9 * 3_600_000);

    const view = (await ctx.app.inject({ url: `/v1/santa-box/gifts/${box.slug}` })).json();
    expect(view).toMatchObject({ phase: 'in_transit', recipientName: 'แม่', senderName: 'ลูกคนเล็ก' });
    expect(view.payload).toBeUndefined();
    expect(view.voice).toBeUndefined();
    expect(view.design).toEqual(payload.design); // the waiting page shows the box as designed
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
      payload: { plan: 'YEAR', payer: 'SENDER', returnPath: '/santa/wrap?sent=' + box.slug },
    });
    expect(res.statusCode).toBe(200);
    const { paymentId, amountSatang, checkoutUrl } = res.json();
    expect(amountSatang).toBe(2_500);
    expect(decodeURIComponent(checkoutUrl)).toContain(`https://example.com/santa/wrap?sent=${box.slug}&paid=`);

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
    expect(home).toContain('next=https://example.com/santa/?paid=');
    const outside = decodeURIComponent((await pay('/other-campaign/')).json().checkoutUrl);
    expect(outside).toContain('next=https://example.com/santa/?paid=');
  });

  it('English sender: English checkout and email; Thai stays the default', async () => {
    const box = await sendBox(ctx.app, { lang: 'en' });
    expect((await ctx.prisma.gift.findUniqueOrThrow({ where: { slug: box.slug } })).lang).toBe('en');
    const res = await ctx.app.inject({
      method: 'POST',
      url: `/v1/santa-box/gifts/${box.slug}/checkout`,
      headers: { 'x-sender-token': box.senderToken },
      payload: { plan: 'YEAR', payer: 'SENDER' },
    });
    const { paymentId } = res.json();
    expect((await ctx.prisma.payment.findUniqueOrThrow({ where: { id: paymentId } })).lang).toBe('en');
    await webhookPaid(ctx.app, paymentId);
    const mail = ctx.mailer.sent.find((m) => m.text.includes(box.link))!;
    expect(mail.subject).toBe('Your Santa Box is ready to send');
    expect(mail.text).toContain('Questions or problems? Contact support@inzeniths.com');

    const thai = await sendBox(ctx.app);
    expect((await ctx.prisma.gift.findUniqueOrThrow({ where: { slug: thai.slug } })).lang).toBe('th');
  });

  it('discount code: checked on our page, applied at checkout', async () => {
    const ok = await ctx.app.inject({ method: 'POST', url: '/v1/santa-box/promo', payload: { code: 'test20', plan: 'YEAR' } });
    expect(ok.json()).toMatchObject({ code: 'TEST20', baseSatang: 2_500, discountSatang: 500, amountSatang: 2_000 });
    const free = await ctx.app.inject({ method: 'POST', url: '/v1/santa-box/promo', payload: { code: 'FREE100', plan: 'FOREVER' } });
    expect(free.json().amountSatang).toBe(0);
    const bad = await ctx.app.inject({ method: 'POST', url: '/v1/santa-box/promo', payload: { code: 'NOPE', plan: 'YEAR' } });
    expect(bad.statusCode).toBe(409);
    expect(bad.json().error.code).toBe('PROMO_INVALID');

    const box = await sendBox(ctx.app);
    const res = await ctx.app.inject({
      method: 'POST',
      url: `/v1/santa-box/gifts/${box.slug}/checkout`,
      headers: { 'x-sender-token': box.senderToken },
      payload: { plan: 'YEAR', payer: 'SENDER', promoCode: 'TEST20' },
    });
    expect(res.json().amountSatang).toBe(2_000);
    const wrong = await ctx.app.inject({
      method: 'POST',
      url: `/v1/santa-box/gifts/${box.slug}/checkout`,
      headers: { 'x-sender-token': box.senderToken },
      payload: { plan: 'YEAR', payer: 'SENDER', promoCode: 'NOPE' },
    });
    expect(wrong.json().error.code).toBe('PROMO_INVALID');
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

describe('naming the link', () => {
  const name = (ref: string, value: string, token?: string) =>
    ctx.app.inject({ method: 'POST', url: `/v1/santa-box/gifts/${ref}/alias`, headers: token ? { 'x-sender-token': token } : {}, payload: { name: value } });
  const paidBox = async () => {
    const box = await sendBox(ctx.app);
    const res = await ctx.app.inject({
      method: 'POST',
      url: `/v1/santa-box/gifts/${box.slug}/checkout`,
      headers: { 'x-sender-token': box.senderToken },
      payload: { plan: 'YEAR', payer: 'SENDER' },
    });
    await webhookPaid(ctx.app, res.json().paymentId);
    return box;
  };

  it('is for the sender of a paid box only', async () => {
    const free = await sendBox(ctx.app);
    expect((await name(free.slug, 'sun-to-mom', free.senderToken)).json().error.code).toBe('ALIAS_NEEDS_PLAN');
    const box = await paidBox();
    expect((await name(box.slug, 'sun-to-mom')).statusCode).toBe(403);
    expect((await name(box.slug, 'sun-to-mom', free.senderToken)).statusCode).toBe(403);
  });

  it('adds a random ending, and both links open the box', async () => {
    const box = await paidBox();
    const res = await name(box.slug, '  Sun to  Mom ', box.senderToken);
    expect(res.statusCode).toBe(200);
    const { alias, link } = res.json();
    expect(alias).toMatch(/^sun-to-mom-[a-z2-9]{4}$/);
    expect(link).toBe(`https://example.com/santa/${alias}`);

    for (const ref of [alias, alias.toUpperCase(), box.slug]) {
      const view = (await ctx.app.inject({ url: `/v1/santa-box/gifts/${ref}` })).json();
      expect(view).toMatchObject({ phase: 'ready', number: box.number });
    }
    const manage = (await ctx.app.inject({ url: `/v1/santa-box/gifts/${box.slug}/manage`, headers: { 'x-sender-token': box.senderToken } })).json();
    expect(manage).toMatchObject({ alias, link });
    const opened = await ctx.app.inject({ method: 'POST', url: `/v1/santa-box/gifts/${alias}/open` });
    expect(opened.json().openedAt).not.toBeNull();

    // two people may pick the same name: each gets their own ending
    const other = await paidBox();
    expect((await name(other.slug, 'sun-to-mom', other.senderToken)).json().alias).not.toBe(alias);
  });

  it('can be done once, even by two requests at once', async () => {
    const box = await paidBox();
    const both = await Promise.all([name(box.slug, 'first-name', box.senderToken), name(box.slug, 'second-name', box.senderToken)]);
    expect(both.map((r) => r.statusCode).sort()).toEqual([200, 409]);
    expect((await name(box.slug, 'third-name', box.senderToken)).json().error.code).toBe('ALIAS_ALREADY_SET');
  });

  it('refuses names that do not fit in a link', async () => {
    const box = await paidBox();
    for (const bad of ['ab', 'a'.repeat(31), 'แม่', 'mom/dad', 'box', 'box-abc', '---', 'sun.to.mom']) {
      expect((await name(box.slug, bad, box.senderToken)).json().error?.code, bad).toBe('BAD_ALIAS');
    }
  });
});

describe('shared Christmas tree', () => {
  it('shows only the look of the newest boxes', async () => {
    const design = (box: string) => ({ ...payload, design: { ...payload.design, box, ribbon: '#f06292' } });
    await sendBox(ctx.app, { payload: design('#123456') });
    await sendBox(ctx.app, { payload: design('#654321') });
    const res = await ctx.app.inject({ url: '/v1/santa-box/tree' });
    expect(res.statusCode).toBe(200);
    const tree = res.json() as { total: number; boxes: Record<string, unknown>[] };
    expect(tree.total).toBe(await ctx.prisma.gift.count({ where: { campaign: 'santa-box' } }));
    expect(tree.boxes.slice(0, 2)).toEqual([
      { box: '#654321', ribbon: '#f06292', accents: ['b', 'h'] },
      { box: '#123456', ribbon: '#f06292', accents: ['b', 'h'] },
    ]);
    expect(tree.boxes.length).toBeLessThanOrEqual(60);
    for (const b of tree.boxes) expect(Object.keys(b).sort()).toEqual(['accents', 'box', 'ribbon']);
    expect(res.body).not.toMatch(/แม่|ลูกคนเล็ก|sender@example\.com|ขอบคุณ/);
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
