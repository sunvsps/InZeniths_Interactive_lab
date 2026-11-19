# IN ZENITH Interactive

Interactive campaigns by IN ZENITH. Each campaign is its own front end under `apps/`; all campaigns share one back end and one database under `api/`, and reusable pieces under `shared/`.

```
interactive/
  apps/santa-box/   Santa Box (Christmas 2026): sender + recipient pages
  apps/<next>/      next campaign
  shared/           pieces every campaign reuses (share image, QR, "send to whom" sheet, payment sheet, 3D kit, IN ZENITH promo card)
  api/              one back end + one database for all campaigns
```

## Conventions
- Brand: IN ZENITH is the owner; each app is a campaign. Payments and receipts are issued as IN ZENITH, with the campaign name on the line item.
- Database: one shared `gifts` table with a `campaign` column (e.g. `santa-box`) and the campaign's own design data as JSON, so a new campaign needs no schema change.
- Domain: `inzeniths.com` (bought at Cloudflare, 19 Nov 2026). Company site at the root; campaigns on subdomains (e.g. `santa.inzeniths.com`); API at `api.inzeniths.com`.
- Deploy: each app is a Cloudflare Pages site (e.g. `santa.inzeniths.com`); the back end is one Railway service + Postgres (`api.inzeniths.com`), files in Cloudflare R2. See `api/README.md`.

## Status
- `api/` is built and tested (Santa Box endpoints, payments, file uploads, clean-up jobs), not deployed yet.
- `apps/santa-box` is still a clickable prototype: the pages do not call the API yet. See its README.
- `shared/` holds plans only.
