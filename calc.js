"use strict";

/**
 * Domain logic — the single source of truth for business rules.
 *
 * Exposes a `calc` object with pure, DOM-free functions: the Magnus dew
 * point fallback, the NOAA Rothfusz heat index, per-signal band
 * classification, `deriveSignals` (turn raw current conditions into computed
 * values + signal statuses), and `decide` (worst of three signals →
 * GO / CAUTION / NO-GO).
 *
 * Every threshold comes from `config.js`; this file declares no magic
 * numbers. Every non-evaluable input normalizes to `null` (absence has a
 * type), and a `null` signal is skipped by `decide` rather than treated as
 * safe.
 */

/**
 * Normalize an input to a finite number, or null when it is absent,
 * non-numeric, or non-finite. Numbers pass through; numeric strings are
 * coerced so the domain layer tolerates lightly-typed callers.
 *
 * @param {unknown} value
 * @returns {number | null}
 */
function toFiniteNumber(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/** @param {number} fahrenheit @returns {number} */
function fahrenheitToCelsius(fahrenheit) {
  return ((fahrenheit - 32) * 5) / 9;
}

/**
 * NOAA Rothfusz heat-index regression. Inputs are in °F and % RH.
 *
 * @param {number} temperatureF
 * @param {number} relativeHumidity
 * @returns {number} heat index in °F
 */
function rothfusz(temperatureF, relativeHumidity) {
  const t = temperatureF;
  const rh = relativeHumidity;
  const t2 = t * t;
  const rh2 = rh * rh;
  return (
    -42.379 +
    2.04901523 * t +
    10.14333127 * rh -
    0.22475541 * t * rh -
    0.00683783 * t2 -
    0.05481717 * rh2 +
    0.00122874 * t2 * rh +
    0.00085282 * t * rh2 -
    0.00000199 * t2 * rh2
  );
}

const calc = {
  /**
   * Dew point fallback via the Magnus formula (a = 17.62, b = 243.12),
   * used when the API omits `dew_point_2m`.
   *
   * @param {number} temperatureC
   * @param {number} relativeHumidity (0–100 %)
   * @returns {number | null} dew point in °C, or null when unevaluable.
   */
  dewPointFallback(temperatureC, relativeHumidity) {
    const t = toFiniteNumber(temperatureC);
    const rh = toFiniteNumber(relativeHumidity);
    if (t === null || rh === null || rh <= 0) {
      return null;
    }

    const a = 17.62;
    const b = 243.12;
    const alpha = (a * t) / (b + t) + Math.log(rh / 100);
    const dewPoint = (b * alpha) / (a - alpha);

    return Number.isFinite(dewPoint) ? dewPoint : null;
  },

  /**
   * Heat index in °C, computed from temperature and relative humidity.
   *
   * The Rothfusz equation only applies at ≥ 80°F with ≥ 40% humidity;
   * below either cutoff the heat index equals the air temperature.
   *
   * @param {number} temperatureC
   * @param {number} relativeHumidity (0–100 %)
   * @returns {number | null} heat index in °C, or null when unevaluable.
   */
  heatIndex(temperatureC, relativeHumidity) {
    const t = toFiniteNumber(temperatureC);
    if (t === null) {
      return null;
    }

    const tF = (t * 9) / 5 + 32;
    if (tF < HEAT_INDEX_CAUTION_MIN_F) {
      return t;
    }

    const rh = toFiniteNumber(relativeHumidity);
    if (rh === null) {
      return null;
    }
    if (rh < 40) {
      return t;
    }

    return fahrenheitToCelsius(rothfusz(tF, rh));
  },

  /**
   * Map a heat index (°C) onto its band.
   *
   * @param {number} heatIndexC
   * @returns {"GO" | "CAUTION" | "NO-GO" | null}
   */
  classifyHeatIndex(heatIndexC) {
    const value = toFiniteNumber(heatIndexC);
    if (value === null) {
      return null;
    }
    if (value >= HEAT_INDEX_NO_GO_MIN_C) {
      return "NO-GO";
    }
    if (value >= HEAT_INDEX_CAUTION_MIN_C) {
      return "CAUTION";
    }
    return "GO";
  },

  /**
   * Map a US AQI onto its band.
   *
   * @param {number} aqi
   * @returns {"GO" | "CAUTION" | "NO-GO" | null}
   */
  classifyAqi(aqi) {
    const value = toFiniteNumber(aqi);
    if (value === null) {
      return null;
    }
    if (value >= AQI_NO_GO_MIN) {
      return "NO-GO";
    }
    if (value >= AQI_CAUTION_MIN) {
      return "CAUTION";
    }
    return "GO";
  },

  /**
   * Map a dew point (°C) onto its band.
   *
   * @param {number} dewPointC
   * @returns {"GO" | "CAUTION" | "NO-GO" | null}
   */
  classifyDewPoint(dewPointC) {
    const value = toFiniteNumber(dewPointC);
    if (value === null) {
      return null;
    }
    if (value > DEW_POINT_CAUTION_MAX_C) {
      return "NO-GO";
    }
    if (value >= DEW_POINT_CAUTION_MIN_C) {
      return "CAUTION";
    }
    return "GO";
  },

  /**
   * Turn raw current conditions into computed values plus per-signal
   * classification. Dew point prefers the API value and falls back to the
   * Magnus formula when it is absent.
   *
   * @param {{ temperature?: number, relativeHumidity?: number,
   *          dewPoint?: number, aqi?: number } | null} input
   * @returns {{
   *   temperature: number | null,
   *   relativeHumidity: number | null,
   *   dewPoint: number | null,
   *   heatIndex: number | null,
   *   aqi: number | null,
   *   heatIndexSignal: "GO" | "CAUTION" | "NO-GO" | null,
   *   dewPointSignal: "GO" | "CAUTION" | "NO-GO" | null,
   *   aqiSignal: "GO" | "CAUTION" | "NO-GO" | null,
   * }}
   */
  deriveSignals(input) {
    const source = input ?? {};
    const temperature = toFiniteNumber(source.temperature);
    const relativeHumidity = toFiniteNumber(source.relativeHumidity);
    const apiDewPoint = toFiniteNumber(source.dewPoint);
    const aqi = toFiniteNumber(source.aqi);

    const dewPoint =
      apiDewPoint !== null
        ? apiDewPoint
        : calc.dewPointFallback(temperature, relativeHumidity);
    const heatIndex = calc.heatIndex(temperature, relativeHumidity);

    return {
      temperature,
      relativeHumidity,
      dewPoint,
      heatIndex,
      aqi,
      heatIndexSignal: calc.classifyHeatIndex(heatIndex),
      dewPointSignal: calc.classifyDewPoint(dewPoint),
      aqiSignal: calc.classifyAqi(aqi),
    };
  },

  /**
   * Final recommendation: the worst of the three classified signals.
   *
   * @param {number | null} heatIndex  heat index in °C
   * @param {number | null} aqi        US AQI
   * @param {number | null} dewPoint   dew point in °C
   * @returns {"GO" | "CAUTION" | "NO-GO" | null} `null` only when no signal
   *   is evaluable.
   */
  decide(heatIndex, aqi, dewPoint) {
    const statuses = [
      calc.classifyHeatIndex(heatIndex),
      calc.classifyAqi(aqi),
      calc.classifyDewPoint(dewPoint),
    ].filter((status) => status !== null);

    if (statuses.length === 0) {
      return null;
    }
    if (statuses.includes("NO-GO")) {
      return "NO-GO";
    }
    if (statuses.includes("CAUTION")) {
      return "CAUTION";
    }
    return "GO";
  },
};
