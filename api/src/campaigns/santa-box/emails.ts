// Santa Box emails in Thai and English. Every email comes from noreply@, so each ends with the support address.
export type Lang = 'th' | 'en';
export const asLang = (v: string | null | undefined): Lang => (v === 'en' ? 'en' : 'th');

const FOOTER: Record<Lang, string> = {
  th: '\n\n—\nมีปัญหาหรือคำถาม ติดต่อ support@inzeniths.com\nSanta Box by IN ZENITHS',
  en: '\n\n—\nQuestions or problems? Contact support@inzeniths.com\nSanta Box by IN ZENITHS',
};

const when = (d: Date, lang: Lang) =>
  d.toLocaleString(lang === 'en' ? 'en-GB' : 'th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'medium', timeStyle: 'short' });
const day = (d: Date, lang: Lang) => d.toLocaleDateString(lang === 'en' ? 'en-GB' : 'th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'medium' });

export function paymentEmail(input: {
  lang: Lang;
  payer: 'SENDER' | 'RECIPIENT';
  recipientName: string;
  link: string;
  deliverAt: Date;
  plan: 'FREE' | 'YEAR' | 'FOREVER';
  expiresAt: Date | null;
}) {
  const { lang, link } = input;
  if (lang === 'en') {
    const kept = input.plan === 'FOREVER' ? 'kept forever' : `kept until ${input.expiresAt ? day(input.expiresAt, lang) : ''}`;
    return input.payer === 'SENDER'
      ? {
          subject: 'Your Santa Box is ready to send',
          text: `Your gift box for ${input.recipientName} is ready.\n\nSend them this link: ${link}\nIt opens on ${when(input.deliverAt, lang)} and is ${kept}.\n\nThank you for using Santa Box${FOOTER.en}`,
        }
      : { subject: 'Your Santa Box is kept', text: `Your gift box is now ${kept}.\n\nOpen it any time: ${link}\n\nThank you for using Santa Box${FOOTER.en}` };
  }
  const kept = input.plan === 'FOREVER' ? 'เก็บไว้ได้ตลอดไป' : `เก็บไว้ได้ถึง ${input.expiresAt ? day(input.expiresAt, lang) : ''}`;
  return input.payer === 'SENDER'
    ? {
        subject: 'กล่อง Santa Box ของคุณพร้อมส่งแล้ว',
        text: `กล่องของขวัญถึง ${input.recipientName} พร้อมแล้ว\n\nส่งลิงก์นี้ให้ผู้รับ: ${link}\nกล่องจะเปิดได้ ${when(input.deliverAt, lang)} และ${kept}\n\nขอบคุณที่ใช้ Santa Box${FOOTER.th}`,
      }
    : { subject: 'เก็บกล่อง Santa Box ไว้เรียบร้อย', text: `กล่องของขวัญของคุณ${kept}แล้ว\n\nเปิดดูได้ที่: ${link}\n\nขอบคุณที่ใช้ Santa Box${FOOTER.th}` };
}

export function reminderEmail(input: { lang: Lang; recipientName: string; home: string }) {
  return input.lang === 'en'
    ? {
        subject: "Christmas is here again. Wrap a box for someone you love?",
        text: `Last year you sent a Santa Box to ${input.recipientName}.\nWrap a new one here: ${input.home}\n\n(Don't want these emails? Tell us at support@inzeniths.com)${FOOTER.en}`,
      }
    : {
        subject: 'คริสต์มาสมาอีกแล้ว ห่อกล่องให้คนที่คุณรักกันไหม',
        text: `ปีที่แล้วคุณส่ง Santa Box ให้ ${input.recipientName}\nปีนี้ห่อกล่องใหม่ได้ที่ ${input.home}\n\n(ไม่อยากได้อีเมลนี้อีก แจ้งเราที่ support@inzeniths.com)${FOOTER.th}`,
      };
}

/** Name of the line item on the Stripe checkout page. */
export function checkoutTitle(lang: Lang, plan: 'YEAR' | 'FOREVER', upgrade: boolean) {
  if (lang === 'en') return plan === 'FOREVER' ? (upgrade ? 'Santa Box: upgrade to keep forever' : 'Santa Box: keep forever') : 'Santa Box: keep 1 year';
  return plan === 'FOREVER' ? (upgrade ? 'Santa Box: อัปเกรดเก็บตลอดไป' : 'Santa Box: เก็บตลอดไป') : 'Santa Box: เก็บ 1 ปี';
}
