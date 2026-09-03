# Walk Readiness

A distraction-free, dark-only web app that answers one question:
**"Is it safe and comfortable to go for a walk right now?"** — with a
**GO / CAUTION / NO-GO** recommendation.

Built for ADHD and high-blood-pressure users: zero clutter, no accounts, one
card, one glance. It calls the keyless Open-Meteo API directly from the
browser, computes Dew Point and Heat Index locally, and renders a
high-contrast "E-Ink style" card with a 12-hour humidity sparkline.

## Why it exists

- **Decision fatigue** — one recommendation, not a wall of weather widgets.
- **Cardiac safety** — prioritizes Dew Point and Heat Index over raw
  humidity and temperature.
- **Zero friction** — no backend, no API key, no accounts, no build step.

## Stack

| Layer | Technology |
|---|---|
| Structure | HTML (single page) |
| Styling | CSS (dark-only tokens, no frameworks) |
| Behavior | Vanilla JavaScript (plain ordered `<script>` files) |
| Data | Open-Meteo — geocoding, forecast, air quality (keyless, CORS) |
| Storage | `localStorage` (saved city only) |
| Hosting | Netlify (free static) |
| Tests | Node built-in runner (`node --test`) |

No runtime dependencies. No `npm install`, no build step.

## How it works

```
localStorage: city
   │  (first run: geocode & save lat/lon)
   ▼
api.fetchCurrentConditions(lat, lon) → temperature, humidity, dew point, AQI, 12h humidity
   ▼
calc.deriveSignals(...)              → dew point, heat index, AQI + per-signal band
   ▼
calc.decide(...)                     → GO / CAUTION / NO-GO (worst of three)
   ▼
render.card(...) + render.sparkline(...) → banner, metrics grid, SVG sparkline
```

Every load re-runs this pipeline fresh. Nothing is cached between visits
except the saved city.

## Decision thresholds

| Signal | GO | CAUTION | NO-GO |
|---|---|---|---|
| Heat Index (°C) | < 27 | 27–39 | ≥ 39 |
| AQI (US) | ≤ 50 | 51–150 | ≥ 151 |
| Dew Point (°C) | < 13 | 13–21 | > 21 |

The final recommendation is the **worst** of the three signals: any NO-GO
wins; otherwise any CAUTION wins; otherwise GO.

## Project layout

```
.
├── index.html        # page shell (setup + card states)
├── styles.css        # dark-only tokens + layout
├── config.js         # thresholds + endpoint URLs (named constants)
├── storage.js        # localStorage: saved city only
├── api.js            # Open-Meteo calls + typed errors
├── calc.js           # rules engine (single source of truth)
├── i18n.js           # bilingual copy (EN + RU)
├── render.js         # DOM + SVG drawing (no thresholds)
├── app.js            # orchestration (states + read pipeline)
├── netlify.toml      # static deploy config
├── context/          # planning docs (incl. spec/)
└── tests/            # node --test suites
```

## Run locally

Any static server works. With Python:

```sh
python -m http.server
# open http://localhost:8000
```

On first load you'll be asked for a city; after that it's saved in your
browser's `localStorage` and the card renders on every visit.

## Test

Tests use Node's built-in runner — no install step. From the project root:

```sh
node --test tests/api.test.mjs tests/calc.test.mjs tests/conditions.test.mjs tests/i18n.test.mjs tests/location.test.mjs tests/refresh-errors.test.mjs tests/render.test.mjs tests/sparkline.test.mjs tests/storage.test.mjs tests/ui-polish.test.mjs
```

> `node --test tests/` (directory form) fails on Node 26, so pass the files
> explicitly.

## Deploy to Netlify

There is no build step — the site is a folder of static files, and
`netlify.toml` already sets `publish = "."`.

**Option A — Git (recommended).** Push this folder to a GitHub/GitLab repo,
then in Netlify choose **Add new site → Import an existing project** and
pick the repo. Netlify reads `netlify.toml` automatically — no build
command, no extra settings.

**Option B — Drag-and-drop.** In Netlify, go to **Sites → Add new site →
Deploy manually** and drag the project folder in. You get an instant
`.netlify.app` URL.

Either way the app is served over HTTPS with no API key and no server.
Before committing to Git, add the Python/editor leftovers to `.gitignore`
(`.venv/`, `.vscode/`, `__pycache__/`) so the deploy stays small.

### Any static host works

Because the app has no build step and no server, the same folder deploys to
GitHub Pages, Cloudflare Pages, or Vercel as-is. Netlify is the project's
default because `netlify.toml` is already in place.

## Architecture invariants (verified)

1. ✅ Business rules live only in `calc.js`.
2. ✅ Thresholds are named constants in `config.js` (no magic numbers).
3. ✅ The recommendation is always recomputed from fresh data, never stored.
4. ✅ All network calls go through `api.js`.
5. ✅ `localStorage` holds only the saved location.
6. ✅ Dark-only — no light mode, no theme toggle.
7. ✅ No backend, build step, or runtime dependencies.
8. ✅ The page never blanks (setup / loading / error / content states).
9. ✅ All user-facing copy lives in `i18n.js` (EN + RU).

## Success criteria

1. ✅ Browser fetches live Open-Meteo data with no API-key or CORS errors.
2. ✅ Dew point / heat index computed correctly; the decision matches the
   thresholds (boundary tests in `tests/calc.test.mjs`).
3. ✅ Native HTML/CSS card + inline SVG sparkline, dark-only, large type,
   clear recommendation.
4. ✅ A city entered once is geocoded and persists in `localStorage` across
   reloads.
5. ⚠️ Deploys to Netlify and reads within 2 s on desktop and Android — the
   one manual step; `netlify.toml` plus the instructions above make it a
   drop-in deploy.
