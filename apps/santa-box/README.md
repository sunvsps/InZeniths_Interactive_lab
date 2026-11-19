# Santa Box (campaign)

Christmas 2026 campaign: the sender wraps a 3D gift box (box design, card, voice, one gift, music) and sends a link; the recipient unties the ribbon and opens it.

Live address (after deploy): `https://play.inzeniths.com/santa-box/` · recipient links: `https://play.inzeniths.com/santa-box/b/<id>`
Requirements: https://claude.ai/artifact/JoFKTcMDDwtpKzgSiXWLDd

| File | What it is | Published prototype |
| --- | --- | --- |
| `sender.html` | Sender: box design, card designer + voice, gift (lid comes off), music (lid closes and the bow pops), delivery and price, "send to whom" sheet, sent screen with copy link, teaser image and IN ZENITHS promo | https://claude.ai/artifact/4gwBv5MKhhcHJg81ozmDUd |
| `recipient.html` | Recipient: waiting countdown, pull the ribbon, card + voice, gift with its meaning, share image, keep (25 / 125 baht), download, send one back | https://claude.ai/artifact/X9uGbmK1xed7jBV1Czep75 |
| `santa-api.js` | Connects both pages to the API (`api/`) | – |
| `../_redirects` | Cloudflare Pages routes: `/santa-box/` → sender, `/santa-box/b/<id>` → recipient | – |
| `design/promo-options.html` | The 5 IN ZENITHS promo card designs (E was chosen) | https://claude.ai/artifact/Uj7TDM6ido9vYimwxnQPU5 |
| `archive/prototype-v1.html` | First cartoon-style version | https://claude.ai/artifact/WPDHTJTJiYn48pHnHxNQ74 |

Single-page files (HTML, CSS and JS together), no build step. three.js r128 and qrcodejs load from cdnjs. Footer: © IN ZENITHS.

## Two modes
- **Prototype** (`<meta name="santa-api" content="">`, the default and the published artifacts): runs on its own with sample data; the design travels in the link hash (`#gift-b<box>-r<ribbon>-a<accents>-c<paper><font>`).
- **Live** (`content="https://api.inzeniths.com"` in both pages): real voice recording (microphone), voice and photo upload, boxes saved in the database, PromptPay checkout through Stripe, recipient link `/santa-box/b/<id>` with countdown, open, voice playback (free = first 15 s), keep or upgrade, download (forever), expired and not-found pages, "send one back" prefill (`/santa-box/?to=<name>`), real box counter.

Going live = set that meta in `sender.html` and `recipient.html` and push (after the API answers at `https://api.inzeniths.com/v1/health`).

## Run locally against the API
1. In `api/`: `npm run db:dev`, then `npm run db:migrate` and `npm run dev` (port 3100, fake payments, files kept in memory), with `SANTA_APP_URL=http://localhost:8765/santa-box` in `api/.env`
2. Serve the `apps/` folder with `apps/_redirects` applied (Cloudflare Pages does this; locally `npx wrangler pages dev apps --port 8765`)
3. Open `http://localhost:8765/santa-box/?api=http://localhost:3100` once; the tab remembers the API

Tested end to end on 19 Nov 2026 under `/santa-box/`: free send, paid send (fake checkout and back), countdown, open, real voice playback, photo, coupon, recipient upgrade 25 → forever, download links, expired and missing boxes, send one back, and prototype mode unchanged.

## Not done yet
- Discount codes: Stripe Checkout has its own promo-code box; the code field in the "send to whom" sheet is not wired
- The transit page shows the default box, not the sender's design (the API keeps content hidden until arrival)
- Recording with a real microphone and the 3D lid animation are checked only in the test browser; check once on a real phone
