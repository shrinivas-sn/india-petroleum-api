# Candidate: Daily Indian Fuel Prices (Petrol/Diesel) API

Date: 2026-09-25
Researched by: api-idea-scout (discovery mode, deep research via subagent)

## Idea

A free, keyless REST API serving daily petrol and diesel prices across ~750 Indian cities and
districts, updated once daily at 6:00 AM IST under the dynamic daily pricing regime
introduced in June 2017 by IOCL, BPCL, and HPCL.

Logistics platforms, fleet management tools, ride-sharing apps, consumer finance calculators,
and personal budgeting apps all need daily fuel prices. Every single past open-source attempt
(6+ GitHub projects) died when Heroku killed its free tier in November 2022. Commercial
alternatives charge ₹399–₹199/month with mandatory API keys.

## Data source

Primary publishers:
- Indian Oil Corporation Ltd (IOCL): `iocl.com`
- Bharat Petroleum Corporation Ltd (BPCL): `bharatpetroleum.in`
- Hindustan Petroleum Corporation Ltd (HPCL): `hindustanpetroleum.com`

Government statistical aggregator:
- Petroleum Planning & Analysis Cell (PPAC), Ministry of Petroleum & Natural Gas:
  `ppac.gov.in` — publishes historical daily/monthly tables for 4 metro cities and price
  build-up breakdowns.

Secondary aggregators (commonly used by commercial API providers):
- GoodReturns (`goodreturns.in/petrol-price.html`)
- MyPetrolPrice (`mypetrolprice.com`)

## License findings

**BPCL Website Terms (`bharatpetroleum.in`):**
> "All rights, including copyright and intellectual property rights in all material presented
> on bharatpetroleum.in are fully owned by BPCL. No part of the website may be reproduced,
> transmitted, stored in any other website, or disseminated in any form without prior written
> permission from BPCL. Users are strictly prohibited from creating a database by downloading
> and storing parts of the website."

**IOCL Website Terms (`iocl.com`):**
> "All content, designs, logos, images, and materials displayed on its website are protected
> by copyright. Unauthorized reproduction, distribution, or modification of any content from
> the site is strictly prohibited."

**Legal analysis under Indian Copyright Act:**
Under Section 13 and *Eastern Book Company v. D.B. Modak (2008 INSC)*, raw factual data
(daily commodity prices) is not copyrightable — the "modicum of creativity" standard requires
creative expression, which purely factual price compilations lack. However, the OMC *Terms of
Service* explicitly prohibit scraping their websites to build third-party databases, and IOCL
uses Sucuri CloudProxy WAF to enforce this.

**Practical ingestion path:** Commercial APIs (PurePriceIO, IndianAPI) bypass direct OMC
scraping by harvesting from news media aggregators (GoodReturns, NDTV). The legal basis for
this secondary path is weaker and harder to confirm for an open-source project held to the
standard of criterion 1.

Criterion 1 is **unconfirmed** — raw prices are factual/non-copyrightable in theory, but the
primary sources' Terms of Service explicitly prohibit database creation from their websites,
and the secondary aggregator path lacks confirmed redistribution rights.

## Duplication check

**public-apis.io & public-apis GitHub:** Zero results for Indian fuel/petrol/diesel.

**All past open-source APIs are dead:**
- `anshikakaythwas/fuel-prices-india-api`: 404 (Heroku, last push Feb 2021)
- `PremApk/Petrol-Price-API`: 404 (Heroku, last push Jan 2022)
- `AnkitVats21/fuel-price-api`: 404 (Heroku, last push Dec 2020)
- `gokulkrishh/fuel-price`: Broken frontend (Surge, last push Sep 2021)
- `phalgun/fuelprice-api`: Abandoned (last push Nov 2013)

**Commercial alternatives (all require API key):**
- PurePriceIO: ₹399 for 500 credits (~₹0.80/call)
- IndianAPI: Hobby tier 1,000 req, paid plans above
- RapidAPI listings: $9.90–$199.90/month
- APIclub/Surepass: Enterprise contracts

No free, keyless, working API exists today.

Criterion 2 is a clean **pass**.

## Update cadence

Daily at 6:00 AM IST, mandated under the government's dynamic daily pricing policy. Prices
remain constant for 24 hours. A single cron at 6:15 AM IST produces ~250 KB JSON for the
day. This is a perfect fit for the GitHub Actions daily cron pattern.

Criterion 3 is a clean **pass** — government-mandated daily schedule.

## Scope sketch

A clean, 5-endpoint v1:
- `GET /v1/fuel/today` — Today's prices for all cities
- `GET /v1/fuel/today/{city_slug}` — Today's petrol/diesel prices for a specific city
- `GET /v1/fuel/states` — List states with average prices
- `GET /v1/fuel/states/{state_code}` — All cities within a state with today's prices
- `GET /v1/fuel/history/{city_slug}?from=2024-01&to=2024-08` — Historical daily prices

Data volume: ~1,500 records/day (750 cities × 2 fuels), ~250 KB/day, ~100 MB/year. Fits
the Supabase + daily ingestion pattern from mandi-api.

Criterion 4 is a clean **pass**.

## Scorecard

| # | Criterion | Result |
|---|---|---|
| 1 | Data source exists & is legally redistributable | **unconfirmed** — Raw prices are factual/non-copyrightable per Indian law, but OMC website Terms of Service explicitly prohibit database creation; secondary aggregator ingestion path lacks confirmed redistribution rights |
| 2 | Not already well-served | **pass** — Every past open-source API is dead; commercial alternatives charge ₹399+ with mandatory API keys |
| 3 | Sane update cadence | **pass** — Government-mandated daily at 6:00 AM IST |
| 4 | Buildable v1 scope | **pass** — ~1,500 records/day, ~250 KB, clean daily cron pattern |
| 5 | Awesome-list submission fit | **unconfirmed** — Depends on resolving criterion 1; the public-facing API itself would be keyless, but if the upstream ingestion path is legally uncertain, submission fitness is uncertain |

## Verdict: caution

Criterion 1 is unconfirmed (not failed — the legal argument that raw factual prices are
non-copyrightable is strong, but the OMC ToS explicitly prohibit scraping, and no clean
GODL/open-license ingestion path exists). High demand, clear market gap, perfect technical
fit — but the licensing question needs resolution before this can be a confident `go`.

---

## Update 2026-10-22: PPAC is the source, verdict now go (scoped to the four metros)

Researched by: api-idea-scout (discovery follow-up). The 2026-09-25 caution rested on oil-marketing-company terms (IOCL, BPCL, HPCL) that bar database building. The Petroleum Planning and Analysis Cell (PPAC, Ministry of Petroleum and Natural Gas) publishes the same daily retail prices for the four metro cities as an official government table, with its own reuse terms. That source was not weighed in the first pass.

The dedupe gate was unavailable (exit 1); a manual read of `IDEA-LOG.md` shows this is the same problem as this row, so the row is updated in place.

### Source and proof (research step 6, all **verified** 2026-10-22)

- File: `https://ppac.gov.in/download.php?file=importantnews/1792653592_PP_9_a_DailyPriceMSHSD_Metro_22.10.2026.pdf` (listed on the PPAC home page; the page "RSP of Petrol and Diesel in Metro Cities since 16.6.2017"). 35 pages, created 22 Oct 2026, "Table Posted: 22-Oct-26", **text layer present**.
- Layout: petrol table (Delhi, Mumbai, Chennai, Kolkata, Rs per litre) on the left, diesel table on the right, one row per date.
- Parsed with `pdftotext -layout`: 3,371 petrol dates (2017-06-28 to 2026-10-22) and 3,378 diesel dates (2017-06-16 to 2026-10-22), 932 petrol revision days.
- Latest row, 22-Oct-26: petrol Delhi 102.12, Mumbai 111.21, Chennai 107.77, Kolkata 113.51; diesel 95.20, 97.83, 99.55, 99.82 (Rs per litre).
- Latest change: petrol Delhi moved 98.64 → 99.51 (22 May 2026) → 102.12 (24 May 2026).
- **Parser hazard found (and fixable):** at each page break the date label of one row is printed at the top of the next page while its four values sit, unlabelled, at the bottom of the previous page (for example 8-Oct-17). A naive parse leaves 33 gaps and 33 conflicting dates. A page-aware parser that pairs an unlabelled values row with the next date-only line closes them, and a continuity check (no missing day, four values per fuel per day) proves it. The source also shifts the diesel date column by one row against petrol, so the two tables must be parsed independently.

### License (criterion 1)

`https://ppac.gov.in/terms-conditions` (**verified**):
> "Material featured on this website may be reproduced free of charge. However, the material has to be reproduced accurately and not to be used in a derogatory manner or in a misleading context. Wherever the material is being published or issued to others, the source must be prominently acknowledged. However, the permission to reproduce this material shall not extend to any material which is ..." (third-party material excluded)

Criterion 1: **pass** (attribution to PPAC required; carry the posted date on every response).

### Duplication (criterion 2)

public-apis README (2026-10-22): fuel entries are US, Germany, UAE, Pakistan and global (OpenVan, Pumperly, Tankerkoenig); none for India. Open PR #6941 is "Pakistan Fuel Prices". GitHub: six tiny scrapers of goodreturns-style pages, all with 0 stars and no hosted API. Criterion 2: **pass.**

### Cadence (criterion 3)

The PDF is regenerated daily (file name carries the date; "Table Posted: 22-Oct-26"). Prices change on few days now (three revisions in May 2026), but the file is always current. Daily cron. **Pass.**

### Scope (criterion 4) and fit (criterion 5)

Four metros, two fuels, one row per day: `/v1/prices/latest`, `/v1/prices?city=&fuel=&from=&to=`, `/v1/prices/changes`, `/v1/cities`, `/v1/meta`. About 3,400 days × 4 cities × 2 fuels. Smaller than calendar-api. Keyless, CORS, HTTPS all achievable. **Pass** on both. Not covered: other cities and states (that was the old 750-city scope, which needs OMC pages and is dropped).

### Scorecard (update)

| # | Criterion | Result |
|---|---|---|
| 1 | Source and redistribution | pass |
| 2 | Not already well-served | pass |
| 3 | Sane update cadence | pass (daily file) |
| 4 | Buildable v1 scope | pass (four metros, 3,371 verified days) |
| 5 | Awesome-list fit | pass |

### Verdict: go (scoped to PPAC's four-metro series)

## Correction 2026-10-24 (found while building, `api-projects/projects/india-petroleum-api`)

The 2026-10-22 counts above came from `pdftotext -layout`, which misreads this file. Reading the same PDF with `pdftotext -raw` (content-stream order) gives, on all 35 pages, one line per day `DATE p p p p DATE d d d d` with equal dates, and **3,416 days for each fuel, 2017-06-16 to 2026-10-22, no missing day**; the PDF of 2026-10-23 gives 3,417. The "3,371 petrol dates", "3,378 diesel dates", "33 page-break gaps", "diesel shifted one row" and "28 June 2017 petrol start" lines are layout artefacts and are wrong. The 22/24 May 2026 revision dates were one day early: the file says 23 and 25 May 2026 (Delhi petrol 98.64 → 99.51 → 102.12). Check used: raw text first shows Delhi petrol 96.21 on 22-Mar-22 and 96.72 on 22-May-22, as reported at the time; layout text shows each a day early. Details and sources: the project's `docs/DATA-NOTES.md`. The verdict stays go; scope and scorecard are unchanged except that criterion 4 now rests on 3,417 verified days.
