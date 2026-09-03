# Unit 02: API Client

## Goal

Create `api.js` — the only code that talks to Open-Meteo. It exposes
`geocode(city)`, `fetchForecast(lat, lon)`, and `fetchAirQuality(lat, lon)`
as an `api` object, returns plain parsed/validated objects, and throws two
typed errors (`LocationNotFound`, `ApiError`) on failure. Tests are written
first with Node's built-in runner.

## Design

Plain ordered script, consistent with Units 00–01: `api.js` at the project
root, loaded after `config.js` and before `app.js`. No ES modules in
production code.

- All `fetch` calls live in `api.js` (invariant 4). Endpoint URLs come from
  `config.js` constants; query construction is centralized here.
- `api.js` returns plain data objects — no DOM, no rendering, no thresholds.
- Responses are validated: malformed payloads throw `ApiError` rather than
  leaking raw garbage to the rest of the app.

## Error contract

| Condition | Thrown |
|---|---|
| Blank/missing city input | `LocationNotFound` |
| Geocode succeeds but has no usable result | `LocationNotFound` |
| Network failure (`fetch` rejects) | `ApiError` |
| Non-2xx HTTP status | `ApiError` |
| Response body is not valid JSON | `ApiError` |
| Response body is malformed (not an object, missing `current`/`hourly`) | `ApiError` |
| Open-Meteo inline error payload (`{ "error": true, "reason": ... }`) | `ApiError` |
| Non-finite latitude/longitude | `ApiError` |

`LocationNotFound` and `ApiError` both extend `Error` and set their `name`.
`ApiError` carries `cause` when a lower-level error was caught, so the reason
is never swallowed.

## Functions

- `geocode(city)` → `{ name, latitude, longitude }` (the `walk.location`
  shape). Trims the input; throws `LocationNotFound` when the input is empty
  or Open-Meteo returns no result. Prefers the API's canonical `name` but
  falls back to the typed city.
- `fetchForecast(latitude, longitude)` → parsed forecast object. Requests
  `current` + `hourly` temperature/relative humidity/dew point with
  `forecast_hours=12`, `timezone=auto`.
- `fetchAirQuality(latitude, longitude)` → parsed air-quality object.
  Requests `current` + `hourly` `us_aqi` with `forecast_hours=12`.

## Files

- `api.js` — new; the `api` object, `LocationNotFound`, `ApiError`, and the
  private `fetchJSON`/URL helpers.
- `index.html` — add `<script src="api.js"></script>` after `config.js`.
- `tests/api.test.mjs` — new; network-free tests using `node:test` + `vm`
  with an injected fake `fetch`.

## Testing approach

Production files stay plain browser scripts (Unit 00 decision), so the test
file loads `config.js` + `api.js` together in a Node `vm` context with a
mocked `fetch`, then exercises the public functions and error classes. No
network in tests — they are deterministic and run offline.

## Verify when done

- [ ] `node --test tests/api.test.mjs` passes (green).
- [ ] `geocode`, `fetchForecast`, `fetchAirQuality` succeed against the live
      Open-Meteo API with no key (verified in Node and in a browser).
- [ ] Blank city and no-result geocode throw `LocationNotFound`.
- [ ] Network failure and non-2xx status throw `ApiError`.
- [ ] No `fetch` exists outside `api.js`.
