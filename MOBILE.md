# MOBILE.md — India Petroleum API

Run: 2026-10-24 · profile: Vite 5 + React 18 (plain CSS), 7 routes, 4 viewports (xs 320, sm 390, md 768, land 844x390)
Browser: puppeteer-core 25.16.0 against C:\Program Files\Google\Chrome\Application\chrome.exe (headless)

## Re-run 2026-10-24, after the live-data frontend (second run of the day)

What changed: a data banner under the header on every page, a range switch (3 months, 1 year, All) and a city select on the home chart, and a two-column playground with a scrolling table and folded code samples. Two new media queries (`min-width: 64rem` for the playground columns, `max-height: 36rem` for short screens).

Scope: all 7 routes again, 4 viewports each (the banner is in the shared layout, so no route was left out): `/`, `/playground`, `/docs`, `/status`, `/guides`, `/guides/petrol-and-diesel-price-revisions-since-2017`, `/not-a-real-page`. Served by the project's own app at `http://127.0.0.1:3100` with the limiter off (`frontend/dist` from `npm run build`), puppeteer-core against the same Chrome. Run in two batches (five routes, then the other two) after the fix below; the probe writes one JSON file per route and viewport (28 files, 336 family cells).

Result after the fix: 119 pass, 14 warn, 203 n/a, 0 fail, 0 unstable. Blockers 0, majors 0, minors 0. Every warning is `text-legibility` in the 14 to 15.99 px band (same rule and same cause as the first run: tables 15 px, code and captions 14 px); 0 nodes fail. Counted at 390 px across the 7 routes: 60 warning nodes (55 in the first run): `/docs` 37, `/playground` 8, `/` 7, the guide article 5, `/guides`, `/status` and the 404 page 1 each. `overflow-x` passes on all 28 route and viewport pairs (deltaPx 0). `tap-targets` passes on 21 measured cells with 0 below the 24 px floor and 0 below 44 px, which covers the range buttons, the city select, the retry button and the table scroll region. `form-input-zoom` passes: 4 of 4 fields on `/playground` and the 1 field on `/` (the chart's city select) at 16 px with a label and `autocomplete`.

The states a visitor reaches only sometimes (stale banner, offline banner, a day newer than the build, a failed range) were driven in headless Chrome separately and are recorded in the plan Progress Log; this probe measured the normal state of each route.

### [MAJOR, fixed] fixed-bar-budget @ land (844 x 390), route `/playground`
Measured: `fixedHeightSumPx` 123 of 390 (31.5%, limit 25%), 3 offenders: the three `th` cells of the result table's header (41 px each).
Cause: the table header was `position: sticky` inside a 20rem scroll box. The probe counts a sticky element whose rect reaches the bottom edge of the viewport, and on a 390 px screen the table starts low enough for that. The header does not pin to the viewport (it sticks inside its own scroller), so the number overstates the chrome; but the cause behind it is real: a 320 px scroll box inside a 390 px screen traps touch scrolling.
Fix: `frontend/src/index.css`, `@media (max-height: 36rem)`: `.table-scroll--short` loses its `max-height` and its header goes back to `position: static`, so a short screen scrolls the page, not a box inside it.
Status: fixed (re-probed 2026-10-24 with `--only fixed-bar-budget`: land 123 px (31.5%) -> 0 px (0%); xs 0, sm 123 px (14.6%, pass), md 0).
Note for the probe: sticky cells inside an `overflow: auto` ancestor are counted as pinned chrome; excluding descendants of a scroller would make it measure what the family names.

## Run profile
- Stack: Vite 5, React 18, react-router-dom 6, plain CSS in `frontend/src/index.css`, no Tailwind. Prerendered `frontend/dist`.
- Serve URL: `http://127.0.0.1:3000`, the project's own Express app (`backend/src/app.js`) serving `frontend/dist` and `/v1`, started for this run with the rate limiter off (see "First run discarded").
- Breakpoints (from the CSS): `max-width: 36rem`, `max-width: 40rem`, `min-width: 40rem`, `min-width: 56rem`, `prefers-reduced-motion: reduce`.
- Routes (7): `/`, `/playground`, `/docs`, `/status`, `/guides`, `/guides/petrol-and-diesel-price-revisions-since-2017`, `/not-a-real-page` (the 404 page).
- Probe: `E:\dev-recipes\mobile-responsiveness\templates\probe.js`, results in `frontend/.mobile-check/` (git-ignored; see below).

## Derived checks
Included: overflow-x, viewport-meta, tap-targets, text-legibility, form-input-zoom, layout-collision, fixed-bar-budget, reduced-motion, dvh-safe-area, media-cls, touch-affordance, nav-drawer (every family was run; the probe itself returned n/a for the five below).
Not applicable, as the probe reports it:
- media-cls — n/a: the portal renders no `<img>` or `<video>` (the chart is inline SVG).
- touch-affordance — n/a: no `:hover` rule hides or reveals content.
- nav-drawer — n/a: there is no drawer; the four nav links wrap onto a second row on a phone.
- dvh-safe-area — n/a: no `100vh`/`h-screen` and no fixed or sticky edge bar (the page uses `min-height: 100dvh` on a normal-flow wrapper).
- reduced-motion — pass at sm; n/a elsewhere (the probe runs it once).

## Score
Blockers: 0   Majors: 0   Minors: 0   Warnings: 1 family (text-legibility)   Unstable: 0

| Family | xs 320 | sm 390 | md 768 | land | Worst measured value |
|---|---|---|---|---|---|
| overflow-x | pass | pass | pass | pass | deltaPx 0, 0 offenders on every route |
| viewport-meta | pass | n/a | n/a | n/a | viewport meta present (probed at xs) |
| tap-targets | pass | pass | pass | n/a | 0 floor failures, 0 below 44 px |
| text-legibility | warn | warn | n/a | n/a | 0 failing; 55 nodes between 14 and 15.99 px across the 7 routes (34 on `/docs`) |
| form-input-zoom | pass | pass | n/a | n/a | 4 of 4 fields at 16 px with `autocomplete` and a label |
| layout-collision | pass | pass | pass | pass | no occlusion, clipping or distortion |
| fixed-bar-budget | pass | pass | pass | pass | no fixed bar |
| dvh-safe-area | n/a | n/a | n/a | n/a | no viewport-unit heights, no fixed edge bars |
| media-cls | n/a | n/a | n/a | n/a | no images or video |
| touch-affordance | n/a | n/a | n/a | n/a | no hover-only content |
| nav-drawer | n/a | n/a | n/a | n/a | no drawer |
| reduced-motion | n/a | pass | n/a | n/a | transitions are off under `prefers-reduced-motion` |

The text-legibility warnings are the probe's 14 to 15.99 px band (tables at 15 px, code at 14 px, footer and captions at 14 px) with line-height at or above 1.4. They are not failures under the registry's pass rule (fail below 14 px or below 1.4 line-height).

## Findings

### [MAJOR, fixed] overflow-x @ xs (320), route `/`
Measured: `deltaPx` 12, `offenderCount` 18, viewport 320; the hero's text column and the price board reached `right` 332.
Offenders: `main#main > section:nth-of-type(1) > div:nth-of-type(1)` · its `h1` and `p` · the price board table.
Cause: the hero grid had one implicit `auto` column, so the board table's minimum content width (316 px: 24 px prices and 16 px cell padding) stretched the column past the viewport. The phone overrides for the board sat above the base `.board` rules in the stylesheet and lost to them.
Fix: `frontend/src/index.css` `.hero { grid-template-columns: minmax(0, 1fr) }`, and the `max-width: 40rem` overrides for `.board th/td` padding (8 px) and `.board__price` (1.25rem) moved below the base board rules.
Status: fixed (re-probed 2026-10-24: deltaPx 12 -> 0, offenders 18 -> 0, all four viewports).

### [MAJOR, fixed] text-legibility @ xs, sm — `/`, `/docs`, `/guides`, `/guides/*`, `/playground`
Measured (failing nodes before -> after): `/` 4 -> 0, `/docs` 18 -> 0, `/guides` 3 -> 0, `/guides/petrol-and-diesel-price-revisions-since-2017` 3 -> 0, `/playground` 5 -> 0, `/status` 0, 404 page 0.
Offenders: inline `code` (line-height ratio 1.2), `pre > code` and the code-block caption bar (13 px), `.board__since` (13 px), `.chart__readout` (line-height ratio 1.2), and long headings (28 px and 24 px at line-height 1.15 and 1.25).
Cause: `code { font: 400 0.9em ... }` reset line-height to `normal`; several small labels were 13 px; heading line-height was tight.
Fix (`frontend/src/index.css`): `code` now sets only `font-family` and `font-size`; `.code pre`, `.code__bar` and `.board__since` are 14 px; `.code__bar` and `.chart__readout` set line-height 1.4 and 1.5; `h1`, `h2`, `h3` use line-height 1.4 at 40rem and below.
Status: fixed (re-probed 2026-10-24: 0 failing nodes on every route, 55 warnings remain in the 14 to 15.99 px band).
Note: the probe applies the 1.4 line-height rule to every text node of 40 or more characters, headings included, while the registry text says "body copy". Headings were loosened on phones to satisfy it; the rule's scope is worth a look.

### [MAJOR, fixed] form-input-zoom @ xs, sm — `/playground`
Measured: 4 of 4 fields failing, all with `issues: ["missing autocomplete"]`; font size was already 16 px.
Offenders: the city and fuel `select` and the two date `input`s.
Fix: `frontend/src/pages/PlaygroundPage.jsx` `autoComplete="off"` on all four (none holds personal data).
Status: fixed (re-probed 2026-10-24: 4 failing -> 0).

### [warn, fixed] tap-targets @ xs, sm, md
Measured before: below 44 px on 1 to 4 targets per route (`/guides` md 4, `/playground` md 4 and sm 4, `/status` md 2 and sm 2, the rest 1); 0 below the 24 px floor.
Offenders: `Copy` and preset text buttons (32 px high), the `Docs` nav link (43 px wide), the `PPAC PDF` link on `/status` (72 x 20), the three guide titles on `/guides` (33 px high), the skip link (42 px high).
Fix (`frontend/src/index.css`): `.text-button` 44 x 44 minimum, `.code__bar` 44 px, `.site-nav a` 44 px minimum width, `.facts dd a` 44 px high, `.guide-list h2 a` vertical padding, `.skip-link` padding.
Status: fixed (re-probed 2026-10-24: warnings 0 on every route and viewport).

### First run discarded
The first probe ran against the app with its rate limiter on. The probe's page loads made more than 100 requests from one IP, so later pages answered `429` JSON and showed as a bare `<pre>`, which produced false `viewport-meta`, `dvh-safe-area` and `text-legibility` failures on `/status`, `/guides`, `/guides/*` and the 404 page. Those results were thrown away and the whole probe re-run with `rateLimit: false` (a test-only server in the session scratchpad; the shipped app is unchanged). On Vercel static pages never reach the function, so the limiter cannot affect them there.

## Fix ledger

| # | Family | File | Before | After | Re-probed |
|---|---|---|---|---|---|
| 1 | overflow-x | `frontend/src/index.css` (`.hero`, board phone overrides) | deltaPx 12, 18 offenders | 0, 0 | 2026-10-24 |
| 2 | text-legibility | `frontend/src/index.css` (`code`, `.code pre`, `.code__bar`, `.chart__readout`, `.board__since`, headings) | failing 4 / 18 / 3 / 3 / 5 | 0 on every route | 2026-10-24 |
| 3 | form-input-zoom | `frontend/src/pages/PlaygroundPage.jsx` | 4 of 4 failing | 0 failing | 2026-10-24 |
| 4 | tap-targets | `frontend/src/index.css` (buttons, nav, status link, guide titles, skip link) | 1 to 4 below 44 px per route | 0 | 2026-10-24 |
| 5 | fixed-bar-budget | `frontend/src/index.css` (`@media (max-height: 36rem)` on `.table-scroll--short`) | `/playground` land: 123 px, 31.5% of 390 px | 0 px, 0% (xs 0, sm 14.6%, md 0) | 2026-10-24 (second run) |

## What was not checked
- Real devices: iOS Safari's input zoom and safe-area behaviour were not exercised; Chrome headless on emulated viewports only.
- A deployed origin: the run used the local app, so CDN headers and the Vercel rewrites were not part of it.
- Slow networks: the web fonts load from Google Fonts with `display=swap`; layout shift from the font swap was not measured (no images, so `media-cls` is n/a).
