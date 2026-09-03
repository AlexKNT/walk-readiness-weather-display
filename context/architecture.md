# Architecture Context

## Stack

| Layer | Technology | Role |
|---|---|---|
| Page structure | HTML | Single page shell: card, metrics, settings |
| Styling | Plain CSS | Dark-only e-ink theme, layout, typography |
| Behavior | Vanilla JavaScript | Fetch, compute, render |
| Rendering | DOM + inline SVG | Card and 12-hour sparkline (no canvas, no images) |
| Data source | Open-Meteo API | Geocoding, forecast, air quality (keyless, CORS) |
| Persistence | browser `localStorage` | Saved city (label + lat/lon) only |
| Hosting | Netlify | Free static hosting, HTTPS |
| Testing | Browser + `python -m http.server` | Lightweight checks of calc/rules logic and page load |

No runtime dependencies: no framework, no build step, no backend, no npm
packages required in production. The app is a folder of static files.

## System Boundaries

```
walk-readiness-weather-display/
├── index.html        # Static shell: card markup + settings form
├── styles.css        # All visual tokens + dark-only theme
├── app.js            # Bootstrap + orchestration (load → fetch → compute → render)
├── js/
│   ├── api.js        # Open-Meteo calls: geocode, forecast, air quality
│   ├── calc.js       # Dew point, heat index, rules engine (single source of truth)
│   ├── render.js     # Builds DOM + SVG from computed state
│   ├── storage.js    # localStorage read/write for saved location
│   ├── i18n.js       # Bilingual UI copy (EN originals + RU translations)
│   └── config.js     # Threshold constants + endpoint URLs
├── netlify.toml      # Static deploy config (optional)
├── context/          # Project docs (this folder)
└── spec/             # Build plan + unit specs
```

The exact file layout (single `app.js` vs. a `js/` folder) is finalized in
the build plan; the responsibility split below is what matters.

- `api.js` owns **how to talk to Open-Meteo**: endpoint URLs, query
  construction, and parsing JSON into plain data.
- `calc.js` owns **what the data means**: dew point, heat index, signal
  bands, and the final GO/CAUTION/NO-GO. This is the single source of truth
  for business rules.
- `render.js` owns **how to draw**: turning computed state into DOM nodes
  and SVG. It re-implements no thresholds.
- `storage.js` owns **what is persisted**: the saved location in
  `localStorage`. Nothing else.
- `i18n.js` owns **what the user reads**: every user-facing string as an
  English original + Russian translation, plus the bilingual composition
  helpers (`setText`, `setPlaceholder`, `aria`, `apply`). `render.js` and
  `app.js` ask it for copy instead of hardcoding strings.
- `app.js` owns **orchestration only**: read location → fetch → compute →
  render → wire refresh and settings events.

## Data Flow

```
[localStorage: city] → api.geocode?         (first run only)
                          ↓ lat/lon saved
[user opens page]
   → api.fetchForecast(lat, lon)            (current + 12h hourly)
   → api.fetchAirQuality(lat, lon)          (current + hourly US AQI)
   → calc.deriveSignals(...)                (dew point, heat index, AQI)
   → calc.decide(signals)                   (GO / CAUTION / NO-GO)
   → render.card(...) + render.sparkline(...)
```

Every page load re-runs this pipeline fresh. Nothing is cached between
visits except the saved city.

## Storage Model

### `localStorage` (per device, per browser)

The only persistent state is the saved location. Key:

| Key | Shape | Notes |
|---|---|---|
| `walk.location` | `{ "name": "Portland", "latitude": 45.5, "longitude": -122.6 }` | JSON string; set once on first run, editable in settings |

### What is NOT stored

- **No weather data, no history, no logs.** The recommendation is always
  recomputed from a fresh fetch at load time.
- **No cache.** The browser may cache the static assets; the app itself
  stores no fetched data.
- **No accounts, no tokens, no preferences beyond the city.** Any future
  settings (units, threshold overrides) would join the same
  `localStorage` model.

## Auth & Access Model

**None.** The site is public and stateless; the only personal data is a
city name held in the visitor's own browser. There is no login, no
multi-user anything, and no sensitive data to protect. Netlify provides
HTTPS (required for browser geolocation if ever added).

## Refresh & Update Model

- **On load:** the page fetches and renders immediately.
- **On demand:** a manual Refresh button re-runs the fetch → compute →
  render pipeline.
- **No polling, no scheduling, no background jobs.** There is no server to
  run them on; the page is inert unless loaded.

## Open-Meteo Endpoints (owned by `api.js`)

- **Geocoding:** `GET https://geocoding-api.open-meteo.com/v1/search`
  — `name`, `count=1`, `language=en` → `latitude`, `longitude`, `name`.
- **Forecast:** `GET https://api.open-meteo.com/v1/forecast`
  — `current=temperature_2m,relative_humidity_2m,dew_point_2m`
  — `hourly=temperature_2m,relative_humidity_2m,dew_point_2m`
  — `forecast_hours=12`, `timezone=auto`.
- **Air quality:** `GET https://air-quality-api.open-meteo.com/v1/air-quality`
  — `current=us_aqi`, `hourly=us_aqi`, `forecast_hours=12`.

All three are keyless and CORS-enabled, so they are called directly from the
browser.

## Computation Rules (owned by `calc.js`)

- **Dew Point:** prefer the API's `dew_point_2m`; if missing, compute from
  temperature and relative humidity (Magnus formula).
- **Heat Index:** compute from temperature and relative humidity using the
  NOAA Rothfusz regression (converted to °F internally, displayed in °C).
- **Decision:** the worst of three signals (Heat Index, AQI, Dew Point),
  using the bands defined in `project-overview.md`. `render.js` must ask
  `calc.js` for status/color and never re-derive them.

## Invariants

1. **Business rules live only in `calc.js`.** Thresholds, signal bands, and
   the GO/CAUTION/NO-GO decision are defined and computed in exactly one
   place. `render.js` consumes results and re-implements nothing.
2. **Thresholds are named constants, not magic numbers.** Every numeric
   threshold lives in `config.js` (or a constants section of `calc.js`) so
   tuning them never requires hunting through rendering code.
3. **The recommendation is always derived, never stored.** Status is
   recomputed from a fresh fetch on every load; it can never drift from
   the live data.
4. **All network calls go through `api.js`.** No `fetch` appears anywhere
   else; endpoint URLs and query building are centralized.
5. **`localStorage` holds only the location.** No weather data, history, or
   derived results are ever persisted.
6. **Dark-only.** The app has one theme. No light mode, no theme toggle, no
   `prefers-color-scheme` switching.
7. **No backend, no build step, no runtime dependencies.** The app is a set
   of static files served as-is; adding a framework or npm dependency is a
   design change that must be justified.
8. **The page never blanks.** Missing location, failed fetch, or bad data
   must render a clear setup/error state with a path forward (set a city,
   retry), never a broken screen.
9. **All user-facing copy lives in `i18n.js`.** English originals and
   Russian translations are held there as keyed pairs; `render.js` and
   `app.js` never hardcode a visible string.