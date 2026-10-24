# MOBILE.md — India Petroleum API

Run: 2026-10-24 · profile: Vite 5 + React 18 (plain CSS), 7 routes, 4 viewports (xs 320, sm 390, md 768, land 844x390)
Browser: puppeteer-core 25.16.0 against C:\Program Files\Google\Chrome\Application\chrome.exe (headless)

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

## What was not checked
- Real devices: iOS Safari's input zoom and safe-area behaviour were not exercised; Chrome headless on emulated viewports only.
- A deployed origin: the run used the local app, so CDN headers and the Vercel rewrites were not part of it.
- Slow networks: the web fonts load from Google Fonts with `display=swap`; layout shift from the font swap was not measured (no images, so `media-cls` is n/a).
