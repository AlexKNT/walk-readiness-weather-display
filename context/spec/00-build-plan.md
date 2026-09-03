# Build Plan — Low-Dopamine Weather & Outdoor Walk Readiness Display

Spec-driven build in 11 units. Each unit has a spec file in this folder
(`NN-name.md`), produced just-in-time before implementation. Units are
ordered so every unit builds only on things that already exist.

## How to Use This Plan

1. Work one unit at a time, in order.
2. Read the unit's spec file, mark it in progress in
   `context/progress-tracker.md`, implement, verify, mark complete.
3. Never start unit N until every unit before it is verified.
4. If a unit changes the architecture, scope, or standards, update the
   relevant `context/*.md` file before continuing.

## Spec File Naming Convention

`NN-name.md`, zero-padded, matching the unit number below.

## Unit Overview

| # | Spec file | Builds | Depends on |
|---|---|---|---|
| 00 | `00-project-scaffold.md` | Static skeleton: `index.html`, `styles.css`, `app.js`, dark shell | — |
| 01 | `01-config-storage.md` | `config.js` constants, `storage.js` localStorage location | 00 |
| 02 | `02-api-client.md` | `api.js`: geocode, forecast, air quality + typed errors | 00 |
| 03 | `03-domain-logic.md` | `calc.js`: dew point, heat index, signal bands, decision | 01 |
| 04 | `04-location-flow.md` | First-run city entry → geocode → save; skip on later loads | 01, 02 |
| 05 | `05-current-conditions.md` | Fetch current, compute, render banner + metrics grid | 02, 03, 04 |
| 06 | `06-sparkline.md` | 12-hour humidity SVG + lowest-humidity highlight | 02, 05 |
| 07 | `07-refresh-errors.md` | Manual refresh; loading/error/setup states; never-blank | 05 |
| 08 | `08-ui-polish.md` | Full dark-only e-ink tokens, responsive, focus states | 05, 06 |
| 09 | `09-testing-hardening.md` | Rules-engine tests, boundary values, offline fallbacks | 03, 06 |
| 10 | `10-deploy-docs.md` | `netlify.toml`, README, invariants audit, success criteria | 09 |

---

## Phase 0 — Foundation

### Unit 00 — Project Scaffold

**Builds:** a runnable static skeleton: `index.html` with the card shell
(banner, 2×2 metrics grid placeholder, sparkline slot, controls row),
`styles.css` with `:root` tokens + reset + dark background, and an `app.js`
`init()` that shows the setup state when no location is saved.

**Depends on:** nothing.

**Done when:**
- `python -m http.server` serves the page with no console errors.
- The dark background and token values from `ui-context.md` are applied.
- The setup state renders when no city is saved.

### Unit 01 — Config & Storage

**Builds:** `config.js` (all threshold constants and endpoint URLs as named
`UPPER_SNAKE_CASE` values) and `storage.js` (save/load/clear the
`walk.location` key as JSON). No API calls yet.

**Depends on:** 00.

**Done when:**
- Every threshold in `project-overview.md` exists as a named constant.
- Location round-trips through `localStorage`; malformed values are treated
  as "no location".

---

## Phase 1 — Data & Rules

### Unit 02 — API Client

**Builds:** `api.js` — `geocode(city)`, `fetchForecast(lat, lon)`, and
`fetchAirQuality(lat, lon)` returning plain parsed objects, plus
`LocationNotFound` and `ApiError` thrown on failure. Endpoints per
`architecture.md`.

**Depends on:** 00.

**Done when:**
- All three calls succeed in a browser against Open-Meteo with no API key.
- A missing city and a failed request throw the correct typed error.

### Unit 03 — Domain Logic

**Builds:** `calc.js` — `dewPointFallback()`, `heatIndex()`,
`deriveSignals()`, and `decide()` (worst of three signals → GO/CAUTION/NO-GO),
pure and DOM-free. Optional `tests/` with Node's built-in runner.

**Depends on:** 01.

**Done when:**
- Boundary values (AQI 50/51/150/151, heat index 26.9/27, dew point
  12.9/13/21/21.1) produce the correct decision.
- No threshold logic exists outside `calc.js` and `config.js`.

---

## Phase 2 — Read Path

### Unit 04 — Location Flow

**Builds:** first-run city entry. On load with no saved location, show the
city input; on submit, geocode, save `walk.location`, and proceed. On later
loads, skip the form. "Change city" clears and re-shows the form.

**Depends on:** 01, 02.

**Done when:**
- A typed city persists across reloads and the form is skipped thereafter.
- An un-geocodable city shows an inline error, not a blank screen.

### Unit 05 — Current Conditions & Decision

**Builds:** the core read path. Fetch current conditions + AQI, compute
signals, decide, and render the banner (GO/CAUTION/NO-GO) and the 2×2
metrics grid (Dew Point, Heat Index, AQI, Temperature).

**Depends on:** 02, 03, 04.

**Done when:**
- A live load shows the correct banner and four metric values.
- The banner text/color matches the decision from `calc.decide()`.

### Unit 06 — Sparkline

**Builds:** the 12-hour humidity sparkline as inline SVG from hourly data,
with a highlight band over the lowest-humidity window.

**Depends on:** 02, 05.

**Done when:**
- The SVG renders 12 hourly points with no console errors.
- The lowest-humidity window is visibly highlighted.

---

## Phase 3 — Hardening & Polish

### Unit 07 — Refresh & Error States

**Builds:** the manual Refresh button (re-runs the full pipeline) and the
three toggled states — loading, error (retry), setup (set city) — so the
page never blanks.

**Depends on:** 05.

**Done when:**
- Refresh re-fetches and re-renders without a page reload.
- A simulated fetch failure shows the error state with a working Retry.

### Unit 08 — UI Polish & Responsive

**Builds:** the final visual layer using only `ui-context.md` tokens:
typography scale, metric tiles, banner, sparkline, focus rings, and
mobile-first layout that reads instantly at phone and desktop widths.

**Depends on:** 05, 06.

**Done when:**
- No hardcoded hex values outside `:root`.
- No animation beyond the permitted NO-GO pulse (reduced-motion respected).
- The card is legible at 360px and 1280px.

### Unit 09 — Testing & Hardening

**Builds:** rules-engine tests (Node built-in runner) for every threshold
boundary, plus manual hardening: missing AQI, missing dew point fallback,
offline load, and malformed localStorage.

**Depends on:** 03, 06.

**Done when:**
- Every signal band boundary has a test asserting it.
- The app degrades gracefully when AQI or dew point is absent.
- No browser console errors on a manual pass.

### Unit 10 — Deploy & Docs

**Builds:** the portfolio finish — a root `README.md` (what it does, stack,
run, test, deploy to Netlify), a `netlify.toml` if needed, an invariants
audit against `architecture.md`, and a check of all five success criteria in
`project-overview.md`.

**Depends on:** 09.

**Done when:**
- `README.md` lets a stranger run, test, and deploy the app.
- All success criteria are demonstrably true.
- Context files accurately reflect the finished implementation.

---

## Dependency Graph (text)

```
00 → 01 → 03
00 → 02 → 04
02, 03, 04 → 05
02, 05 → 06
05 → 07
05, 06 → 08
03, 06 → 09
09 → 10
```

## Out of Scope (deferred — do not build in this plan)

- Backend/server, database, server-side rendering
- Accounts, authentication, multi-user
- History/logging of past conditions
- Pillow/matplotlib image generation, E-Paper/PNG export
- Multiple saved locations
- 7-day forecast, radar, precipitation
- Push notifications, SMS, email
- Light mode
