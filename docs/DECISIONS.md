# Decisions log

Decisions for the India Petroleum API (PPAC data). Newest at the bottom. Written before the code that follows them.

## 2026-10-22 — Source, shape and ingestion (from the PLAN)

- **Source:** PPAC's daily metro PDF ("RSP of Petrol and Diesel in Metro Cities since 16.6.2017"), reuse allowed free with accurate reproduction and acknowledgement (https://ppac.gov.in/terms-conditions). OMC sites are not a source (they bar database building).
- **Serving:** the public API reads stored JSON only. It never calls PPAC at request time; a separate Actions job downloads, parses, checks and commits the data.
- **Scope v1, module A:** four metros (Delhi, Mumbai, Chennai, Kolkata), petrol and diesel, daily since 2017-06-16. Module B (monthly statistics from data.gov.in) follows and needs the owner's key and licence reading.
- **Project name:** `india-petroleum-api` (renamed from `ppac-petroleum-api` on 22/10/2026 at the owner's request).

## 2026-10-24 — Build decisions

- **Order:** the owner asked to build now instead of waiting for the Phase 1 proof week. Offline phases run ahead; deploy, the production cron and retiring `fetch-proof.yml` still wait for the Phase 1 verdict (Plan issue 4).
- **Text extraction:** `pdftotext -raw` read as tokens. `-layout` is wrong for this file (Plan issue 5). Same 3,417 days from Xpdf 4.00 and poppler 26.01.0.
- **Stored format:** `data/fuel/daily.json` one day per line, oldest first; `changes.json` one price move per line; `meta.json` with source URL, posted date, sha256, fetch time, range. A daily append is a one-line diff.
- **Provenance is never guessed:** the builder takes the PDF, its URL and its fetch time as inputs and hashes the PDF itself.
- **Date meaning:** `date` is PPAC's "Date of Revision" as published. PPAC's footnote says a daily change applies from 6:00 AM; the API does not claim a pump date.
- **Module type:** the whole repo is ES modules (`"type": "module"`), backend included. Express 5, `cors`, `express-rate-limit` 8.
- **Library facts used (context-brief, 2026-10-24):** `express@5.3.0` is npm latest; `express-rate-limit@8.7.1` is latest, uses `limit` (not `max`), `ipv6Subnet` 56 and `standardHeaders: 'draft-8'` (Context7 `/express-rate-limit/express-rate-limit`); `app.set('trust proxy', 1)` is spoof-safe on Vercel (cached brief `vercel-express-function-region-cache`, verified 2026-10-15); Express 5 needs a 4-argument error handler after the 404 handler to keep errors as JSON (cached brief `express-5-error-handling`, 30-day TTL expired 2026-09-15, so the project's own tests re-check 404 and 500 and a malformed query as JSON).
- **Rate-limit headers off:** the CDN caches `/v1` responses (`s-maxage`), and a cached `RateLimit-Remaining` is served stale to every caller; the limiter stays at 100 requests per 15 minutes per IP with `RATE_LIMITED` in the envelope.
