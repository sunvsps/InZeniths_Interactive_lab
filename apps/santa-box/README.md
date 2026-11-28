# Santa Box (campaign)

Christmas 2026 campaign: the sender wraps a 3D gift box (box design, card, voice, one gift, music) and sends a link; the recipient unties the ribbon and opens it.

| Address | Page |
| --- | --- |
| `https://inzeniths.com/santa` | home: the shared Christmas tree (`tree.html`) |
| `https://inzeniths.com/santa/wrap` | wrap a box (`sender.html`) |
| `https://inzeniths.com/santa/box-<id>` | recipient link, every box (`recipient.html`) |
| `https://inzeniths.com/santa/<name>-<code>` | recipient link a paying sender named, e.g. `sun-to-mom-k7p2` (the `box-` link keeps working) |

The files are hosted by this repo's Pages project (`play.inzeniths.com`); the company site (repo `IN-ZENITHS-COMPANY`, `functions/santa/`) passes `/santa...` on to it. Old links (`play.inzeniths.com/santa-box/...`) redirect.
Requirements: https://claude.ai/artifact/JoFKTcMDDwtpKzgSiXWLDd

| File | What it is | Published prototype |
| --- | --- | --- |
| `sender.html` | Sender: box design, card designer + voice, gift (lid comes off), music (lid closes and the bow pops), delivery and price, "send to whom" sheet, sent screen with copy link, teaser image and IN ZENITHS promo | https://claude.ai/artifact/4gwBv5MKhhcHJg81ozmDUd |
| `recipient.html` | Recipient: waiting countdown, pull the ribbon, card + voice, gift with its meaning, share image, keep (25 / 125 baht), download, send one back | https://claude.ai/artifact/X9uGbmK1xed7jBV1Czep75 |
| `santa-api.js` | Connects both pages to the API (`api/`) | – |
| `i18n.js` | Thai / English: TH·EN switch in the header, dictionary of every text, `?lang=en` to force English | – |
| `../../functions/santa/` | Which page each `/santa...` address shows, and the link preview of a box link | – |
| `../../functions/santa-box/` | Redirects from the old addresses | – |
| `design/promo-options.html` | The 5 IN ZENITHS promo card designs (E was chosen) | https://claude.ai/artifact/Uj7TDM6ido9vYimwxnQPU5 |
| `archive/prototype-v1.html` | First cartoon-style version | https://claude.ai/artifact/WPDHTJTJiYn48pHnHxNQ74 |

Single-page files (HTML, CSS and JS together), no build step. three.js r128 and qrcodejs load from cdnjs. Footer: © IN ZENITHS · support@inzeniths.com.

**Languages:** pages are written in Thai; `i18n.js` swaps every known Thai text for English and back without a reload (names, card message, coupon and engraving are never translated: `data-no-i18n`). New text in a page needs an entry in the dictionary in `i18n.js`, and every English text there must be unique. The language follows `?lang=`, then the saved choice, then the phone's language. The sender's language is saved with the box (emails), the payer's with the payment (Stripe checkout page and receipt email).

## Two modes
- **Prototype** (`<meta name="santa-api" content="">`, the default and the published artifacts): runs on its own with sample data; the design travels in the link hash (`#gift-b<box>-r<ribbon>-a<accents>-c<paper><font>`).
- **Live** (`content="https://api.inzeniths.com"` in both pages): real voice recording (microphone), voice and photo upload, boxes saved in the database, PromptPay checkout through Stripe, custom link names for paid boxes, recipient link `/santa/box-<id>` with countdown, open, voice playback (free = first 15 s), keep or upgrade, download (forever), expired and not-found pages, "send one back" prefill (`/santa/wrap?to=<name>`), real box counter.

Going live = set that meta in `sender.html` and `recipient.html` and push (after the API answers at `https://api.inzeniths.com/v1/health`).

## Run locally against the API
1. In `api/`: `npm run db:dev`, then `npm run db:migrate` and `npm run dev` (port 3100, fake payments, files kept in memory), with `SANTA_APP_URL=http://localhost:8765/santa` in `api/.env`
2. From the repo root (so `functions/` is used): `npx wrangler pages dev apps --port 8765`
3. Open `http://localhost:8765/santa?api=http://localhost:3100` once; the tab remembers the API

Tested end to end on 19 Nov 2026 under `/santa-box/`: free send, paid send (fake checkout and back), countdown, open, real voice playback, photo, coupon, recipient upgrade 25 → forever, download links, expired and missing boxes, send one back, and prototype mode unchanged.

## Moving to inzeniths.com/santa (do in one sitting, in this order)
1. R2 bucket `santa-box` → CORS: add `https://inzeniths.com` to the allowed origins (without it, voice and photo uploads fail)
2. Railway → `CORS_ORIGINS`: make sure it lists `https://inzeniths.com` and `https://play.inzeniths.com`
3. Deploy this repo (API runs the `alias` migration by itself)
4. Deploy the company site (it must deploy from Git or `wrangler pages deploy`, otherwise `functions/` does not run), then open `https://inzeniths.com/santa` and `/santa/wrap`
5. Railway → `SANTA_APP_URL=https://inzeniths.com/santa`
6. Pages project of this repo → variable `SANTA_PUBLIC_URL=https://inzeniths.com/santa`, then redeploy: old links now move to the company domain

Between steps 3 and 5 a paying sender comes back to the home page instead of the "sent" screen (the confirmation email still has the link). Sender tokens saved on `play.inzeniths.com` do not carry over to `inzeniths.com`.

## Not done yet
- Discount codes: Stripe Checkout has its own promo-code box; the code field in the "send to whom" sheet is not wired
- The transit page shows the default box, not the sender's design (the API keeps content hidden until arrival)
- Recording with a real microphone and the 3D lid animation are checked only in the test browser; check once on a real phone
