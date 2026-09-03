# Unit 01: Config & Storage

## Goal

Create the named configuration constants and the location persistence layer.
`config.js` holds every threshold and endpoint URL as an `UPPER_SNAKE_CASE`
constant; `storage.js` saves, loads, and clears the `walk.location` key as
JSON. No API calls yet.

## Design

Two root scripts, loaded before `app.js` as plain ordered `<script>` files
(no ES modules, no build step), sharing the global scope — the convention
decided in Unit 00.

- `config.js` is pure data: constants only, no functions, no DOM, no network.
  It is the single source of truth for threshold values and endpoint URLs.
- `storage.js` owns `localStorage` access. It exposes a single `storage`
  object with `saveLocation`, `loadLocation`, and `clearLocation`. Malformed
  or unreadable JSON is treated as "no location" (returns `null`).

## Thresholds (from `project-overview.md`)

| Signal | GO | CAUTION | NO-GO |
|---|---|---|---|
| Heat Index (°C) | < 27 | 27–39 | >= 39 |
| AQI (US) | <= 50 | 51–150 | >= 151 |
| Dew Point (°C) | < 13 | 13–21 | > 21 |

Named constants (all in `config.js`):

- `HEAT_INDEX_CAUTION_MIN_C = 27`
- `HEAT_INDEX_NO_GO_MIN_C = 39`
- `AQI_GO_MAX = 50`, `AQI_CAUTION_MIN = 51`, `AQI_CAUTION_MAX = 150`,
  `AQI_NO_GO_MIN = 151`
- `DEW_POINT_CAUTION_MIN_C = 13`, `DEW_POINT_CAUTION_MAX_C = 21`

Fahrenheit references used by the Rothfusz heat-index computation are also
stored as constants (`HEAT_INDEX_CAUTION_MIN_F`, `HEAT_INDEX_NO_GO_MIN_F`).

## Endpoints (from `architecture.md`)

- `GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search"`
- `FORECAST_URL = "https://api.open-meteo.com/v1/forecast"`
- `AIR_QUALITY_URL = "https://air-quality-api.open-meteo.com/v1/air-quality"`

Plus the request parameters they share: `FORECAST_HOURS = 12`,
`TIMEZONE = "auto"`, `GEOCODING_RESULT_COUNT = 1`,
`GEOCODING_LANGUAGE = "en"`.

## Storage model

| Key | Shape | Notes |
|---|---|---|
| `walk.location` | `{ "name": "Portland", "latitude": 45.5, "longitude": -122.6 }` | JSON string |

`loadLocation()` validates the parsed shape: `name` must be a non-empty
string, `latitude` and `longitude` must be finite numbers. Anything else —
missing key, bad JSON, wrong shape, or storage exceptions — returns `null`.

## Implementation

### Files

- `config.js` — new; constants only.
- `storage.js` — new; the `storage` object + `STORAGE_KEY`.
- `index.html` — add `<script src="config.js">` and
  `<script src="storage.js">` before `app.js`.
- `app.js` — replace the raw `localStorage.getItem("walk.location")` check
  with `storage.loadLocation()`.

## Dependencies

- Unit 00 (scaffold: `index.html`, `styles.css`, `app.js`).

## Verify when done

- [ ] Every threshold in `project-overview.md` exists as a named constant in
      `config.js`.
- [ ] Saving a location and loading it back returns the same `name`,
      `latitude`, and `longitude`.
- [ ] Malformed values (`"garbage"`, `"{}"`, wrong types) load as `null`.
- [ ] `clearLocation()` removes the key; the next load returns `null`.
- [ ] The page still renders with no console errors.
