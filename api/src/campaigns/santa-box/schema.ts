// What a Santa Box holds. The ids match the sender and recipient pages (apps/santa-box).
import { z } from 'zod';

export const CAMPAIGN = 'santa-box';

const text = (max: number) => z.string().trim().max(max);

export const GIFT_ITEMS = ['bear', 'ginger', 'choco', 'orn', 'globe', 'stock'] as const;
export const SONGS = ['silent', 'wish', 'jingle', 'none'] as const;
export const ACCENTS = ['b', 'p', 'h', 'c', 'l'] as const;

export const santaPayload = z.object({
  design: z.object({
    box: z.number().int().min(0).max(5),
    ribbon: z.number().int().min(0).max(5),
    accents: z.array(z.enum(ACCENTS)).max(ACCENTS.length).refine((a) => new Set(a).size === a.length, 'duplicate accent'),
    paper: z.number().int().min(0).max(4),
    font: z.number().int().min(0).max(2),
  }),
  card: z.object({
    message: text(280),
  }),
  gift: z.object({
    item: z.enum(GIFT_ITEMS),
    /** Only for the engraved ornament ("orn"). */
    engraving: text(24).optional(),
    /** Promise coupon; null = the sender removed it. */
    coupon: text(80).nullable(),
  }),
  music: z.enum(SONGS),
});

export type SantaPayload = z.infer<typeof santaPayload>;

export const createGiftBody = z.object({
  recipientName: text(30).min(1),
  senderName: text(30).optional(),
  senderEmail: z.email().max(200).optional(),
  payload: santaPayload,
  /** Keys from POST /santa-box/uploads. */
  voiceKey: z.string().max(200).optional(),
  /** Length of the recording in seconds, as measured by the page. */
  voiceSeconds: z.number().int().min(1).max(60).optional(),
  photoKey: z.string().max(200).optional(),
  remindNextYear: z.boolean().default(false),
  showUnderTree: z.boolean().default(false),
});
