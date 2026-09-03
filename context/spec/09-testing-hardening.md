# Unit 09: Testing & Hardening

## Goal

Close the last automated-coverage gap and harden the app's failure paths —
without bloating the suite. Every signal band boundary is asserted, the app
provably degrades when AQI or the API dew point is absent, offline loads end
in the error state with a working Retry, and malformed `localStorage` reads
as "no location". Redundant tests left over from earlier units are pruned.

## Design

- **Boundary coverage** (already present from Unit 03 — verify, don't
  rewrite). `tests/calc.test.mjs` asserts every band edge:
  - AQI: 50/51/150/151 via `classifyAqi` + `decide`.
  - Heat index: 26.9/27/38.9/39 via `classifyHeatIndex` + `decide`.
  - Dew point: 12.9/13/21/21.1 via `classifyDewPoint` + `decide`.
- **Missing AQI**: `calc.deriveSignals` normalizes an absent AQI to `null`
  with an `aqiSignal` of `null`; `decide` skips null signals instead of
  treating them as safe (tested in `tests/calc.test.mjs`).
- **Missing dew point**: `calc.deriveSignals` prefers the API value and falls
  back to the Magnus formula when it is absent (tested in
  `tests/calc.test.mjs`). Missing values render as an em dash
  (`tests/render.test.mjs`).
- **Offline load**: a failed `fetchCurrentConditions` shows the error state
  with Retry and never calls `render.card` (tested in
  `tests/refresh-errors.test.mjs`); a real browser pass confirms it.
- **Malformed `localStorage`**: `storage.loadLocation()` returns `null` for
  bad JSON or a wrong shape, so the app falls back to the setup state.
  `storage.js` previously had zero tests; `tests/storage.test.mjs` closes
  that gap.
- **Pruning** (remove duplicate coverage, keep one test per fact):
  - `tests/api.test.mjs` — drop "fetchCurrentConditions calls both
    endpoints": the "combines current values" test already proves both
    endpoints are hit (it needs both), and the per-endpoint URL tests assert
    the prefixes.
  - `tests/conditions.test.mjs` — drop "loadConditions shows the error state
    (no render) when the fetch fails": `tests/refresh-errors.test.mjs` owns
    the identical assertion, and `showErrorState` already covers the Refresh
    re-enable.
  - `tests/calc.test.mjs` — merge the two "all-null values" `deriveSignals`
    tests (empty input / null input) into one; drop "dewPointFallback
    computes a hot, humid dew point" because the `deriveSignals` fallback
    test asserts the same value (26.17 at 30°C/80%) for the same inputs.

## Files

- `tests/storage.test.mjs` — new; vm-based tests for the persistence layer.
- `tests/api.test.mjs` — remove one redundant test.
- `tests/conditions.test.mjs` — remove one duplicated test.
- `tests/calc.test.mjs` — merge two tests; remove one redundant reference.

## Testing approach

- `storage.js` is a plain browser script touching only the `localStorage`
  global. Load it in a `vm` context with an injected fake `localStorage`
  (in-memory `getItem`/`setItem`/`removeItem`) and expose
  `this.__exports = { storage }`. Assert loaded-location fields individually
  (the parsed object is vm-realm).
- Everything else reuses the established `vm` patterns from Units 02–08.
- Run the whole suite with explicit file arguments (`node --test tests/`
  fails on Node 26).

## Verify when done

- [ ] `node --test` across all ten test files passes (green).
- [ ] Every signal band boundary has a test asserting it.
- [ ] The app degrades gracefully when AQI or dew point is absent (em dash +
  decision from the remaining signals).
- [ ] An offline / failed fetch shows the error state with a working Retry.
- [ ] Malformed `localStorage` loads as "no location" (setup state).
- [ ] No browser console errors on a manual pass.
