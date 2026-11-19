# Santa Box (campaign)

Christmas 2026 campaign: the sender wraps a 3D gift box (box design, card, voice, one gift, music) and sends a link; the recipient unties the ribbon and opens it.

| File | What it is | Published prototype |
| --- | --- | --- |
| `sender.html` | Sender: box design, card designer + voice, gift (lid comes off), music (lid closes and the bow pops), delivery and price, "send to whom" sheet, sent screen with copy link, teaser image and IN ZENITHS promo | https://claude.ai/artifact/4gwBv5MKhhcHJg81ozmDUd |
| `recipient.html` | Recipient: waiting countdown, pull the ribbon, card + voice, gift with its meaning, share image, keep (25 / 125 baht), send one back | https://claude.ai/artifact/X9uGbmK1xed7jBV1Czep75 |
| `archive/prototype-v1.html` | First cartoon-style version | https://claude.ai/artifact/WPDHTJTJiYn48pHnHxNQ74 |

Requirements: https://claude.ai/artifact/JoFKTcMDDwtpKzgSiXWLDd

| `santa-api.js` | Connects both pages to the API (`interactive/api`) | – |
| `../_redirects` | Cloudflare Pages routes for `play.inzeniths.com`: `/santa-box/` → sender, `/santa-box/b/<id>` → recipient | – |

## Two modes
- **Prototype** (`<meta name="santa-api" content="">`, the default and the published artifacts): runs on its own with sample data; the design travels in the link hash (`#gift-b<box>-r<ribbon>-a<accents>-c<paper><font>`).
- **Live** (`content="https://api.inzeniths.com"`): real voice recording (microphone), voice and photo upload, boxes saved in the database, PromptPay checkout, recipient link `/santa-box/b/<id>` with countdown, open, voice playback (free = first 15 s), keep or upgrade, download (forever), expired / not-found pages, "send one back" prefill (`/santa-box/?to=<name>`), real box counter.

## Run locally against the API
1. In `interactive/api`: `npm run db:dev`, then `npm run db:migrate` and `npm run dev` (port 3100, fake payments, files kept in memory)
2. Serve the `apps/` folder with `apps/_redirects` applied (Cloudflare Pages does this; locally `npx wrangler pages dev apps`), e.g. on port 8765, with `SANTA_APP_URL=http://localhost:8765/santa-box` in the API's `.env`
3. Open `http://localhost:8765/santa-box/?api=http://localhost:3100` once; the tab remembers the API

Tested end to end on 19 Nov 2026: free send, paid send (fake checkout and back), countdown, open, real voice playback, photo, coupon, recipient upgrade 25 → forever, download links, expired and missing boxes, send one back, and prototype mode unchanged.

## Not done yet
- Discount codes (Stripe Checkout has its own promo-code box; the sheet's code field is not wired)
- The transit page shows the default box, not the sender's design (the API keeps content hidden until arrival)
