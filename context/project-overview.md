# Low-Dopamine Weather & Outdoor Walk Readiness Display

## Overview

A distraction-free, low-cognitive-load, single-page web app designed specifically for managing ADHD and High Blood Pressure (HBP). It answers one high-priority question — *"Is it safe and comfortable for me to go for a walk right now?"* — with an immediate **GO / CAUTION / NO-GO** recommendation.

The app runs entirely in the browser as a static site: plain HTML, CSS, and JavaScript, with no backend, no build step, and no framework. It fetches live data straight from the keyless, CORS-enabled Open-Meteo API, computes cardiovascular-strain metrics (Dew Point and Heat Index) locally in the browser, and renders a high-contrast, dark-only "E-Ink style" card using native HTML/CSS and an inline SVG sparkline. It is hosted for free on Netlify and works identically in a desktop browser and on an Android phone.

## Goals

1. Reduce decision fatigue for users with ADHD by providing an immediate, clear walk recommendation (**GO**, **CAUTION**, or **NO-GO**).
2. Protect cardiovascular health by prioritizing **Dew Point** and **Heat Index** over simple relative humidity and raw air temperature.
3. Eliminate clutter, ads, and notifications with a single, always-dark, high-contrast card that requires zero taps or menu navigation to read.
4. Keep the stack zero-friction and zero-cost: keyless public API, no backend, no database, no accounts, free static hosting, and a single codebase for desktop and phone.

## Core User Flow

1. **First run (once).** The user opens the page and types a city name. The app geocodes it via Open-Meteo, stores the resulting latitude/longitude and city label in browser `localStorage`, and never asks again unless the city is changed in settings.
2. **Data fetch (on every load).** The page calls Open-Meteo directly from the browser for current temperature, relative humidity, dew point, a 12-hour hourly forecast, and Air Quality Index (AQI). No API key, no server in between.
3. **Health evaluation.** Local JavaScript computes Dew Point and Heat Index from the returned values and evaluates them against fixed blood-pressure safety thresholds to produce **GO**, **CAUTION**, or **NO-GO**.
4. **Render.** The card is drawn natively as HTML/CSS with an inline SVG sparkline. It is always dark ("night mode"); there is no light mode.
5. **Glance & refresh.** The user reads the answer at a glance. A manual Refresh button re-fetches on demand, and the page also re-fetches on load.

## Features

### Minimalist Visual Dashboard (dark-only)

- Always-dark, high-contrast, low-dopamine typography. No light mode.
- Immediate decision banner: **"WALK RECOMMENDED"**, **"HIGH HUMIDITY: STAY SHADED"**, or **"STAY INSIDE: CARDIAC STRESS RISK"**.
- Health-first metrics grid: prominent display of Dew Point, Heat Index, AQI, and temperature.

### Visual Sparkline Trend

- Minimal 12-hour forecast line chart rendered as inline SVG with no complex axes or clutter.
- Highlight band showing the daily time window with the lowest relative humidity ("Golden Hour").

### Health Threshold Rules Engine

The final recommendation is the **worst of three independently-scored signals**: Heat Index, Air Quality (AQI), and Dew Point. GO requires all three to be safe; CAUTION fires when any signal is elevated; NO-GO fires only when a signal reaches a genuinely dangerous level.

| Signal | GO | CAUTION | NO-GO |
|---|---|---|---|
| Heat Index | < 27°C (80°F) | 27–39°C (80–102°F) | ≥ 39°C (103°F) |
| AQI (US) | ≤ 50 | 51–150 | ≥ 151 |
| Dew Point | < 13°C | 13–21°C | > 21°C |

- **GO** — all three signals are in their GO band.
- **CAUTION** — any signal is in its CAUTION band and none is in NO-GO.
- **NO-GO** — any single signal reaches its NO-GO band.

Heat Index is computed from temperature and relative humidity (Rothfusz equation) and is the primary cardiovascular-stress signal. Dew Point is a humidity/comfort signal; AQI is a respiratory/cardiac air-quality signal. A borderline reading (e.g., AQI 101) now produces CAUTION rather than an automatic NO-GO.

### Location Settings

- City entered once, geocoded via Open-Meteo, stored in `localStorage`.
- Simple settings affordance to change the city.

## Scope

### In Scope

- Static single-page app: HTML, CSS, and vanilla JavaScript. No backend, no build step, no framework.
- Direct browser calls to Open-Meteo (current conditions, 12-hour hourly forecast, air quality, geocoding). No API key.
- Local computation of Dew Point, Heat Index, and the GO/CAUTION/NO-GO rules engine.
- Native HTML/CSS card + inline SVG sparkline with the lowest-humidity window highlighted.
- Dark-only (night mode) visual design. No light mode.
- City saved in `localStorage`; changeable.
- Fetch on page load + manual Refresh button.
- Free static hosting on Netlify; works in desktop and Android browsers.

### Out of Scope

- Backend server, database, or server-side rendering.
- Accounts, authentication, or any multi-user feature.
- History/logging of past conditions (the app is stateless beyond the saved location).
- `Pillow`/`matplotlib` image generation and E-Paper/PNG export.
- Multiple saved locations or profiles.
- 7-day extended forecasts, radar maps, or precipitation tracking.
- Push notifications, SMS alerts, or email.
- Light mode.

## Success Criteria

1. The static site fetches live Open-Meteo data from the browser with no API-key or CORS errors.
2. Dew Point and Heat Index are computed correctly, and the GO/CAUTION/NO-GO decision matches the fixed thresholds.
3. The card renders as native HTML/CSS with an inline SVG sparkline, in dark mode only, with large, easy-to-read text and a clear recommendation.
4. A city entered once is geocoded and persists in `localStorage` across reloads.
5. The site deploys to Netlify and presents a readable walk recommendation within 2 seconds on both a desktop browser and an Android phone, with zero clicks beyond the one-time city entry.