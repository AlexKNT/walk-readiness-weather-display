import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * Unit 04 — location flow (app.js) tests.
 *
 * `app.js` is a plain browser script that auto-runs `init()`, which touches
 * the DOM. We load it in a `vm` context with fakes for `document`, `storage`,
 * `api`, and `LocationNotFound`, then exercise the wiring through the
 * listeners captured by the fake elements. All tests are network-free and
 * deterministic.
 */

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const appSource = readFileSync(join(projectRoot, "app.js"), "utf8");

const ELEMENT_IDS = [
  "setup-state",
  "card-state",
  "setup-form",
  "city-input",
  "setup-submit",
  "setup-error",
  "city-label",
  "change-city-btn",
];

/** The same LocationNotFound class is injected into the vm, so the
 *  `instanceof` check inside app.js sees the exact constructor our fake api
 *  throws. */
class LocationNotFound extends Error {
  constructor(message) {
    super(message);
    this.name = "LocationNotFound";
  }
}

/** A fake element exposing the few properties app.js reads/writes. */
function makeElement(id) {
  return {
    id,
    hidden: true,
    textContent: "",
    value: "",
    disabled: false,
    listeners: {},
    addEventListener(type, handler) {
      this.listeners[type] = handler;
    },
  };
}

/** A fake document over exactly the ids app.js looks up. */
function makeDocument() {
  const elements = Object.fromEntries(
    ELEMENT_IDS.map((id) => [id, makeElement(id)]),
  );
  return {
    elements,
    getElementById(id) {
      if (!elements[id]) {
        throw new Error(`app.js looked up unknown element #${id}`);
      }
      return elements[id];
    },
  };
}

/** A fake storage that keeps the saved location in memory. */
function makeStorage(initialLocation = null) {
  let saved = initialLocation;
  const calls = { save: [], clear: 0 };
  return {
    calls,
    loadLocation() {
      return saved;
    },
    saveLocation(location) {
      saved = location;
      calls.save.push(location);
    },
    clearLocation() {
      saved = null;
      calls.clear += 1;
    },
  };
}

/** A fake api whose geocode records the city and resolves a location, plus a
 *  `fetchCurrentConditions` stub so `init()` can run the read path. */
function makeApi({ onGeocode } = {}) {
  const calls = [];
  return {
    calls,
    async geocode(city) {
      calls.push(city);
      if (onGeocode) {
        return onGeocode(city);
      }
      return { name: city, latitude: 56.9496, longitude: 24.1052 };
    },
    async fetchCurrentConditions() {
      calls.push("fetchCurrentConditions");
      return { temperature: 20, relativeHumidity: 50, dewPoint: 10, aqi: 42 };
    },
  };
}

/** A minimal fake calc — the location flow never needs real rules. */
function makeCalc() {
  return {
    deriveSignals: () => ({
      temperature: null,
      relativeHumidity: null,
      dewPoint: null,
      heatIndex: null,
      aqi: null,
      heatIndexSignal: null,
      dewPointSignal: null,
      aqiSignal: null,
    }),
    decide: () => null,
  };
}

/** A no-op render — the location flow tests don't assert on drawing. */
function makeRender() {
  return { card() {} };
}

/** Load app.js in a fresh vm realm with the fakes injected. */
function loadApp({ storage, api, location } = {}) {
  const effectiveStorage = storage ?? makeStorage(location);
  const effectiveApi = api ?? makeApi();

  const document = makeDocument();
  const sandbox = {
    document,
    storage: effectiveStorage,
    api: effectiveApi,
    calc: makeCalc(),
    render: makeRender(),
    LocationNotFound,
  };

  vm.createContext(sandbox);
  vm.runInContext(`${appSource}\n;this.__exports = { app };`, sandbox);

  return {
    app: sandbox.__exports.app,
    elements: document.elements,
    storage: effectiveStorage,
    api: effectiveApi,
  };
}

/* ------------------------------------------------------------------ */
/* submitCity (the pure orchestration core)                            */
/* ------------------------------------------------------------------ */

test("submitCity geocodes, saves, and returns the location", async () => {
  const storage = makeStorage();
  const api = makeApi();
  const { app } = loadApp({ storage, api });

  const result = await app.submitCity("  Riga  ");

  assert.ok(result.location, "expected a location result");
  assert.equal(result.location.name, "Riga");
  assert.equal(result.location.latitude, 56.9496);
  assert.equal(result.location.longitude, 24.1052);
  assert.equal(api.calls.length, 1);
  assert.equal(api.calls[0], "Riga");
  assert.equal(storage.calls.save.length, 1);
  assert.equal(storage.calls.save[0].name, "Riga");
});

test("submitCity returns an empty error without calling the api", async () => {
  const storage = makeStorage();
  const api = makeApi();
  const { app } = loadApp({ storage, api });

  assert.equal((await app.submitCity("   ")).error, "empty");
  assert.equal((await app.submitCity("")).error, "empty");
  assert.equal((await app.submitCity()).error, "empty");

  assert.equal(api.calls.length, 0);
  assert.equal(storage.calls.save.length, 0);
});

test("submitCity returns a not-found error and saves nothing", async () => {
  const storage = makeStorage();
  const api = makeApi({
    onGeocode: () => {
      throw new LocationNotFound("No location found");
    },
  });
  const { app } = loadApp({ storage, api });

  const result = await app.submitCity("Atlantis");

  assert.equal(result.error, "not-found");
  assert.equal(result.location, undefined);
  assert.equal(storage.calls.save.length, 0);
});

test("submitCity returns an api error for any non-location failure", async () => {
  const storage = makeStorage();
  const api = makeApi({
    onGeocode: () => {
      throw new Error("boom");
    },
  });
  const { app } = loadApp({ storage, api });

  const result = await app.submitCity("Riga");

  assert.equal(result.error, "api");
  assert.equal(storage.calls.save.length, 0);
});

/* ------------------------------------------------------------------ */
/* init (initial state)                                               */
/* ------------------------------------------------------------------ */

test("init shows the setup state when no location is saved", () => {
  const { elements } = loadApp();

  assert.equal(elements["setup-state"].hidden, false);
  assert.equal(elements["card-state"].hidden, true);
  assert.equal(elements["setup-error"].hidden, true);
});

test("init shows the card state with the city label when a location exists", () => {
  const location = { name: "Riga", latitude: 56.9496, longitude: 24.1052 };
  const { elements } = loadApp({ location });

  assert.equal(elements["setup-state"].hidden, true);
  assert.equal(elements["card-state"].hidden, false);
  assert.equal(elements["city-label"].textContent, "Riga");
});

/* ------------------------------------------------------------------ */
/* submit wiring (via the captured form listener)                     */
/* ------------------------------------------------------------------ */

test("submit geocodes, persists, and switches to the card state", async () => {
  const storage = makeStorage();
  const api = makeApi();
  const { elements } = loadApp({ storage, api });

  elements["city-input"].value = "  Riga  ";
  await elements["setup-form"].listeners.submit({ preventDefault() {} });

  assert.equal(api.calls[0], "Riga");
  assert.equal(storage.calls.save.length, 1);
  assert.equal(elements["setup-state"].hidden, true);
  assert.equal(elements["card-state"].hidden, false);
  assert.equal(elements["city-label"].textContent, "Riga");
  assert.equal(elements["city-input"].value, "");
});

test("submit shows an inline error for an un-geocodable city", async () => {
  const storage = makeStorage();
  const api = makeApi({
    onGeocode: () => {
      throw new LocationNotFound("No location found");
    },
  });
  const { elements } = loadApp({ storage, api });

  elements["city-input"].value = "Atlantis";
  await elements["setup-form"].listeners.submit({ preventDefault() {} });

  assert.equal(storage.calls.save.length, 0);
  assert.equal(elements["setup-state"].hidden, false);
  assert.equal(elements["card-state"].hidden, true);
  assert.equal(elements["setup-error"].hidden, false);
  assert.match(elements["setup-error"].textContent, /couldn't find/i);
});

test("submit shows a generic inline error on any other failure", async () => {
  const api = makeApi({
    onGeocode: () => {
      throw new Error("boom");
    },
  });
  const { elements } = loadApp({ api });

  elements["city-input"].value = "Riga";
  await elements["setup-form"].listeners.submit({ preventDefault() {} });

  assert.equal(elements["setup-state"].hidden, false);
  assert.equal(elements["card-state"].hidden, true);
  assert.equal(elements["setup-error"].hidden, false);
  assert.match(elements["setup-error"].textContent, /something went wrong/i);
});

test("submit shows an inline error for an empty city without calling the api", async () => {
  const api = makeApi();
  const { elements } = loadApp({ api });

  elements["city-input"].value = "   ";
  await elements["setup-form"].listeners.submit({ preventDefault() {} });

  assert.equal(api.calls.length, 0);
  assert.equal(elements["setup-state"].hidden, false);
  assert.equal(elements["card-state"].hidden, true);
  assert.equal(elements["setup-error"].hidden, false);
  assert.match(elements["setup-error"].textContent, /enter a city/i);
});

/* ------------------------------------------------------------------ */
/* change city (via the captured click listener)                      */
/* ------------------------------------------------------------------ */

test("change city clears storage and returns to the setup state", () => {
  const location = { name: "Riga", latitude: 56.9496, longitude: 24.1052 };
  const storage = makeStorage(location);
  const { elements } = loadApp({ storage });

  assert.equal(elements["card-state"].hidden, false);

  elements["change-city-btn"].listeners.click();

  assert.equal(storage.calls.clear, 1);
  assert.equal(elements["setup-state"].hidden, false);
  assert.equal(elements["card-state"].hidden, true);
  assert.equal(elements["city-input"].value, "");
});
