import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * Unit 02 — API client tests.
 *
 * `api.js` is a plain browser script (Unit 00 decision: no ES modules in
 * production code). To test it in Node we load `config.js` + `api.js`
 * together inside a `vm` context with an injected fake `fetch`, then expose
 * the public bindings. All tests are network-free and deterministic.
 */

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const configSource = readFileSync(join(projectRoot, "config.js"), "utf8");
const apiSource = readFileSync(join(projectRoot, "api.js"), "utf8");

/** Load config.js + api.js in a fresh vm realm with the given fetch. */
function loadApi(fetchImpl) {
  const sandbox = { fetch: fetchImpl };
  vm.createContext(sandbox);
  vm.runInContext(
    `${configSource}\n${apiSource}\n;this.__exports = { api, ApiError, LocationNotFound, Error };`,
    sandbox,
  );
  return sandbox.__exports;
}

/** Build a Response-like object from a JSON body. */
function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

/** A Response-like object whose `json()` rejects (malformed body). */
function brokenJsonResponse(status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => {
      throw new SyntaxError("Unexpected token < in JSON");
    },
  };
}

/** Wrap a responder and record every URL it is asked to fetch. */
function makeFetch(responder) {
  const calls = [];
  const fetchFn = (url) => {
    calls.push(String(url));
    return responder(url);
  };
  fetchFn.calls = calls;
  return fetchFn;
}

/* ------------------------------------------------------------------ */
/* geocode                                                            */
/* ------------------------------------------------------------------ */

test("geocode returns a normalized { name, latitude, longitude }", async () => {
  const { api } = loadApi(
    makeFetch(() =>
      jsonResponse({
        results: [
          { id: 1, name: "Riga", latitude: 56.9496, longitude: 24.1052, country: "Latvia" },
        ],
      }),
    ),
  );

  const location = await api.geocode("Riga");

  assert.equal(location.name, "Riga");
  assert.equal(location.latitude, 56.9496);
  assert.equal(location.longitude, 24.1052);
});

test("geocode trims the city and URL-encodes the name", async () => {
  const fetch = makeFetch(() =>
    jsonResponse({ results: [{ name: "New York", latitude: 40.7, longitude: -74.0 }] }),
  );
  const { api } = loadApi(fetch);

  const location = await api.geocode("  New York  ");

  assert.equal(location.name, "New York");
  assert.equal(fetch.calls.length, 1);

  const url = fetch.calls[0];
  assert.ok(url.startsWith("https://geocoding-api.open-meteo.com/v1/search?"));
  assert.ok(url.includes("name=New%20York"));
  assert.ok(url.includes("count=1"));
  assert.ok(url.includes("language=en"));
});

test("geocode throws LocationNotFound for a blank city", async () => {
  const { api, LocationNotFound } = loadApi(() => jsonResponse({}));

  await assert.rejects(api.geocode("   "), LocationNotFound);
  await assert.rejects(api.geocode(""), LocationNotFound);
  await assert.rejects(api.geocode(), LocationNotFound);
});

test("geocode throws LocationNotFound when the API has no results", async () => {
  const { api, LocationNotFound } = loadApi(() => jsonResponse({ results: [] }));

  await assert.rejects(api.geocode("Atlantis"), LocationNotFound);
});

test("geocode throws LocationNotFound for a malformed result", async () => {
  const { api, LocationNotFound } = loadApi(() =>
    jsonResponse({ results: [{ name: "Broken", latitude: null }] }),
  );

  await assert.rejects(api.geocode("Broken"), LocationNotFound);
});

test("geocode throws ApiError on a failed request, not LocationNotFound", async () => {
  const { api, ApiError } = loadApi(makeFetch(() => jsonResponse({}, 500)));

  await assert.rejects(api.geocode("Riga"), ApiError);
});

/* ------------------------------------------------------------------ */
/* fetchForecast                                                      */
/* ------------------------------------------------------------------ */

const forecastBody = {
  current: { temperature_2m: 21.3, relative_humidity_2m: 55, dew_point_2m: 11.8 },
  hourly: {
    time: ["2026-09-03T00:00"],
    temperature_2m: [21.3],
    relative_humidity_2m: [55],
    dew_point_2m: [11.8],
  },
};

test("fetchForecast returns the parsed object", async () => {
  const { api } = loadApi(() => jsonResponse(forecastBody));

  assert.deepEqual(await api.fetchForecast(56.9496, 24.1052), forecastBody);
});

test("fetchForecast builds the documented query string", async () => {
  const fetch = makeFetch(() => jsonResponse(forecastBody));
  const { api } = loadApi(fetch);

  await api.fetchForecast(56.9496, 24.1052);

  const url = fetch.calls[0];
  assert.ok(url.startsWith("https://api.open-meteo.com/v1/forecast?"));
  assert.ok(url.includes("latitude=56.9496"));
  assert.ok(url.includes("longitude=24.1052"));
  assert.ok(url.includes("current=temperature_2m,relative_humidity_2m,dew_point_2m"));
  assert.ok(url.includes("hourly=temperature_2m,relative_humidity_2m,dew_point_2m"));
  assert.ok(url.includes("forecast_hours=12"));
  assert.ok(url.includes("timezone=auto"));
});

test("fetchForecast throws ApiError on network failure and keeps the cause", async () => {
  const networkError = new TypeError("fetch failed");
  const { api, ApiError } = loadApi(
    makeFetch(() => {
      throw networkError;
    }),
  );

  await assert.rejects(api.fetchForecast(56.9, 24.1), (err) => {
    assert.ok(err instanceof ApiError);
    assert.equal(err.cause, networkError);
    return true;
  });
});

test("fetchForecast throws ApiError on a non-2xx status", async () => {
  const { api, ApiError } = loadApi(() => jsonResponse({}, 500));

  await assert.rejects(
    api.fetchForecast(56.9, 24.1),
    (err) => err instanceof ApiError && /500/.test(err.message),
  );
});

test("fetchForecast throws ApiError when the body is not valid JSON", async () => {
  const { api, ApiError } = loadApi(() => brokenJsonResponse());

  await assert.rejects(
    api.fetchForecast(56.9, 24.1),
    (err) => err instanceof ApiError && /not valid JSON/i.test(err.message),
  );
});

test("fetchForecast throws ApiError on a non-object body", async () => {
  const { api, ApiError } = loadApi(() => jsonResponse("garbage"));

  await assert.rejects(
    api.fetchForecast(56.9, 24.1),
    (err) => err instanceof ApiError && /not a JSON object/i.test(err.message),
  );
});

test("fetchForecast throws ApiError when current or hourly is missing", async () => {
  const { api, ApiError } = loadApi(() =>
    jsonResponse({ current: { temperature_2m: 21.3 } }),
  );

  await assert.rejects(api.fetchForecast(56.9, 24.1), ApiError);
});

test("fetchForecast surfaces Open-Meteo inline errors", async () => {
  const { api, ApiError } = loadApi(() =>
    jsonResponse({ error: true, reason: "Parameter 'latitude' is required" }),
  );

  await assert.rejects(
    api.fetchForecast(56.9, 24.1),
    (err) => err instanceof ApiError && /latitude/i.test(err.message),
  );
});

test("fetchForecast throws ApiError on non-finite coordinates without fetching", async () => {
  const fetch = makeFetch(() => jsonResponse(forecastBody));
  const { api, ApiError } = loadApi(fetch);

  await assert.rejects(api.fetchForecast("lat", 24.1), ApiError);
  await assert.rejects(api.fetchForecast(56.9, NaN), ApiError);
  await assert.rejects(api.fetchForecast(undefined, 24.1), ApiError);
  assert.equal(fetch.calls.length, 0);
});

/* ------------------------------------------------------------------ */
/* fetchAirQuality                                                    */
/* ------------------------------------------------------------------ */

const airQualityBody = {
  current: { us_aqi: 42 },
  hourly: { time: ["2026-09-03T00:00"], us_aqi: [40] },
};

test("fetchAirQuality returns the parsed object", async () => {
  const { api } = loadApi(() => jsonResponse(airQualityBody));

  assert.deepEqual(await api.fetchAirQuality(56.9496, 24.1052), airQualityBody);
});

test("fetchAirQuality builds the documented query string", async () => {
  const fetch = makeFetch(() => jsonResponse(airQualityBody));
  const { api } = loadApi(fetch);

  await api.fetchAirQuality(56.9496, 24.1052);

  const url = fetch.calls[0];
  assert.ok(url.startsWith("https://air-quality-api.open-meteo.com/v1/air-quality?"));
  assert.ok(url.includes("latitude=56.9496"));
  assert.ok(url.includes("longitude=24.1052"));
  assert.ok(url.includes("current=us_aqi"));
  assert.ok(url.includes("hourly=us_aqi"));
  assert.ok(url.includes("forecast_hours=12"));
});

test("fetchAirQuality throws ApiError on network failure", async () => {
  const { api, ApiError } = loadApi(
    makeFetch(() => {
      throw new TypeError("fetch failed");
    }),
  );

  await assert.rejects(api.fetchAirQuality(56.9, 24.1), ApiError);
});

test("fetchAirQuality throws ApiError on non-finite coordinates without fetching", async () => {
  const fetch = makeFetch(() => jsonResponse(airQualityBody));
  const { api, ApiError } = loadApi(fetch);

  await assert.rejects(api.fetchAirQuality(null, 24.1), ApiError);
  assert.equal(fetch.calls.length, 0);
});

/* ------------------------------------------------------------------ */
/* fetchCurrentConditions                                             */
/* ------------------------------------------------------------------ */

test("fetchCurrentConditions combines current values from both endpoints", async () => {
  const fetch = makeFetch((url) => {
    if (url.includes("air-quality")) return jsonResponse(airQualityBody);
    return jsonResponse(forecastBody);
  });
  const { api } = loadApi(fetch);

  const current = await api.fetchCurrentConditions(56.9496, 24.1052);

  assert.equal(current.temperature, 21.3);
  assert.equal(current.relativeHumidity, 55);
  assert.equal(current.dewPoint, 11.8);
  assert.equal(current.aqi, 42);
  assert.equal(fetch.calls.length, 2);
});

test("fetchCurrentConditions normalizes missing current fields to null", async () => {
  const fetch = makeFetch((url) => {
    if (url.includes("air-quality")) {
      return jsonResponse({ current: {}, hourly: {} });
    }
    return jsonResponse({ current: { temperature_2m: 21.3 }, hourly: {} });
  });
  const { api } = loadApi(fetch);

  const current = await api.fetchCurrentConditions(56.9, 24.1);

  assert.equal(current.temperature, 21.3);
  assert.equal(current.relativeHumidity, null);
  assert.equal(current.dewPoint, null);
  assert.equal(current.aqi, null);
  assert.equal(current.hourlyHumidity, null);
});

test("fetchCurrentConditions returns the hourly humidity series", async () => {
  const fetch = makeFetch((url) => {
    if (url.includes("air-quality")) return jsonResponse(airQualityBody);
    return jsonResponse({
      current: { temperature_2m: 21.3, relative_humidity_2m: 55, dew_point_2m: 11.8 },
      hourly: { relative_humidity_2m: [55, 54, 53, null, 60] },
    });
  });
  const { api } = loadApi(fetch);

  const current = await api.fetchCurrentConditions(56.9, 24.1);

  assert.equal(
    JSON.stringify(current.hourlyHumidity),
    JSON.stringify([55, 54, 53, null, 60]),
  );
});

test("fetchCurrentConditions returns null hourlyHumidity when hourly is missing", async () => {
  const fetch = makeFetch((url) => {
    if (url.includes("air-quality")) return jsonResponse(airQualityBody);
    return jsonResponse({ current: { temperature_2m: 21.3 }, hourly: {} });
  });
  const { api } = loadApi(fetch);

  const current = await api.fetchCurrentConditions(56.9, 24.1);

  assert.equal(current.hourlyHumidity, null);
});

test("fetchCurrentConditions throws ApiError when either endpoint fails", async () => {
  const { api, ApiError } = loadApi(() => jsonResponse({}, 500));

  await assert.rejects(api.fetchCurrentConditions(56.9, 24.1), ApiError);
});

/* ------------------------------------------------------------------ */
/* Error classes                                                      */
/* ------------------------------------------------------------------ */

test("LocationNotFound and ApiError are distinct Error subclasses", () => {
  const { ApiError, LocationNotFound, Error: RealmError } = loadApi(() =>
    jsonResponse({}),
  );

  // Compare against the realm's own Error, since the classes live inside the
  // vm context (exactly like the browser, where they all share one realm).
  assert.ok(new LocationNotFound("x") instanceof RealmError);
  assert.ok(new ApiError("x") instanceof RealmError);
  assert.ok(!(new LocationNotFound("x") instanceof ApiError));
  assert.ok(!(new ApiError("x") instanceof LocationNotFound));

  assert.equal(new LocationNotFound("x").name, "LocationNotFound");
  assert.equal(new ApiError("x").name, "ApiError");
});
