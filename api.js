"use strict";

/**
 * Networking layer — the only code that talks to Open-Meteo.
 *
 * Exposes a single `api` object with `geocode`, `fetchForecast`, and
 * `fetchAirQuality`, plus two typed errors (`LocationNotFound`, `ApiError`).
 * Every function returns plain parsed data; every failure throws a typed
 * error so callers can map it to a UI state without inspecting strings.
 *
 * Endpoint URLs and request parameters come from `config.js`; the field
 * selections below are query-construction detail owned by this module.
 */

/** The requested city does not exist in Open-Meteo's geocoder. */
class LocationNotFound extends Error {
  constructor(message) {
    super(message);
    this.name = "LocationNotFound";
  }
}

/** A request failed at the transport or payload level. */
class ApiError extends Error {
  constructor(message, { cause } = {}) {
    super(message);
    this.name = "ApiError";
    if (cause !== undefined) {
      this.cause = cause;
    }
  }
}

/* Open-Meteo field selections used when building forecast/AQI queries. */
const FORECAST_FIELDS = "temperature_2m,relative_humidity_2m,dew_point_2m";
const AIR_QUALITY_FIELD = "us_aqi";

/**
 * GET a URL and return its parsed JSON body.
 *
 * @param {string} url
 * @returns {Promise<object>}
 * @throws {ApiError} on network failure, non-2xx status, invalid JSON, or a
 *   malformed/inline-error payload.
 */
async function fetchJSON(url) {
  let response;
  try {
    response = await fetch(url);
  } catch (err) {
    throw new ApiError(`Network error while requesting ${url}`, { cause: err });
  }

  if (!response.ok) {
    throw new ApiError(`Request to ${url} failed with status ${response.status}`);
  }

  let data;
  try {
    data = await response.json();
  } catch (err) {
    throw new ApiError(`Response from ${url} was not valid JSON`, { cause: err });
  }

  assertPayload(data, url);
  return data;
}

/**
 * Reject payloads that are not objects, or that carry Open-Meteo's inline
 * error shape (`{ "error": true, "reason": "..." }`, returned with HTTP 200).
 *
 * @param {unknown} data
 * @param {string} url
 * @throws {ApiError}
 */
function assertPayload(data, url) {
  if (data === null || typeof data !== "object") {
    throw new ApiError(`Unexpected response from ${url}: not a JSON object`);
  }
  if (data.error === true) {
    const reason = typeof data.reason === "string" ? data.reason : "unknown reason";
    throw new ApiError(`Open-Meteo error: ${reason}`);
  }
}

/**
 * Require a section (e.g. `current`, `hourly`) to be present as a plain
 * object on the parsed payload.
 *
 * @param {object} data
 * @param {string} section
 * @param {string} label
 * @throws {ApiError}
 */
function requireSection(data, section, label) {
  const value = data[section];
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new ApiError(`${label} response is missing "${section}"`);
  }
}

/**
 * Reject non-finite coordinates before ever hitting the network.
 *
 * @param {number} latitude
 * @param {number} longitude
 * @throws {ApiError}
 */
function requireCoordinates(latitude, longitude) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new ApiError("Latitude and longitude must be finite numbers");
  }
}

/**
 * Coerce a single Open-Meteo current value to a finite number, or null when
 * it is absent or non-numeric. This keeps the shape returned by
 * `fetchCurrentConditions` clean: every field is a number or null.
 *
 * @param {unknown} value
 * @returns {number | null}
 */
function currentValue(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** @param {string} cityName @returns {string} */
function geocodingUrl(cityName) {
  return (
    `${GEOCODING_URL}?name=${encodeURIComponent(cityName)}` +
    `&count=${GEOCODING_RESULT_COUNT}` +
    `&language=${GEOCODING_LANGUAGE}`
  );
}

/** @param {number} latitude @param {number} longitude @returns {string} */
function forecastUrl(latitude, longitude) {
  return (
    `${FORECAST_URL}?latitude=${latitude}&longitude=${longitude}` +
    `&current=${FORECAST_FIELDS}` +
    `&hourly=${FORECAST_FIELDS}` +
    `&forecast_hours=${FORECAST_HOURS}` +
    `&timezone=${TIMEZONE}`
  );
}

/** @param {number} latitude @param {number} longitude @returns {string} */
function airQualityUrl(latitude, longitude) {
  return (
    `${AIR_QUALITY_URL}?latitude=${latitude}&longitude=${longitude}` +
    `&current=${AIR_QUALITY_FIELD}` +
    `&hourly=${AIR_QUALITY_FIELD}` +
    `&forecast_hours=${FORECAST_HOURS}`
  );
}

const api = {
  /**
   * Geocode a city name to its first Open-Meteo result.
   *
   * @param {string} city
   * @returns {Promise<{ name: string, latitude: number, longitude: number }>}
   * @throws {LocationNotFound} when the city is blank or has no usable result.
   */
  async geocode(city) {
    const cityName = String(city ?? "").trim();
    if (cityName === "") {
      throw new LocationNotFound("City name is empty");
    }

    const data = await fetchJSON(geocodingUrl(cityName));
    const result = Array.isArray(data.results) ? data.results[0] : undefined;

    if (
      result === null ||
      typeof result !== "object" ||
      !Number.isFinite(result.latitude) ||
      !Number.isFinite(result.longitude)
    ) {
      throw new LocationNotFound(`No location found for "${cityName}"`);
    }

    const canonicalName =
      typeof result.name === "string" && result.name.trim() !== ""
        ? result.name
        : cityName;

    return {
      name: canonicalName,
      latitude: result.latitude,
      longitude: result.longitude,
    };
  },

  /**
   * Fetch current + 12-hour hourly forecast.
   *
   * @param {number} latitude
   * @param {number} longitude
   * @returns {Promise<object>}
   * @throws {ApiError}
   */
  async fetchForecast(latitude, longitude) {
    requireCoordinates(latitude, longitude);
    const data = await fetchJSON(forecastUrl(latitude, longitude));
    requireSection(data, "current", "Forecast");
    requireSection(data, "hourly", "Forecast");
    return data;
  },

  /**
   * Fetch current + 12-hour hourly US AQI.
   *
   * @param {number} latitude
   * @param {number} longitude
   * @returns {Promise<object>}
   * @throws {ApiError}
   */
  async fetchAirQuality(latitude, longitude) {
    requireCoordinates(latitude, longitude);
    const data = await fetchJSON(airQualityUrl(latitude, longitude));
    requireSection(data, "current", "Air quality");
    requireSection(data, "hourly", "Air quality");
    return data;
  },

  /**
   * Fetch the current conditions from the forecast and air-quality endpoints
   * in parallel, and normalize them into a plain object shaped for
   * `calc.deriveSignals`. A missing current value becomes `null`.
   *
   * @param {number} latitude
   * @param {number} longitude
   * @returns {Promise<{
   *   temperature: number | null,
   *   relativeHumidity: number | null,
   *   dewPoint: number | null,
   *   aqi: number | null,
   * }>}
   * @throws {ApiError}
   */
  async fetchCurrentConditions(latitude, longitude) {
    const [forecast, airQuality] = await Promise.all([
      api.fetchForecast(latitude, longitude),
      api.fetchAirQuality(latitude, longitude),
    ]);
    return {
      temperature: currentValue(forecast.current.temperature_2m),
      relativeHumidity: currentValue(forecast.current.relative_humidity_2m),
      dewPoint: currentValue(forecast.current.dew_point_2m),
      aqi: currentValue(airQuality.current.us_aqi),
    };
  },
};
