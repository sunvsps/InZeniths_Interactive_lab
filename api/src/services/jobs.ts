// Housekeeping that runs inside the API every JOB_INTERVAL_MINUTES (one instance only).
import type { FastifyInstance } from 'fastify';
import { reminderYear } from '../campaigns/santa-box/rules.js';
import { appHome } from '../campaigns/santa-box/routes.js';
import { asLang, reminderEmail } from '../campaigns/santa-box/emails.js';

const BATCH = 200;

/** Expired boxes: delete the voice note, photo and message. Names stay so the page can offer "send one back". */
export async function purgeExpired(app: FastifyInstance, now = new Date()) {
  let total = 0;
  for (;;) {
    const gifts = await app.prisma.gift.findMany({
      where: { purgedAt: null, expiresAt: { lte: now } },
      select: { id: true, remindNextYear: true },
      take: BATCH,
    });
    if (!gifts.length) break;
    const ids = gifts.map((g) => g.id);
    const uploads = await app.prisma.upload.findMany({ where: { giftId: { in: ids } }, select: { key: true } });
    await app.storage.remove(uploads.map((u) => u.key));
    await app.prisma.$transaction([
      app.prisma.upload.deleteMany({ where: { giftId: { in: ids } } }),
      app.prisma.gift.updateMany({
        where: { id: { in: ids } },
        data: { purgedAt: now, payload: {}, voiceKey: null, voiceSeconds: null, photoKey: null },
      }),
      // Keep the address only for senders who asked to be reminded next Christmas.
      app.prisma.gift.updateMany({ where: { id: { in: ids }, remindNextYear: false }, data: { senderEmail: null } }),
    ]);
    total += gifts.length;
    if (gifts.length < BATCH) break;
  }
  return total;
}

/** File slots handed out but never attached to a box (the sender gave up). */
export async function purgeOrphanUploads(app: FastifyInstance, now = new Date()) {
  const cutoff = new Date(now.getTime() - 24 * 3_600_000);
  const stale = await app.prisma.upload.findMany({ where: { giftId: null, createdAt: { lt: cutoff } }, select: { id: true, key: true }, take: 1000 });
  if (!stale.length) return 0;
  await app.storage.remove(stale.map((u) => u.key));
  await app.prisma.upload.deleteMany({ where: { id: { in: stale.map((u) => u.id) } } });
  return stale.length;
}

/** 18–24 Dec: one email to each sender who asked, for boxes sent in an earlier year. */
export async function sendChristmasReminders(app: FastifyInstance, now = new Date()) {
  const year = reminderYear(now);
  if (!year) return 0;
  const startOfYear = new Date(Date.UTC(year, 0, 1) - 7 * 3_600_000);
  const gifts = await app.prisma.gift.findMany({
    where: {
      remindNextYear: true,
      senderEmail: { not: null },
      createdAt: { lt: startOfYear },
      OR: [{ remindedForYear: null }, { remindedForYear: { lt: year } }],
    },
    take: 500,
  });
  const done = new Set<string>();
  for (const g of gifts) {
    const to = g.senderEmail!;
    // One email per address, even if they sent several boxes.
    if (!done.has(to)) {
      await app.mailer
        .send({ to, ...reminderEmail({ lang: asLang(g.lang), recipientName: g.recipientName, home: appHome(app.env.SANTA_APP_URL) }) })
        .catch((e) => app.log.error(e, 'reminder email failed'));
      done.add(to);
    }
    await app.prisma.gift.update({ where: { id: g.id }, data: { remindedForYear: year } });
  }
  return gifts.length;
}

export async function runJobs(app: FastifyInstance, now = new Date()) {
  const purged = await purgeExpired(app, now);
  const orphans = await purgeOrphanUploads(app, now);
  const reminded = await sendChristmasReminders(app, now);
  if (purged || orphans || reminded) app.log.info({ purged, orphans, reminded }, 'jobs ran');
  return { purged, orphans, reminded };
}

/** Starts the timer; returns a function that stops it. */
export function startJobs(app: FastifyInstance): () => void {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await runJobs(app);
    } catch (e) {
      app.log.error(e, 'jobs failed');
    } finally {
      running = false;
    }
  };
  const timer = setInterval(tick, app.env.JOB_INTERVAL_MINUTES * 60_000);
  timer.unref();
  void tick();
  return () => clearInterval(timer);
}
