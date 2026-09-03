# Progress Tracker

Update this file after every meaningful implementation
change.

## Current Phase

- Build in progress — Unit 02 (API Client) complete.

## Current Goal

- Implement `context/spec/00-build-plan.md` in order; Unit 03 next.

## Completed

- Planning conversation concluded: product redirected from a Python desktop
  script to a static, dark-only web app.
- `project-overview.md` rewritten (static site, Open-Meteo direct, SVG card,
  dark-only, stateless, sane thresholds).
- `architecture.md` rewritten (stack, boundaries, storage, endpoints,
  invariants).
- `ui-context.md` rewritten (dark-only e-ink theme, tokens, layout).
- `code-standards.md` rewritten (vanilla JS/CSS/DOM/testing conventions).
- `ai-workflow-rules.md` and `AGENTS.md` updated for the static JS app.
- `context/spec/00-build-plan.md` rewritten (11-unit static build plan).
- `context/spec/00-project-scaffold.md` rewritten (Unit 00 spec).
- Unit 00 — Project Scaffold: `index.html`, `styles.css`, `app.js` created.
  Dark-only card shell + setup/card state toggle via `localStorage`; verified
  in a browser with no console errors.
- Unit 01 — Config & Storage: `config.js` (all thresholds + endpoint URLs as
  `UPPER_SNAKE_CASE` constants) and `storage.js` (`storage` object with
  save/load/clear for `walk.location`, malformed → null). `index.html` loads
  `config.js` + `storage.js` before `app.js`; `app.js` now reads the location
  via `storage.loadLocation()`. Spec: `context/spec/01-config-storage.md`.
- Unit 02 — API Client: `api.js` (global `api` object with `geocode`,
  `fetchForecast`, `fetchAirQuality`; `LocationNotFound` + `ApiError` typed
  errors; payload validation) added at project root and loaded after
  `config.js`. TDD: `tests/api.test.mjs` (20 tests, `node:test` + `vm` with a
  mocked `fetch`) written first, then implementation. Verified: tests green,
  live Open-Meteo calls succeed with no key in Node and in a browser with
  zero console errors. Spec: `context/spec/02-api-client.md`.

## In Progress

- None.

## Next Up

- Unit 03 — Domain Logic.

## Open Questions

- Netlify deploy mechanics (git-connected vs. drag-and-drop) — decide in the
  deploy unit.
- Whether to add the optional `tests/` folder with Node's built-in runner for
  the rules engine — decide in Unit 03.

## Architecture Decisions

- Static single-page app: plain HTML + CSS + vanilla JS. No backend, no build
  step, no framework, no runtime dependencies.
- Browser calls Open-Meteo directly (keyless, CORS); no server in between.
- Rendering is native HTML/CSS + inline SVG (no canvas, no Pillow/matplotlib).
- Dark-only theme ("night mode"); no light mode.
- Stateless: only the saved city lives in `localStorage` (`walk.location`).
- Location: city typed once, geocoded via Open-Meteo, stored locally.
- Decision model: worst of three signals (Heat Index, AQI, Dew Point) with
  per-signal GO/CAUTION/NO-GO bands (see `project-overview.md`).
- Hosting: Netlify (free static). Auth: none.
- Script organization: plain ordered `<script>` files (no ES modules, no
  build step), sharing a global scope; decided in Unit 00.

## Session Notes

- Planning session (2026-09-03): moved the product from a Python
  (`Pillow`/`matplotlib`/`schedule`) desktop generator to a static web app
  after walking through the core flow, rendering approach, hosting, location,
  storage, and scope. Netlify chosen because Open-Meteo is browser-callable,
  making a Python backend unnecessary. All six context files + the two spec
  files were rewritten to match. Build has not started.

- Unit 00 complete: `index.html`, `styles.css`, `app.js` created at the
  project root. `index.html` holds the two states (setup form + card shell
  with banner, 2×2 metrics grid, sparkline slot, controls row); `styles.css`
  carries the `:root` tokens from `ui-context.md` plus reset and layout
  (every hex value is in `:root`); `app.js` has a single `init()` that reads
  `walk.location` and toggles the two states, with a no-op submit handler on
  the city form (wired in Unit 04). Verified in a browser: dark card renders,
  setup state shows with no saved city, zero console errors.
- Unit 01 complete: `config.js` (thresholds + endpoint URLs as
  `UPPER_SNAKE_CASE` constants) and `storage.js` (a global `storage` object
  with `saveLocation`/`loadLocation`/`clearLocation`) added at the project
  root and loaded before `app.js`. `app.js` now calls `storage.loadLocation()`
  so malformed saved values read as "no location" and the setup state shows.
  Verified round-trip and malformed-value handling in the browser console.
- Unit 02 complete: `api.js` written TDD-first against `tests/api.test.mjs`
  (Node's built-in runner). Production files stay plain ordered scripts
  (Unit 00 decision), so tests load `config.js` + `api.js` together in a
  `vm` context with a mocked `fetch` and expose the public bindings via a
  trailing `this.__exports = { ... }` snippet. Two cross-realm pitfalls fixed
  in tests (not in `api.js`): (1) `deepStrictEqual` fails on objects created
  inside the vm realm (different `Object.prototype`) — assert fields instead;
  (2) `instanceof Error` fails across realms — compare against the realm's
  own `Error`. Live smoke: all three calls succeed against Open-Meteo with no
  key, in Node and in the browser (zero console errors).
