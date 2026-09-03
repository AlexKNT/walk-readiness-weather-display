# Unit 03: Domain Logic (calc.js)

## Goal

Create `calc.js` — the single source of truth for business rules. It
computes Dew Point (with a Magnus fallback), Heat Index (NOAA Rothfusz
regression), classifies each of the three health signals, and produces the
final GO / CAUTION / NO-GO decision as the **worst of the three signals**.
Everything is pure and DOM-free. Tests are written first with Node's
built-in runner.

## Design

Plain ordered script, consistent with Units 00–02: `calc.js` at the project
root, loaded after `config.js` (it reads the threshold constants) and before
`app.js`. No ES modules in production code.

- **All thresholds come from `config.js`.** `calc.js` declares no magic
  numbers: it imports `HEAT_INDEX_*`, `AQI_*`, and `DEW_POINT_*` constants
  from the shared script scope.
- **Pure functions only.** No DOM, no network, no `localStorage`, no global
  mutation. `calc.js` takes numbers in and returns values out.
- **Absence has a type.** Any non-evaluable input (missing, `NaN`, non-finite)
  normalizes to `null`. A null signal is *skipped* by `decide` rather than
  treated as safe.

## Signal bands (exactly `project-overview.md`)

| Signal | GO | CAUTION | NO-GO |
|---|---|---|---|
| Heat Index (°C) | `< 27` | `27 ≤ x < 39` | `≥ 39` |
| AQI (US) | `≤ 50` | `51–150` | `≥ 151` |
| Dew Point (°C) | `< 13` | `13–21` | `> 21` |

Boundary values that must produce the documented decision:

- Heat Index: `26.9 → GO`, `27 → CAUTION`, `38.9 → CAUTION`, `39 → NO-GO`
- AQI: `50 → GO`, `51 → CAUTION`, `150 → CAUTION`, `151 → NO-GO`
- Dew Point: `12.9 → GO`, `13 → CAUTION`, `21 → CAUTION`, `21.1 → NO-GO`

## Functions

- `dewPointFallback(temperatureC, relativeHumidity)` → `number | null`.
  Magnus formula (a = 17.62, b = 243.12). Returns `null` when the inputs are
  non-finite or the result is non-finite (e.g. RH = 0).
- `heatIndex(temperatureC, relativeHumidity)` → `number | null` (°C).
  Converts to °F internally, applies the NOAA Rothfusz regression, converts
  back to °C. Returns the air temperature (not `null`) when the equation does
  not apply: temperature below 80°F, or relative humidity below 40%. Returns
  `null` when temperature is non-finite, or when temperature ≥ 80°F and
  humidity is unavailable.
- `classifyHeatIndex(heatIndexC)`, `classifyAqi(aqi)`,
  `classifyDewPoint(dewPointC)` → `"GO" | "CAUTION" | "NO-GO" | null`.
  Map one value onto its band. Non-finite input → `null`.
- `deriveSignals(input)` → a plain object of computed values plus per-signal
  classification:

  ```
  {
    temperature, relativeHumidity,   // normalized numbers or null
    dewPoint, heatIndex, aqi,         // computed values or null
    heatIndexSignal,                  // "GO" | "CAUTION" | "NO-GO" | null
    dewPointSignal,                   // "GO" | "CAUTION" | "NO-GO" | null
    aqiSignal,                        // "GO" | "CAUTION" | "NO-GO" | null
  }
  ```

  `input` is `{ temperature, relativeHumidity, dewPoint, aqi }`. Dew Point
  prefers the API value (`dewPoint`); when it is missing it falls back to
  `dewPointFallback(temperature, relativeHumidity)`.
- `decide(heatIndex, aqi, dewPoint)` → `"GO" | "CAUTION" | "NO-GO" | null`.
  The worst of the three classified signals (`NO-GO > CAUTION > GO`). Null
  signals are ignored; `null` is returned only when all three are null.

## Files

- `calc.js` — new; the `calc` object exposing the functions above.
- `index.html` — add `<script src="calc.js"></script>` after `api.js`.
- `tests/calc.test.mjs` — new; network-free tests using `node:test` + `vm`.

## Testing approach

Same pattern as Unit 02: load `config.js` + `calc.js` together in a Node
`vm` context and expose `calc` via `this.__exports`. No network, no DOM —
the tests are deterministic and run offline. Floating-point results (Rothfusz,
Magnus) are asserted with tolerances; band boundaries are asserted exactly.

## Verify when done

- [ ] `node --test tests/calc.test.mjs` passes (green).
- [ ] Every signal band boundary (AQI 50/51/150/151, heat index 26.9/27/39,
      dew point 12.9/13/21/21.1) produces the correct decision.
- [ ] No threshold logic exists outside `calc.js` and `config.js`.
- [ ] `node --check calc.js` reports no syntax errors.
- [ ] The page still loads with no console errors (`calc.js` is inert until
      Unit 05 wires it into the render path).
