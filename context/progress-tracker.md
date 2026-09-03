# Progress Tracker

Update this file after every meaningful implementation
change.

## Current Phase

- Build in progress — Unit 07 (Refresh & Error States) complete.

## Current Goal

- Implement `context/spec/00-build-plan.md` in order; Unit 08 next.

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
- Unit 03 — Domain Logic: `calc.js` (global `calc` object with
  `dewPointFallback` Magnus, `heatIndex` NOAA Rothfusz, `classifyHeatIndex`/
  `classifyAqi`/`classifyDewPoint`, `deriveSignals`, `decide` = worst of three
  signals) added at project root and loaded after `api.js`. Pure and DOM-free;
  all thresholds read from `config.js`; absence normalizes to `null` and null
  signals are skipped by `decide`. TDD: `tests/calc.test.mjs` (31 tests)
  written first. Verified: 51/51 tests green (`node --test`), every band
  boundary asserted (AQI 50/51/150/151, heat index 26.9/27/39, dew point
  12.9/13/21/21.1). Spec: `context/spec/03-domain-logic.md`.
- Unit 04 — Location Flow: `app.js` rewritten from the Unit 00 scaffold to
  orchestrate the first-run city entry — read `storage.loadLocation()` →
  toggle setup/card state; submit → `api.geocode` → `storage.saveLocation` →
  show card; inline `#setup-error` for empty/not-found/api failures; "Change
  city" clears storage and re-shows the setup form. `index.html` gained
  `#setup-submit`, `#setup-error`, and `#change-city-btn`; `styles.css`
  gained `.setup-error`, `.controls__actions`, `.btn--ghost`. TDD:
  `tests/location.test.mjs` (11 tests, vm + fake `document`/`storage`/`api`/
  `LocationNotFound`). Verified: 62/62 tests green (`node --test`). Spec:
  `context/spec/04-location-flow.md`.
- Unit 05 — Current Conditions & Decision: the core read path. `api.js`
  gained `fetchCurrentConditions(lat, lon)` (calls forecast + AQI in parallel,
  normalizes missing current values to `null`). New `render.js` (global
  `render` object: `decision`, `metricValue`, `metrics`, `card`) owns banner
  text/class + metric formatting + the "matching metric" tint; it re-derives
  no thresholds. `app.js` gained `loadConditions(location)` —
  fetchCurrentConditions → deriveSignals → decide → render.card — with a
  neutral never-blank fallback (`render.card(deriveSignals(null), null)`) on
  failure; `init()` runs it when a location is saved, and a successful city
  submit runs it immediately after geocoding. `index.html` loads
  `render.js` before `app.js`; `styles.css` gained `.banner--*` and
  `.metric__value--*` status accents (token-only). TDD:
  `tests/render.test.mjs` (11), `tests/conditions.test.mjs` (7), plus 4 new
  `fetchCurrentConditions` cases in `tests/api.test.mjs`; `location.test.mjs`
  fakes updated to inject `calc`/`render` + a `fetchCurrentConditions` stub.
  Verified: 83/83 tests green (`node --test`, 5 files). Spec:
  `context/spec/05-current-conditions.md`.
- Unit 06 — Sparkline: `api.fetchCurrentConditions` now also returns
  `hourlyHumidity` (the normalized `relative_humidity_2m` hourly series) via
  a new `hourlyValues` normalizer — no extra network call, since the hourly
  data already arrives with `fetchForecast`. `render.js` gained the
  sparkline drawing: `sparklineValue`/`sparklinePoints`/`lowestHumidityIndex`
  helpers plus `render.sparkline(humidity)` (inline SVG polyline + one point
  per hour + a highlight `<rect>` over the lowest-humidity hour) and
  `render.lowestHumidityIndex` (exposed for tests). Geometry lives in
  `config.js` as `SPARKLINE_*` constants (no magic numbers in `render.js`);
  the band/line/points use only `--border`/`--text-muted`/`--text` tokens (no
  status colors). `app.js` calls `render.sparkline(current.hourlyHumidity)`
  after `render.card` (and `render.sparkline(null)` in the fallback).
  `styles.css` styled `.sparkline__svg/__line/__point/__band`. TDD:
  `tests/sparkline.test.mjs` (11 tests) written first; `api.test.mjs` gained
  2 `hourlyHumidity` cases, `conditions.test.mjs` now asserts the
  sparkline pass-through, `location.test.mjs` fake `render` gained a
  `sparkline` no-op. Spec: `context/spec/06-sparkline.md`.
- Unit 07 — Refresh & Error States: `app.js` now owns three toggled card
  sub-states — `#loading-state` (fetch in flight, Refresh disabled),
  `#error-state` (friendly message + Retry), and `#card-content` (banner +
  metrics + sparkline) — with the controls row always visible. The manual
  Refresh button and the Retry button both call `refreshConditions()`, which
  re-runs the full read pipeline for the saved location (falling back to the
  setup state if none is saved). `loadConditions(location)` is now
  loading → fetch → compute → render → content, or loading → error; the
  Unit 05 "NO DATA" fallback is gone (the dedicated error state replaces
  it). `index.html` wraps the data display in `#card-content` and adds the
  loading/error sections; `styles.css` styles `.status-message` +
  `#loading-state`/`#error-state` from tokens only. TDD:
  `tests/refresh-errors.test.mjs` (8 tests) written first;
  `conditions.test.mjs` updated (new element ids, failure → error state);
  `location.test.mjs` fakes gain the new element ids. Verified: 103/103
  tests green; browser smoke test confirmed Refresh re-fetches without a
  reload, a simulated failure shows the error state, and Retry recovers —
  zero page errors. Spec: `context/spec/07-refresh-errors.md`.

## In Progress

- None.

## Next Up

- Unit 08 — UI Polish & Responsive.

## Open Questions

- Netlify deploy mechanics (git-connected vs. drag-and-drop) — decide in the
  deploy unit.

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
- Unit 03 complete: `calc.js` written TDD-first against `tests/calc.test.mjs`
  (Node's built-in runner, same `vm` pattern as Unit 02, but exposing `calc`
  with no injected `fetch`). The `tests/` folder question is now resolved:
  keep it, one file per unit (`tests/*.test.mjs`). `decide` is the pure
  `(heatIndex, aqi, dewPoint)` worst-of-three function from the standards;
  `deriveSignals` is the higher-level shape that turns raw current conditions
  into computed values + per-signal classification for the render layer
  (Unit 05). Cross-realm note for `deriveSignals`: assert fields individually,
  not `deepStrictEqual`. `index.html` now loads `calc.js` after `api.js`.
- Unit 04 complete: `app.js` now owns the location flow end to end. The
  submit handler geocodes via `api.geocode`, persists via
  `storage.saveLocation`, and toggles states; failures map to inline errors
  (`empty` / `not-found` / `api`) rendered with `textContent`. "Change city"
  clears storage and returns to setup. `app.js` auto-runs `init()` and also
  exposes an `app` object (`init`, `submitCity`, `handleSubmit`,
  `handleChangeCity`, `showSetupState`, `showCardState`). Testing follows the
  Unit 02/03 vm pattern but adds fakes for `document` (elements that record
  listeners), `storage`, `api`, and a realm-local `LocationNotFound`; tests
  trigger the captured `submit`/`click` listeners and assert element state.
  Note: `app.js` (unlike `config`/`api`/`calc`/`storage`) touches the DOM on
  load, so the vm test must always inject a fake `document` before the script
  runs.
- Unit 05 complete: introduced the `render.js` boundary named in
  `architecture.md` (the build plan's Unit 05 is the first unit that draws,
  so `render.js` lands here rather than as its own unit). `app.js` stays
  orchestration-only: it calls `api.fetchCurrentConditions`, `calc.deriveSignals`,
  `calc.decide`, then `render.card`. The read path fires whenever the card
  state becomes visible — from `init()` for a saved location, and from a
  successful city submit immediately after geocoding (so a first-run user
  sees the answer without a reload). The never-blank fallback for a failed
  fetch is deliberately minimal (`render.card(deriveSignals(null), null)` =
  "NO DATA" banner + em-dash metrics); Unit 07 replaces it with real
  loading/error/retry states. `location.test.mjs` needed its fake `api` to
  gain a `fetchCurrentConditions` stub and the vm sandbox to gain `calc` +
  `render` fakes, because the read path now runs for any saved location;
  the success-submit test dropped its exact `api.calls.length` assertion
  since geocoding is now followed by a conditions fetch.
- Unit 06 complete: `api.fetchCurrentConditions` now also returns
  `hourlyHumidity` (normalized `relative_humidity_2m` hourly series, missing
  entries → `null`, absent series → `null`) via a new `hourlyValues`
  normalizer — the hourly data already rides along on `fetchForecast`, so no
  extra request. `render.js` gained the sparkline: `sparklineValue` (Number()
  coercion), `sparklinePoints` (index-preserving x/y mapping over a fixed
  0–100% humidity domain), `lowestHumidityIndex` (first min index, -1 if
  none), `render.sparkline(humidity)` (polyline + one `<circle>` per finite
  point + a highlight `<rect>` over the lowest hour, assembled from numeric
  values only), and `render.lowestHumidityIndex` exposed for tests. Geometry
  constants (`SPARKLINE_*`) live in `config.js` per the "no magic numbers in
  render.js" rule; the band uses `--border`, line `--text-muted`, points
  `--text` (status colors remain reserved for the banner + matching metric).
  `app.js` calls `render.sparkline(current.hourlyHumidity)` after
  `render.card` and `render.sparkline(null)` in the fallback. Cross-realm
  note: `hourlyHumidity` is a vm-realm array, so tests compare it via
  `JSON.stringify`, not `deepEqual`.
- Unit 07 complete: replaced the Unit 05 "NO DATA" fallback with three
  toggled card sub-states. `index.html` now nests the banner/metrics/
  sparkline inside `#card-content`, adds `#loading-state` and `#error-state`
  (with `#retry-btn`), and keeps the controls row (city + Change city +
  Refresh) as a direct child so it never disappears. `app.js` gained
  `showLoadingState`/`showErrorState`/`showContentState` (each also toggles
  `#refresh-btn` disabled via `setRefreshing`) and a single
  `refreshConditions()` wired to both `#refresh-btn` and `#retry-btn`;
  `loadConditions` is now loading → fetch → compute → render → content, or
  loading → error. Testing follows the Unit 05 vm pattern but the fake
  `document` must now expose the five new ids (`loading-state`,
  `error-state`, `card-content`, `refresh-btn`, `retry-btn`) because `init()`
  always looks them up to attach listeners. `conditions.test.mjs`'s failure
  test now asserts `render.calls.length === 0` + `#error-state` visible
  (instead of the old fallback card); `location.test.mjs` only needed the
  extra element ids. New `tests/refresh-errors.test.mjs` covers state
  toggles, the synchronous loading→content transition, the failure path, the
  Refresh/Retry click wiring (asserting `api.calls` + `render.calls`
  increments), and `refreshConditions` falling back to setup with no saved
  location. Browser smoke: refresh survives a window marker (no reload),
  simulated failure shows `#error-state`, Retry recovers — zero `pageerror`.

