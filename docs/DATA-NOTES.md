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
