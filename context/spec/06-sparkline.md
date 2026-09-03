# Unit 06: Sparkline

## Goal

Render the 12-hour humidity sparkline as inline SVG from hourly forecast
data, with a subtle highlight band over the lowest-humidity window (the
"Golden Hour" from `project-overview.md`).

## Design

- `api.js` gains a `hourlyValues` normalizer and `fetchCurrentConditions`
  now also returns `hourlyHumidity` — the `relative_humidity_2m` hourly
  series normalized to an array of finite numbers with `null` for missing
  entries (or `null` when the series itself is absent). No new network call:
  the hourly series already arrives with `fetchForecast`.
- `render.js` gains the sparkline drawing:
  - `sparkline(humidity)` assembles an inline SVG (polyline + one point per
    hour + a highlight `<rect>`) from **numeric values only**, after parsing
    each value with `Number()`. It clears `#sparkline` when there is no data.
  - `lowestHumidityIndex(humidity)` is a pure helper (exposed for testing)
    that returns the first index of the lowest finite value, or `-1`.
- `app.js` calls `render.sparkline(current.hourlyHumidity)` right after
  `render.card` in the read path, and `render.sparkline(null)` in the
  never-blank fallback.
- Geometry lives in `config.js` as `SPARKLINE_*` constants (no magic numbers
  in `render.js`, per `code-standards.md`). The band uses only `--border`
  and the line/points use `--text-muted`/`--text` tokens — no status colors
  here (status color appears only in the banner and matching metric).

## Data flow

```
api.fetchCurrentConditions(lat, lon)
  → { ..., hourlyHumidity: Array<number | null> | null }
  → render.sparkline(hourlyHumidity)   (after render.card)
```

## Mapping (presentation only, in `render.js`)

- Humidity is plotted against a fixed 0–100% domain (honest, no fake
  zoom): higher humidity sits toward the top of the SVG.
- One point per finite hourly value; the polyline connects them in order.
- The highlight band spans the single hour slot centered on the
  lowest-humidity hour (ties resolve to the first).
- No data (`null`, `[]`, or all-`null`) → the `#sparkline` slot is emptied,
  leaving the dashed placeholder visible.

## Files

- `config.js` — add `SPARKLINE_*` geometry constants.
- `api.js` — add `hourlyValues`; extend `fetchCurrentConditions` return shape.
- `render.js` — add `sparklineValue`, `sparklinePoints`,
  `lowestHumidityIndex` helpers and `render.sparkline` /
  `render.lowestHumidityIndex`.
- `app.js` — call `render.sparkline(...)` in `loadConditions` (success and
  fallback).
- `styles.css` — style `.sparkline__svg`, `.sparkline__line`,
  `.sparkline__point`, `.sparkline__band` using `:root` tokens only.
- `tests/sparkline.test.mjs` — new; vm-based tests for the SVG assembly and
  the lowest-index helper.
- `tests/api.test.mjs` — add `hourlyHumidity` coverage.
- `tests/conditions.test.mjs` — fake `render` gains `sparkline`; assert the
  read path passes `hourlyHumidity` through.
- `tests/location.test.mjs` — fake `render` gains a `sparkline` no-op.

## Testing approach

- `render.sparkline`: `vm` + fake `document` exposing only `#sparkline`
  (records `innerHTML`); assert SVG contents, point count, and band position.
- `render.lowestHumidityIndex`: pure-function tests for min index, ties,
  missing values, and numeric-string coercion.
- `api.fetchCurrentConditions`: assert `hourlyHumidity` normalization via
  JSON comparison (arrays created in the vm realm).
- `app.js` read path: assert `render.sparkline` is called after
  `render.card` with the hourly series, and with `null` on failure.

## Verify when done

- [ ] `node --test tests/api.test.mjs tests/calc.test.mjs tests/location.test.mjs tests/render.test.mjs tests/conditions.test.mjs tests/sparkline.test.mjs` passes (green).
- [ ] A live load renders the sparkline with 12 points and no console errors.
- [ ] The lowest-humidity window is visibly highlighted.
