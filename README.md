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

1. `ingest/` downloads PPAC's PDF, reads its text with `pdftotext -raw`, and refuses the data if a day is missing, repeated, or an earlier price changed without an approved restatement.
2. `.github/workflows/fuel-ingest.yml` runs that and commits the new rows to `data/fuel/` (`daily.json`, `changes.json`, `meta.json`). It is manual only until the one-week download proof in `fetch-proof.yml` passes.
3. `backend/` is an Express 5 app that reads `data/fuel/` at start. `api/index.js` exposes it as the Vercel function.
4. `frontend/` is a React and Vite portal (home, playground, docs, three guides, status), prerendered to static HTML with a sitemap. Its figures are computed from `data/fuel/` at build time.

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
- `npm run verify`: all of the above, the production build, the built-site tests and the SEO check.

## Status

The fuel module is built and tested but not deployed. What is left, and who does it, is in `docs/GO-LIVE.md`. Monthly petroleum statistics (consumption, production and trade from data.gov.in) are not built. `docs/DECISIONS.md` records why the code looks the way it does, and `docs/DATA-NOTES.md` records how PPAC's file is read and checked.
