# Data notes

## Access ladder for daily metro prices (checked 22/10/2026)

| Tier | What was probed | Result |
|---|---|---|
| 0 official API / open data | data.gov.in search (web search limited to data.gov.in) for "daily retail selling price petrol diesel metro cities" | Only Delhi-only, yearly-average, monthly-average and fortnightly-average resources found (for example "Year-wise Details of Retail Sales Price (RSP) of Petrol and Diesel at Delhi from 01-04-2005 to 01-08-2023"). No daily four-metro series seen. A direct search on the portal itself, in a normal browser, is still pending (owner step). |
| 1-3 CMS API, feeds, server-rendered HTML | PPAC home page, `/prices` page and the metro page: searched for `.xls`, `.xlsx`, `.csv`, `.json` and API links | None. The only data file is the daily PDF. `robots.txt` on ppac.gov.in returns an HTML page, not a robots file. |
| OMC sites (IOCL, BPCL, HPCL) | Terms of the sites | Bar building a database from their pages; not a source. |
| 5 PDF | PPAC `PP_9_a_DailyPriceMSHSD_Metro_<DD.MM.YYYY>.pdf`, text layer present, 35 pages | Used. |

Verdict: PDF is the only current machine-readable source found; tiers 0-4 probed, none usable. Tier 0 stays open until the owner searches data.gov.in directly in a browser.

## Terms

PPAC (https://ppac.gov.in/terms-conditions): "Material featured on this website may be reproduced free of charge. However, the material has to be reproduced accurately and not to be used in a derogatory manner or in a misleading context. Wherever the material is being published or issued to others, the source must be prominently acknowledged." Third-party material is excluded.

Carry PPAC attribution and the posted date on every response.

## Reading the PDF text (24/10/2026)

Source file: `PP_9_a_DailyPriceMSHSD_Metro_22.10.2026.pdf`, sha256 `731ba932719765888c04e6504495aed5da59e5390ae85ccda0b0281fc8a7a7cb`, 35 pages, "Table Posted: 22-Oct-26". Local tool: Xpdf `pdftotext` 4.00 (not poppler). Runner tool: poppler-utils from apt; its version is recorded by the parse check workflow once it runs.

Use `pdftotext -raw`. Every day is one run of tokens `DATE p p p p DATE d d d d` (Delhi, Mumbai, Chennai, Kolkata, petrol then diesel; the two dates are equal on every row). The parser (`ingest/parse-metro.js`) reads tokens, so line breaks, page breaks and the repeated header block on each page do not matter.

Result on that file: 3,416 rows for each fuel, 16-Jun-17 to 22-Oct-26, no missing day, no duplicate day (`node ingest/check-continuity.js work/raw.txt` prints `petrol 3416 ok, diesel 3416 ok`). Both fuels start on 16-Jun-17, the first day of daily pricing.

Do not use `-layout`: it puts each diesel date one row below its values and drifts a day at page breaks. Check used to choose between the modes: three dated events in raw text (Delhi petrol 103.97 first on 4-Nov-21, 96.21 first on 22-Mar-22, 96.72 first on 22-May-22 with 105.41 the day before) match the dates under which those price changes were reported; layout text shows each one day early. The earlier "3,371 petrol dates, diesel 5 days short" counts came from the layout reading and were wrong.

Footnotes printed on the last page, reproduced as published: "*RSP of Petrol/Diesel is for IOC", "** Daily price change is applicable in India since 16.6.2017", "***Daily Price change is applicable from 6.00 AM". The `date` field of the API is PPAC's "Date of Revision" as published. It is not a pump-date guarantee: the footnote says a daily change applies from 6:00 AM.
