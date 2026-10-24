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

## 2026-10-24 — Manifest (Task 4.2)

- **Slug `india-petroleum`:** the folder name without `-api`, the same slug the portal scaffold derives. `run-checks.js` writes reports to `checklists/<manifest slug>/`, so the checklist folder is `checklists/india-petroleum/`, not the plan's `ppac-petroleum` (written before the rename; Plan issue 7).
- **The manifest describes what is served today:** the fuel module only. Petroleum statistics sit under `not_provided` until Phase 6 ships them; the one-liner and `not_provided` change in the same commit that adds the routes.
- **Deploy URLs stay `null` until the owner deploys** (Task 4.5). `run-checks.js` needs a live origin, so Task 4.4 rehearses the production registry against the local build through an injected fetch and says so in the report; it is not the live proof.
- **`routes` stay empty until go-live:** the validator rejects a route whose base URL is `null`, and a guessed Vercel URL could belong to someone else's site that the checks would then probe. Task 4.5 fills `deploy` and these routes together: portal `/`, `/docs`, `/playground`, `/guides`, `/status`; API `/v1/prices/latest`, `/v1/prices?city=delhi&fuel=petrol&from=2026-05-01&to=2026-05-31`, `/v1/prices/changes?city=delhi&fuel=petrol&from=2026-05-01&to=2026-05-31`, `/v1/cities`, `/v1/meta`, `/health`.
- **No `submission.targets` yet:** a target with `pr: null` makes a passing production run chain into the pre-PR stage and mixes its verdict into production. The public-apis target and row are added at the separate submission step.
- **Licence field:** PPAC's own sentence, not a paraphrase of a licence name, because PPAC publishes terms, not a licence (https://ppac.gov.in/terms-conditions).

## 2026-10-24 — Portal (Task 4.3)

- **Scaffold used for the skeleton only.** `scaffold-frontend.js` ran with the project's real domain passed through its `decideFn` hook (the script hardcodes `finance-tax`). The design chain answered `terminal-dev` / `paper-cobalt` / `inter-jetbrains` with confidences 0.25, 0.73, 0.44, 0.64 (all under the 0.8 auto gate: the model was not sure), and `paper-cobalt` is the GST portal's palette. Its pages are GST-shaped (an HSN playground, a chapters explorer, a ⚡ logo, hardcoded counts), so only the routing, prerender, sitemap and `vercel.json` ideas are kept; every page is rewritten for fuel prices. The route list, 404 page, `SITE_URL` handling and JSON-LD follow the newer EV portal (the scaffold predates `CONVENTIONS.md` on the 404 page and `"framework": "vite"`).
- **Identity: a price circular, derived from the domain.** PPAC publishes a government table of rupee figures; the competitors found in the research (GoodReturns, MyPetrolPrice) are ad-heavy news pages. So: warm paper canvas, ink-green text, a serif for headings (Source Serif 4), IBM Plex Sans for text and IBM Plex Mono for every figure so decimals line up. Two series colours are fixed meanings across the whole site: petrol is deep green `#0B6B50`, diesel is burnt orange `#A23B0C` (distinguishable with red-green colour blindness because of lightness and hue, and always labelled in text). Light theme only (`color-scheme: light`). It shares nothing with the GST (cobalt paper), EV (amber on graphite) or MSP (forest and ochre) portals.
- **Layout rules:** left-aligned, no centred hero stack, no eyebrow labels (banned by the owner), no emoji icons, no card grid, one primary action per screen. The hero leads with the real artifact, today's price board and the 2017-2026 chart, both drawn from `data/fuel/` at build time. No entrance animation; colour transitions of 120 ms at most, off under `prefers-reduced-motion`.
- **Written from memory, not retrieved:** the price board, the SVG chart, the form and the tables. No registry (shadcn, React Bits, Magic UI, Aceternity) ships a price table or a time-series chart that fits a prerendered, dependency-free page, and none of the registries' effects serve this content. Stated here so nobody reads these components as registry code.
- **No chart library.** Eight series of at most 3,417 points are drawn as an SVG path from min/max-decimated data, which prerenders on the server and adds no dependency. A library (uPlot, Recharts) would add 40-90 kB and canvas or client-only rendering for a chart with no zoom requirement.
- **No Tailwind.** Plain CSS with custom properties in `index.css`, as the scaffold does. One stylesheet is easier to audit for contrast and spacing than utility classes across seven pages.
- **Build-time data, run-time API.** `frontend/scripts/build-snapshot.mjs` reads `data/fuel/*.json` into `src/generated/snapshot.json` before every build (the latest day, the Delhi history, the largest moves, counts). Prerendered pages therefore carry real numbers; the playground and status page call the live `/v1` API. The daily data commit redeploys the site, so the snapshot is never older than the data.
- **`SITE_URL`:** the canonical origin comes from `SITE_URL`, else Vercel's `VERCEL_PROJECT_PRODUCTION_URL`, else the build emits no canonical tags, sitemap or robots file (same rule as EV: never point crawlers at a host that is not serving the site). The GSC token file is an owner input and is not invented.
- **Guides:** three, with numbers computed from the stored data and pinned to windows that end on a fixed past date, so a daily append cannot make them false. A test recomputes each number from `data/fuel/`.
