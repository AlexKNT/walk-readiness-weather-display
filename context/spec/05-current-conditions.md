# Unit 05: Current Conditions & Decision

## Goal

Build the core read path. Given a saved location, fetch the current
conditions and Air Quality Index, compute the derived signals, decide
GO / CAUTION / NO-GO, and render the decision banner and the 2×2 metrics
grid (Dew Point, Heat Index, AQI, Temperature).

## Design

Plain ordered scripts (Unit 00 decision). This unit introduces the rendering
boundary named in `architecture.md`:

- `api.js` gains `fetchCurrentConditions(lat, lon)` — the only place that
  knows the Open-Meteo field names. It calls `fetchForecast` and
  `fetchAirQuality` in parallel and returns a normalized
  `{ temperature, relativeHumidity, dewPoint, aqi }` object where a missing
  current value is `null`.
- `render.js` (new) owns **how to draw**: it turns a computed state from
  `calc.js` into banner text/class and metric values. It re-implements no
  thresholds — it receives the decision and per-signal status and only maps
  them to presentation.
- `app.js` owns **orchestration only**: on load with a saved location it runs
  `fetchCurrentConditions → deriveSignals → decide → render.card`. It never
  reads Open-Meteo field names and never computes a threshold.

## Data flow

```
saved location
  → api.fetchCurrentConditions(lat, lon)      → { temperature, relativeHumidity, dewPoint, aqi }
  → calc.deriveSignals(current)               → signals + per-signal status
  → calc.decide(heatIndex, aqi, dewPoint)     → GO / CAUTION / NO-GO / null
  → render.card(signals, decision)            → banner + 2×2 metrics
```

## Banner mapping (presentation only, in `render.js`)

| Decision | Text | Class |
|---|---|---|
| GO | `WALK RECOMMENDED` | `banner--go` |
| CAUTION | `HIGH HUMIDITY: STAY SHADED` | `banner--caution` |
| NO-GO | `STAY INSIDE: CARDIAC STRESS RISK` | `banner--no-go` |
| null | `NO DATA` | (neutral) |

## Metrics mapping (presentation only, in `render.js`)

- Dew Point: `"11.8°C"` (one decimal + `°C`).
- Heat Index: `"21.3°C"` (one decimal + `°C`).
- AQI: `"42"` (rounded integer, no unit).
- Temperature: `"21.3°C"` (one decimal + `°C`).
- A missing value renders as an em dash (`—`).

The matching metric value is tinted with the status color: a metric whose own
signal equals the final decision gets `metric__value--go/--caution/--no-go`.
Temperature has no signal, so it is never tinted. Status color appears in
exactly two places — the banner and the matching metric value — per
`ui-context.md`.

## Error / empty handling (minimal — expanded in Unit 07)

- If the fetch throws, `app.js` catches and renders the neutral fallback:
  `render.card(calc.deriveSignals(null), null)` — a `NO DATA` banner and
  em-dash metrics. The page never blanks (invariant 8). Full loading/error/
  retry states arrive in Unit 07.

## Files

- `api.js` — add `fetchCurrentConditions` + a `currentValue` normalizer.
- `render.js` — new; global `render` object with `decision`, `metricValue`,
  `metrics`, and `card`.
- `app.js` — add `loadConditions(location)`; call it from `init()` when a
  location is saved. Export `loadConditions` on the `app` object.
- `index.html` — load `render.js` after `calc.js` and before `app.js`.
- `styles.css` — add banner and metric-value status classes using only
  `:root` tokens.
- `tests/api.test.mjs` — add `fetchCurrentConditions` tests.
- `tests/render.test.mjs` — new; vm-based tests for banner/metric rendering.
- `tests/conditions.test.mjs` — new; vm-based tests for the read-path
  orchestration.
- `tests/location.test.mjs` — update fakes: inject `calc`/`render` fakes and
  a `fetchCurrentConditions` stub on the fake `api`.

## Testing approach

- `api.js`: same `vm` + mocked `fetch` pattern as Unit 02.
- `render.js`: `vm` + fake `document` whose elements record `classList`
  changes; assert text and class toggling.
- `app.js` read path: `vm` with real `config.js` + `calc.js`, plus fakes for
  `document`, `storage`, `api`, `render`, and `LocationNotFound`. Assert the
  chain (`fetchCurrentConditions` → `deriveSignals` → `decide` → `render.card`)
  and the never-blank fallback.

## Verify when done

- [ ] `node --test tests/api.test.mjs tests/calc.test.mjs tests/location.test.mjs tests/render.test.mjs tests/conditions.test.mjs` passes (green).
- [ ] A live load shows the correct banner and four metric values.
- [ ] The banner text/color matches the decision from `calc.decide()`.
- [ ] No browser console errors on a manual pass.
