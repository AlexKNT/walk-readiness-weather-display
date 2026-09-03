import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * Unit 05 — current conditions & decision (app.js read path) tests.
 *
 * Loads real `config.js` + `calc.js` into the vm so the compute chain is
 * exercised for real, and injects fakes for `document`, `storage`, `api`,
 * `render`, and `LocationNotFound`. Asserts the orchestration:
 * fetchCurrentConditions → deriveSignals → decide → render.card, plus the
 * never-blank fallback. All tests are network-free and deterministic.
 */

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const appSource = readFileSync(join(projectRoot, "app.js"), "utf8");
const configSource = readFileSync(join(projectRoot, "config.js"), "utf8");
const calcSource = readFileSync(join(projectRoot, "calc.js"), "utf8");

const ELEMENT_IDS = [
  "setup-state",
  "card-state",
  "setup-form",
  "city-input",
  "setup-submit",
  "setup-error",
  "city-label",
  "change-city-btn",
  "loading-state",
  "error-state",
  "card-content",
  "refresh-btn",
  "retry-btn",
];

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
function makeStorage(location = null) {
  let saved = location;
  return {
    loadLocation() {
      return saved;
    },
    saveLocation(next) {
      saved = next;
    },
    clearLocation() {
      saved = null;
    },
  };
}

/** A fake render that records every card + sparkline render for assertion. */
function makeRender() {
  const calls = [];
  return {
    calls,
    card(signals, decision) {
      calls.push({ kind: "card", signals, decision });
    },
    sparkline(hourlyHumidity) {
      calls.push({ kind: "sparkline", hourlyHumidity });
    },
  };
}

/** A fake api whose fetchCurrentConditions records the coordinates. */
function makeApi({ onConditions } = {}) {
  const calls = [];
  return {
    calls,
    async geocode(city) {
      return { name: city, latitude: 1, longitude: 2 };
    },
    async fetchCurrentConditions(latitude, longitude) {
      calls.push({ fn: "fetchCurrentConditions", latitude, longitude });
      if (onConditions) {
        const result = onConditions(latitude, longitude);
        if (result instanceof Error) {
          throw result;
        }
        return result;
      }
      return { temperature: 20, relativeHumidity: 50, dewPoint: 10, aqi: 42 };
    },
  };
}

/** Load config.js + calc.js + app.js in one vm realm with the fakes. */
function loadApp({ location, onConditions } = {}) {
  const storage = makeStorage(location);
  const api = makeApi({ onConditions });
  const render = makeRender();
  const document = makeDocument();

  const sandbox = {
    document,
    storage,
    api,
    render,
    LocationNotFound,
  };

  vm.createContext(sandbox);
  vm.runInContext(
    `${configSource}\n${calcSource}\n${appSource}\n;this.__exports = { app };`,
    sandbox,
  );

  return {
    app: sandbox.__exports.app,
    elements: document.elements,
    storage,
    api,
    render,
  };
}

/** Flush pending microtasks so fire-and-forget async work settles. */
function flush() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/* ------------------------------------------------------------------ */
/* loadConditions (the pure orchestration core)                        */
/* ------------------------------------------------------------------ */

test("loadConditions fetches, computes, and renders a GO decision", async () => {
  const location = { name: "Riga", latitude: 56.9496, longitude: 24.1052 };
  const conditions = {
    temperature: 20,
    relativeHumidity: 50,
    dewPoint: 10,
    aqi: 42,
    hourlyHumidity: [50, 45, 40, 35, 30, 40, 50, 60, 70, 65, 60, 55],
  };
  const { app, api, render, elements } = loadApp({ onConditions: () => conditions });

  await app.loadConditions(location);

  assert.equal(api.calls.length, 1);
  assert.deepEqual(api.calls[0], {
    fn: "fetchCurrentConditions",
    latitude: 56.9496,
    longitude: 24.1052,
  });

  assert.equal(render.calls.length, 2);
  assert.equal(render.calls[0].kind, "card");
  assert.equal(render.calls[0].decision, "GO");
  assert.equal(render.calls[0].signals.temperature, 20);
  assert.equal(render.calls[0].signals.heatIndex, 20); // below 80°F: equals temp
  assert.equal(render.calls[0].signals.dewPoint, 10);
  assert.equal(render.calls[0].signals.aqi, 42);
  assert.equal(render.calls[0].signals.heatIndexSignal, "GO");
  assert.equal(render.calls[0].signals.dewPointSignal, "GO");
  assert.equal(render.calls[0].signals.aqiSignal, "GO");

  assert.equal(render.calls[1].kind, "sparkline");
  assert.equal(
    JSON.stringify(render.calls[1].hourlyHumidity),
    JSON.stringify([50, 45, 40, 35, 30, 40, 50, 60, 70, 65, 60, 55]),
  );

  // Success ends in the content sub-state, with Refresh re-enabled.
  assert.equal(elements["card-content"].hidden, false);
  assert.equal(elements["loading-state"].hidden, true);
  assert.equal(elements["error-state"].hidden, true);
  assert.equal(elements["refresh-btn"].disabled, false);
});

test("loadConditions computes CAUTION from an elevated AQI", async () => {
  const conditions = { temperature: 20, relativeHumidity: 50, dewPoint: 10, aqi: 80 };
  const { app, render } = loadApp({ onConditions: () => conditions });

  await app.loadConditions({ name: "Riga", latitude: 1, longitude: 2 });

  assert.equal(render.calls[0].decision, "CAUTION");
  assert.equal(render.calls[0].signals.aqiSignal, "CAUTION");
});

test("loadConditions computes NO-GO from a dangerous dew point", async () => {
  const conditions = { temperature: 30, relativeHumidity: 80, dewPoint: 26.2, aqi: 42 };
  const { app, render } = loadApp({ onConditions: () => conditions });

  await app.loadConditions({ name: "Riga", latitude: 1, longitude: 2 });

  assert.equal(render.calls[0].decision, "NO-GO");
  assert.equal(render.calls[0].signals.dewPointSignal, "NO-GO");
});

test("loadConditions shows the error state (no render) when the fetch fails", async () => {
  const { app, render, elements } = loadApp({
    onConditions: () => {
      throw new Error("boom");
    },
  });

  await app.loadConditions({ name: "Riga", latitude: 1, longitude: 2 });

  assert.equal(render.calls.length, 0);
  assert.equal(elements["error-state"].hidden, false);
  assert.equal(elements["loading-state"].hidden, true);
  assert.equal(elements["card-content"].hidden, true);
  assert.equal(elements["refresh-btn"].disabled, false);
});

/* ------------------------------------------------------------------ */
/* init (initial state + read path)                                   */
/* ------------------------------------------------------------------ */

test("init shows the setup state and does not fetch when no location is saved", () => {
  const { elements, api, render } = loadApp();

  assert.equal(elements["setup-state"].hidden, false);
  assert.equal(elements["card-state"].hidden, true);
  assert.equal(api.calls.length, 0);
  assert.equal(render.calls.length, 0);
});

test("init runs the read path when a location is already saved", async () => {
  const location = { name: "Riga", latitude: 56.9496, longitude: 24.1052 };
  const { elements, api, render } = loadApp({ location });

  await flush();

  assert.equal(elements["card-state"].hidden, false);
  assert.equal(elements["setup-state"].hidden, true);
  assert.equal(api.calls.length, 1);
  assert.equal(render.calls.length, 2);
});

test("setting a city geocodes and immediately runs the read path", async () => {
  const { elements, api, render } = loadApp();

  elements["city-input"].value = "  Riga  ";
  await elements["setup-form"].listeners.submit({ preventDefault() {} });
  // handleSubmit calls loadConditions without awaiting it, so flush the
  // pending read-path microtasks before asserting on render.
  await flush();

  assert.equal(elements["card-state"].hidden, false);
  assert.equal(elements["city-label"].textContent, "Riga");
  assert.equal(api.calls.length, 1);
  assert.deepEqual(api.calls[0], {
    fn: "fetchCurrentConditions",
    latitude: 1,
    longitude: 2,
  });
  assert.equal(render.calls.length, 2);
  assert.equal(render.calls[0].kind, "card");
});
