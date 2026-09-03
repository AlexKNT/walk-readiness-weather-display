"use strict";

/**
 * Central configuration for the Walk Readiness app.
 *
 * Every threshold and endpoint URL lives here as a named UPPER_SNAKE_CASE
 * constant so tuning never requires hunting through `calc.js` or `api.js`.
 * The decision bands below match `project-overview.md` exactly.
 */

/* ============================== */
/* Decision thresholds            */
/* ============================== */

/**
 * Heat Index (°C) — primary cardiovascular-stress signal.
 * GO:      < 27°C  (80°F)
 * CAUTION: 27–39°C (80–102°F)
 * NO-GO:   >= 39°C (103°F)
 */
const HEAT_INDEX_CAUTION_MIN_C = 27;
const HEAT_INDEX_NO_GO_MIN_C = 39;

/* Fahrenheit references used internally by the Rothfusz heat-index math. */
const HEAT_INDEX_CAUTION_MIN_F = 80;
const HEAT_INDEX_NO_GO_MIN_F = 103;

/**
 * Air Quality Index (US AQI) — respiratory/cardiac air-quality signal.
 * GO:      <= 50
 * CAUTION: 51–150
 * NO-GO:   >= 151
 */
const AQI_GO_MAX = 50;
const AQI_CAUTION_MIN = 51;
const AQI_CAUTION_MAX = 150;
const AQI_NO_GO_MIN = 151;

/**
 * Dew Point (°C) — humidity/comfort signal.
 * GO:      < 13°C
 * CAUTION: 13–21°C
 * NO-GO:   > 21°C
 */
const DEW_POINT_CAUTION_MIN_C = 13;
const DEW_POINT_CAUTION_MAX_C = 21;

/* ============================== */
/* Open-Meteo endpoints (api.js)  */
/* ============================== */

const GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const AIR_QUALITY_URL = "https://air-quality-api.open-meteo.com/v1/air-quality";

/* ============================== */
/* Request parameters             */
/* ============================== */

const FORECAST_HOURS = 12;
const TIMEZONE = "auto";
const GEOCODING_RESULT_COUNT = 1;
const GEOCODING_LANGUAGE = "en";
