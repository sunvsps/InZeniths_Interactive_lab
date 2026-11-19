// A payment cleared: mark it paid and upgrade the gift, exactly once, however many times the provider retries.
import type { FastifyInstance } from 'fastify';
import { onPaid } from '../campaigns/santa-box/rules.js';
import { giftLink } from '../campaigns/santa-box/routes.js';

export async function markPaid(app: FastifyInstance, ref: { paymentId: string | null; providerRef: string }, email: string | null, now = new Date()) {
  const db = app.prisma;
  const result = await db.$transaction(async (tx) => {
    const payment = ref.paymentId
      ? await tx.payment.findUnique({ where: { id: ref.paymentId }, include: { gift: true } })
      : await tx.payment.findUnique({ where: { providerRef: ref.providerRef }, include: { gift: true } });
    if (!payment) return null;
    // Claim it: only one delivery of the webhook gets past this line.
    const claimed = await tx.payment.updateMany({
      where: { id: payment.id, status: { not: 'PAID' } },
      data: { status: 'PAID', paidAt: now, email: payment.email ?? email },
    });
    if (!claimed.count) return null;
    const change = onPaid(payment.gift, payment, now);
    const gift = await tx.gift.update({ where: { id: payment.giftId }, data: change });
    return { payment: { ...payment, email: payment.email ?? email }, gift };
  });
  if (!result) return false;

  const { payment, gift } = result;
  if (payment.email) {
    const link = giftLink(app.env.SANTA_APP_URL, gift.slug);
    const kept = gift.plan === 'FOREVER' ? 'เก็บไว้ได้ตลอดไป' : `เก็บไว้ได้ถึง ${gift.expiresAt?.toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok' })}`;
    const text =
      payment.payer === 'SENDER'
        ? `กล่องของขวัญถึง ${gift.recipientName} พร้อมแล้ว\n\nส่งลิงก์นี้ให้ผู้รับ: ${link}\nกล่องจะเปิดได้ ${gift.deliverAt.toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })} และ${kept}\n\nขอบคุณที่ใช้ Santa Box`
        : `กล่องของขวัญของคุณ${kept}แล้ว\n\nเปิดดูได้ที่: ${link}\n\nขอบคุณที่ใช้ Santa Box`;
    await app.mailer
      .send({ to: payment.email, subject: payment.payer === 'SENDER' ? 'กล่อง Santa Box ของคุณพร้อมส่งแล้ว' : 'เก็บกล่อง Santa Box ไว้เรียบร้อย', text })
      .catch((e) => app.log.error(e, 'payment email failed'));
  }
  return true;
}

export async function markExpired(app: FastifyInstance, ref: { paymentId: string | null; providerRef: string }) {
  const where = ref.paymentId ? { id: ref.paymentId } : { providerRef: ref.providerRef };
  await app.prisma.payment.updateMany({ where: { ...where, status: 'PENDING' }, data: { status: 'EXPIRED' } });
}
