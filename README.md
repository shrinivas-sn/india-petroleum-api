# India Petroleum API

A free, keyless REST API for the daily petrol and diesel retail prices in Delhi, Mumbai, Chennai and Kolkata, one row per day since 16 June 2017. The figures come from the table PPAC publishes for the four metro cities.

Source: Petroleum Planning & Analysis Cell (PPAC), Ministry of Petroleum and Natural Gas, Government of India. PPAC's terms allow reuse free of charge if the material is reproduced accurately and the source is prominently acknowledged: https://ppac.gov.in/terms-conditions. Every API response carries the attribution in `meta.attribution`. This project is not run by PPAC or by any oil marketing company.

## Endpoints

| Route | Returns |
|---|---|
| `GET /v1/prices/latest` | The newest day, all four cities, petrol and diesel |
| `GET /v1/prices?from=&to=[&city=][&fuel=]` | One row per day in the range (at most 3,660 days) |
| `GET /v1/prices/changes[?from=&to=&city=&fuel=]` | Only the days a price moved, with the price before and after |
| `GET /v1/cities` | The four city slugs |
| `GET /v1/meta` | Source file URL and SHA-256, download time, first and last date, `days_behind` |
| `GET /health` | API name, coverage and endpoint list |

Dates are `YYYY-MM-DD`. Errors use `{ "success": false, "error": { "code", "message" } }`. The rate limit is 100 requests per 15 minutes per IP address, counted separately on each server instance. The portal's Docs page lists every parameter and error code with real responses.

## How it works

The API serves stored JSON and never calls PPAC when a request arrives.

1. `ingest/` downloads PPAC's PDF, reads its text with `pdftotext -raw`, and refuses the data if a day is missing or repeated, an earlier price changed without an approved restatement, or a price looks wrong (outside 20 to 500 rupees, or a move of more than 20 from the day before). `docs/GO-LIVE.md` says what to do when it refuses.
2. `.github/workflows/fuel-ingest.yml` runs that every three hours and commits the new rows to `data/fuel/` (`daily.json`, `changes.json`, `meta.json`). It retries the PPAC pages and the download, treats an older PPAC file as a no-op, and keeps one rolling "ingest failed" issue.
3. `backend/` is an Express 5 app. It starts from the `data/fuel/` files bundled with it, then fetches the newest files from this repository's raw URL at most once per `DATA_TTL_SECONDS`, validates them, and swaps them in only if they pass. On any failure it keeps the last good data and says why in `/v1/meta` (`data_source`, `checked_at`, `refresh_error`). `api/index.js` exposes it as the Vercel function.
4. `frontend/` is a React and Vite portal (home, playground, docs, three guides, status), prerendered to static HTML with a sitemap. The prerendered page carries the figures from the build; in the browser every figure, the chart and the playground come from the API, counted back from the newest day it reports. If the API cannot be reached, the page keeps the build figures and says so; a banner on every page appears when the newest price is more than two days old.

### Settings

All optional; set them as environment variables on the server.

| Variable | Default | Effect |
|---|---|---|
| `DATA_REMOTE` | on | `off` serves only the data bundled with the deploy (local runs and tests) |
| `DATA_BASE_URL` | this repository's `main` branch, `data/fuel` on raw.githubusercontent.com | Where the newest data files are fetched from; must be https |
| `DATA_TTL_SECONDS` | `600` | Least time between checks for newer data on one server instance (values under 30 are ignored) |
| `PORT` | `3000` | Port for `npm start` |
| `SITE_URL` | Vercel's production host | Canonical origin for the sitemap and canonical tags; without one the build emits none |

## Run it

Node 22 or newer.

```bash
npm install
npm start                     # API on the port in PORT, default 3000
cd frontend && npm install && npm run build   # portal into frontend/dist, served by the same app
```

## Tests

- `npm test`: the ingest and backend tests.
- `npm run test:frontend`: the frontend tests, including a check that every number the guides quote matches the data.
- `npm run verify`: all of the above, the production build, the built-site tests and the SEO check. `.github/workflows/ci.yml` runs it on every push to main and every pull request.

## Status

The fuel module is live at https://india-petroleum-api.vercel.app (deployed from the local source with the Vercel CLI). New data reaches it without a deploy, because the API reads the repository. The Vercel project is not yet linked to this GitHub repository, so a code change needs `vercel deploy --prod`; what is left, and who does it, is in `docs/GO-LIVE.md`. Monthly petroleum statistics (consumption, production and trade from data.gov.in) are not built. `docs/DECISIONS.md` records why the code looks the way it does, and `docs/DATA-NOTES.md` records how PPAC's file is read and checked.
