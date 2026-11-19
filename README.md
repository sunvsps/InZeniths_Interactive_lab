# IN ZENITHS Interactive Lab

Interactive campaigns by IN ZENITHS. Each campaign is its own front end under `apps/`; all campaigns share one back end and one database under `api/`.

```
interactive/
  apps/_redirects   routes for play.inzeniths.com (one Cloudflare Pages project for every campaign)
  apps/santa-box/   Santa Box (Christmas 2026): sender + recipient pages
  apps/<next>/      next campaign = a new folder + lines in apps/_redirects
  api/              one back end + one database for all campaigns (Railway)
  shared/           plan for pieces every campaign will reuse
```

## Tech stack

| Part | What | Where | Cost |
|---|---|---|---|
| Domain + DNS | Cloudflare | `inzeniths.com` | ~$10 / year |
| Company site | HTML on Cloudflare Pages | `inzeniths.com` (repo `INZENITH_EVENTS`) | free |
| Campaign pages | HTML + three.js (3D), no build step, on Cloudflare Pages | `play.inzeniths.com/<campaign>/` (this repo, folder `apps`) | free |
| Back end | Node 22, TypeScript, Fastify, Zod | Railway → `api.inzeniths.com` (folder `api`) | ~$5 / month |
| Database | PostgreSQL + Prisma | Railway, same project as the API | included above |
| Voice and photo files | Cloudflare R2 (browser uploads and downloads directly with signed links) | bucket `santa-box` | free up to 10 GB |
| Payments | Stripe Checkout, PromptPay, account type **Individual** (no company needed) | stripe.com | ~1.65% + VAT per payment |
| Email | Brevo HTTPS API (Railway Hobby blocks SMTP) | brevo.com | free 300 / day |
| Tests | Vitest + embedded Postgres (no Docker) | local | – |
| Code | GitHub; push to `main` deploys both Railway and Pages | `sunvsps/InZeniths_Interactive_lab` | free |

The back end uses the same stack as the event registration system (Node + Fastify + Prisma + Postgres on Railway).

## Deploy (order matters: the pages need the API)

1. **R2** (Cloudflare → R2): bucket `santa-box`, CORS for `https://play.inzeniths.com` (GET, PUT, header `Content-Type`), API token with Object Read & Write on that bucket
2. **Stripe** (Individual, Test mode first): turn on PromptPay, copy the secret key
3. **Brevo**: verify `inzeniths.com` (DNS records in Cloudflare), create an API key. Optional at first: `MAIL_DRIVER=console`
4. **Railway**: deploy this repo with Root Directory `api`, add PostgreSQL, set the variables, custom domain `api.inzeniths.com` (CNAME in Cloudflare, DNS only), then the Stripe webhook. Full list: [`api/README.md`](api/README.md)
5. **Turn the pages live**: set `<meta name="santa-api" content="https://api.inzeniths.com">` in `apps/santa-box/sender.html` and `recipient.html`, push
6. **Cloudflare Pages**: connect this repo, framework None, no build command, output directory `apps`, custom domain `play.inzeniths.com`

Check: `https://api.inzeniths.com/v1/health` → `{"ok":true}`, then send a box from `https://play.inzeniths.com/santa-box/` on a real phone.

## Conventions
- Brand: IN ZENITHS is the owner; each app is a campaign. Payments and receipts are issued as IN ZENITHS, with the campaign name on the line item.
- Database: one shared `Gift` table with a `campaign` column (e.g. `santa-box`) and the campaign's own content as JSON, so a new campaign needs no schema change.
- Domain: `inzeniths.com` (bought at Cloudflare, 19 Nov 2026). Company site at the root; campaigns at `play.inzeniths.com/<campaign>/`; API at `api.inzeniths.com`. `play.inzeniths.com/` redirects to `inzeniths.com/interactive`.
- Secrets (Stripe, R2, Brevo keys) live only in Railway variables or a local `.env`, never in git.

## Status (19 Nov 2026)
- `api/`: built and tested (31 tests), not deployed yet.
- `apps/santa-box`: wired to the API and tested end to end locally; still in prototype mode until step 5 above.
- `shared/`: plan only.
