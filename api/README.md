# IN ZENITHS Interactive API

หลังบ้านตัวเดียวของทุกแคมเปญ interactive (ตอนนี้มี Santa Box) ใช้ stack เดียวกับระบบลงทะเบียนอีเวนต์

| ส่วน | ใช้ |
|---|---|
| ภาษา / เซิร์ฟเวอร์ | TypeScript, Node 22, Fastify, Zod |
| ฐานข้อมูล | PostgreSQL + Prisma |
| ไฟล์เสียงและรูป | Cloudflare R2 (เบราว์เซอร์อัปโหลด/ดาวน์โหลดตรงผ่านลิงก์ที่เซ็นแล้ว) |
| รับเงิน | Stripe Checkout (PromptPay) |
| อีเมล | Resend |
| งานตามเวลา | ในตัว API ทุก `JOB_INTERVAL_MINUTES` (ลบกล่องหมดอายุ, ลบไฟล์ที่ไม่ได้ใช้, เตือนก่อนคริสต์มาส) |
| ทดสอบ | Vitest + Postgres จำลอง (ไม่ต้องมี Docker) |

## รันในเครื่อง

```bash
npm install
cp .env.example .env
npm run db:dev          # หน้าต่างที่ 1: Postgres ในเครื่อง
npm run db:migrate      # หน้าต่างที่ 2: สร้างตาราง
npm run dev             # API ที่ http://localhost:3100
npm test                # ทดสอบทั้งหมด
```

ตอนพัฒนาไม่ต้องมีบัญชีอะไรเลย: ไฟล์เก็บในหน่วยความจำ, จ่ายเงินเป็นลิงก์ปลอม `/v1/dev/pay/:id`, อีเมลพิมพ์ลง log
ดูข้อมูลในฐานข้อมูลแบบตาราง: `npm run db:studio`

## API ของ Santa Box (`/v1/santa-box`)

| เรียก | ทำอะไร |
|---|---|
| `POST /uploads` `{kind: VOICE\|PHOTO, contentType, bytes}` | ขอช่องอัปโหลด ได้ `key` กับลิงก์ `PUT` ให้เบราว์เซอร์ส่งไฟล์ตรงไป R2 (เสียง ≤ 1.5 MB, รูป ≤ 2 MB) |
| `POST /gifts` | ส่งกล่อง (ฟรีเสมอตอนสร้าง: ถึงใน 25 ชม.) ได้ `slug`, `link`, `number`, `senderToken` |
| `GET /gifts/:slug` | หน้าผู้รับ: `in_transit` (นับถอยหลัง) / `ready` (การ์ด ของ เสียง รูป) / `expired` |
| `POST /gifts/:slug/open` | ผู้รับเปิดกล่อง (กล่องฟรีเริ่มนับ 7 วัน) |
| `GET /gifts/:slug/manage` | ผู้ส่งดูสถานะ (ต้องมี header `X-Sender-Token`) |
| `POST /gifts/:slug/checkout` `{plan: YEAR\|FOREVER, payer: SENDER\|RECIPIENT, email?, deliverAt?, returnPath?}` | สร้างหน้าจ่ายเงิน ได้ `checkoutUrl` (ผู้ส่งต้องส่ง `X-Sender-Token`) |
| `GET /gifts/:slug/download` | แพ็กเกจตลอดไป: ลิงก์ดาวน์โหลดเสียงและรูป |
| `GET /stats` | จำนวนกล่องทั้งหมด (ตัวนับ "กล่องที่ ___") |

อื่นๆ: `POST /v1/payments/webhook` (Stripe เรียก), `GET /v1/health`

**กติกาที่ระบบบังคับ** (อยู่ใน `src/campaigns/santa-box/rules.ts` มีเทสต์ครบ):
- ฟรี: ถึงหลัง 25 ชม., รอเปิด 7 วัน, เปิดแล้วอยู่ 7 วัน, เสียงเล่นได้ 15 วินาทีแรก
- 25 บาท (YEAR): ผู้ส่งจ่าย = ส่งทันทีหรือตั้งเวลา (ไม่เกิน 1 ปี), เก็บ 1 ปี (ถ้าตั้งเวลาไว้ไกล นับ 1 ปีจากวันที่กล่องถึง), เสียง 1 นาที
- 125 บาท (FOREVER): ไม่หมดอายุ ดาวน์โหลดได้, จาก 25 อัปเกรดจ่ายเพิ่ม 100
- ผู้รับจ่ายได้หลังกล่องถึงเท่านั้น (จ่ายเพื่อเก็บ ไม่ใช่เพื่อเปิดก่อน), ไม่มีการเก็บเงินซ้ำแพ็กเกจเดิม
- webhook ถูกเรียกซ้ำกี่ครั้งก็ปรับกล่องครั้งเดียว
- หมดอายุแล้วลบเสียง รูป และข้อความ เหลือแค่ชื่อไว้ให้หน้า "ส่งกล่องกลับ"

## Deploy บน Railway

1. push โฟลเดอร์ `interactive` ขึ้น GitHub
2. Railway → New Project → **Deploy from GitHub repo** → ตั้ง **Root Directory = `interactive/api`** (ระบบอ่าน `railway.json` และ `Dockerfile` เอง)
3. ในโปรเจกต์เดียวกัน **+ New → Database → PostgreSQL**
4. Variables ของ service API:

   | ตัวแปร | ค่า |
   |---|---|
   | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
   | `REAL_IP_HEADER` | `x-real-ip` |
   | `CORS_ORIGINS` | `https://play.inzeniths.com,https://inzeniths.com` |
   | `SANTA_APP_URL` | `https://play.inzeniths.com` |
   | `STORAGE_DRIVER` | `r2` + `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` |
   | `PAYMENT_DRIVER` | `stripe` + `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |
   | `MAIL_DRIVER` | `resend` + `RESEND_API_KEY`, `MAIL_FROM` |

   ถ้าตั้งไม่ครบ API จะไม่ยอมเริ่มและบอกว่าขาดตัวไหน (ห้ามใช้จ่ายเงินปลอมหรือไฟล์ในหน่วยความจำบน production)
5. Settings → Networking → **Custom Domain** `api.inzeniths.com` แล้วเพิ่ม CNAME ที่ Cloudflare DNS
6. ทุกครั้งที่ deploy ระบบรัน `prisma migrate deploy` ก่อนเปิด API ให้อัตโนมัติ
7. **ใช้ 1 replica เท่านั้น** (งานตามเวลารันในตัว API)

### ตั้งค่าบริการภายนอก

- **R2**: Cloudflare → R2 → สร้าง bucket `santa-box` → Manage API Tokens (สิทธิ์ Object Read & Write เฉพาะ bucket นี้) → ตั้ง **CORS** ของ bucket ให้ `PUT` และ `GET` จาก `https://play.inzeniths.com` ได้ (header `Content-Type`)
- **Stripe**: เปิด PromptPay ใน Payment methods → Developers → Webhooks → endpoint `https://api.inzeniths.com/v1/payments/webhook` เลือก event `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired` → คัดลอก signing secret เป็น `STRIPE_WEBHOOK_SECRET` (เริ่มด้วยคีย์ test ก่อน)
- **Resend**: ยืนยันโดเมน `inzeniths.com` (เพิ่ม DNS record ที่ Cloudflare) แล้วตั้ง `MAIL_FROM=Santa Box <hello@inzeniths.com>`

### สำรองข้อมูล
Railway Postgres มี backup ในแผนเสียเงิน หรือใช้ `pg_dump "$DATABASE_URL"` เป็นระยะ แพ็กเกจ "ตลอดไป" สัญญากับลูกค้าไว้ จึงต้องสำรองฐานข้อมูลสม่ำเสมอ (ไฟล์อยู่ใน R2 แยกต่างหาก)

## เพิ่มแคมเปญใหม่
สร้าง `src/campaigns/<ชื่อ>/` (schema, rules, routes) แล้ว register ใน `src/app.ts` ใช้ตาราง `Gift`/`Payment`/`Upload` ร่วมกันโดยแยกด้วยคอลัมน์ `campaign`

## ยังไม่ได้ทำ
- หน้า sender/recipient ยังไม่ได้เรียก API นี้ (ยังส่งแบบกล่องผ่านท้ายลิงก์) ต้องต่อ: อัปโหลดเสียง → `POST /gifts` → หน้าส่งเสร็จใช้ `link` จริง, หน้าผู้รับเปิดที่ `/b/:slug`
- การคืนเงิน (ทำใน Stripe Dashboard ได้ แต่ระบบยังไม่ลดแพ็กเกจกล่องให้อัตโนมัติ)
- ลิงก์ยกเลิกรับอีเมลเตือนแบบกดเอง (ตอนนี้ให้ตอบกลับอีเมล)
