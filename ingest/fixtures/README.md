# Fixtures

Cut from real PPAC output, nothing typed by hand. Source file: `PP_9_a_DailyPriceMSHSD_Metro_22.10.2026.pdf`,
3,285,581 bytes, sha256 `731ba932719765888c04e6504495aed5da59e5390ae85ccda0b0281fc8a7a7cb`, "Table Posted: 22-Oct-26"
(see `proof/download-log.jsonl`, run 39816126444). Text from `pdftotext -raw` (Xpdf 4.00, content-stream order),
CRLF turned into LF. Line numbers are 1-based lines of that raw text (3,700 lines).

| File | Raw lines | What it covers |
|---|---|---|
| `raw-first-lines.txt` | 1-8 | "Table Posted" line, column header line, first six day rows (22-Oct-26 back to 17-Oct-26) |
| `raw-page-break.txt` | 130-150 | Page 1 to page 2 boundary: five rows, the page-1 footer-style header lines, a form feed, the page-2 header block, two more rows |
| `raw-may-2026.txt` | 165-174 | Price revisions: Delhi petrol 98.64 -> 99.51 on 23-May-26 -> 102.12 on 25-May-26 |
| `raw-hikes-2022.txt` | 1802-1806 and 1742-1746 | Revisions that match dated news: 22-Mar-22 (80p hike), 21/22-May-22 (excise cut) |
| `raw-last-page.txt` | 3665-3672 and 3692-3700 | Page 35 header, the last five rows (20-Jun-17 to 16-Jun-17) and the four footnote lines |
| `home-snippet.html`, `metro-snippet.html` | n/a | Saved PPAC page snippets for link discovery |

Why `-raw`: `-layout` output of the same file puts each diesel date one row below its values and drifts a day
at page breaks; `-raw` rows read `DATE p p p p DATE d d d d` with equal dates and reproduce two dated news
events with their Delhi prices (22-Mar-22, 22-May-22; sources in `docs/DATA-NOTES.md`) (see Plan issue 5 in `DOCS/PLAN-india-petroleum-api.md`).

`raw-30-days-2022.txt`: raw line 1 ("Table Posted") plus raw lines 1788-1818, thirty day rows from 7-Apr-22 back to 9-Mar-22 with a page boundary (header block and form feed) in the middle and the March 2022 price rises inside it. Used by the builder tests.
