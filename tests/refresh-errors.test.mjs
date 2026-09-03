import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * Unit 07 — refresh & error states (app.js) tests.
 *
 * Loads real `config.js` + `calc.js` into the vm so the compute chain is
 * exercised for real, and injects fakes for `document`, `storage`, `api`,
 * `render`, and `LocationNotFound`. Asserts the state orchestration:
 * loading → content on success, loading → error on failure, and the
 * Refresh/Retry wiring that re-runs the pipeline without a page reload.
 * All tests are network-free and deterministic.
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

const LOCATION = { name: "Riga", latitude: 56.9496, longitude: 24.1052 };
const CONDITIONS = {
  temperature: 20,
  relativeHumidity: 50,
  dewPoint: 10,
  aqi: 42,
  hourlyHumidity: [50, 45, 40, 35, 30, 40, 50, 60, 70, 65, 60, 55],
};

/* ------------------------------------------------------------------ */
/* state toggles                                                      */
/* ------------------------------------------------------------------ */

test("showLoadingState shows loading, hides content, and disables Refresh", () => {
  const { app, elements } = loadApp();

  app.showLoadingState();

  assert.equal(elements["loading-state"].hidden, false);
  assert.equal(elements["error-state"].hidden, true);
  assert.equal(elements["card-content"].hidden, true);
  assert.equal(elements["refresh-btn"].disabled, true);
});

test("showErrorState shows error, hides content, and re-enables Refresh", () => {
  const { app, elements } = loadApp();

  app.showErrorState();

  assert.equal(elements["loading-state"].hidden, true);
  assert.equal(elements["error-state"].hidden, false);
  assert.equal(elements["card-content"].hidden, true);
  assert.equal(elements["refresh-btn"].disabled, false);
});

test("showContentState shows content and re-enables Refresh", () => {
  const { app, elements } = loadApp();

  app.showContentState();

  assert.equal(elements["loading-state"].hidden, true);
  assert.equal(elements["error-state"].hidden, true);
  assert.equal(elements["card-content"].hidden, false);
  assert.equal(elements["refresh-btn"].disabled, false);
});

/* ------------------------------------------------------------------ */
/* loadConditions state transitions                                    */
/* ------------------------------------------------------------------ */

test("loadConditions shows loading synchronously, then content on success", async () => {
  const { app, elements } = loadApp({ onConditions: () => CONDITIONS });

  const pending = app.loadConditions(LOCATION);

  // The loading sub-state is set before the first await resolves.
  assert.equal(elements["loading-state"].hidden, false);
  assert.equal(elements["card-content"].hidden, true);
  assert.equal(elements["refresh-btn"].disabled, true);

  await pending;

  assert.equal(elements["loading-state"].hidden, true);
  assert.equal(elements["card-content"].hidden, false);
  assert.equal(elements["error-state"].hidden, true);
  assert.equal(elements["refresh-btn"].disabled, false);
});

test("loadConditions shows the error state and never renders on failure", async () => {
  const { app, render, elements } = loadApp({
    onConditions: () => {
      throw new Error("boom");
    },
  });

  await app.loadConditions(LOCATION);

  assert.equal(render.calls.length, 0);
  assert.equal(elements["error-state"].hidden, false);
  assert.equal(elements["loading-state"].hidden, true);
  assert.equal(elements["card-content"].hidden, true);
});

/* ------------------------------------------------------------------ */
/* refresh / retry wiring                                             */
/* ------------------------------------------------------------------ */

test("clicking Refresh re-runs the full pipeline without a reload", async () => {
  const { elements, api, render } = loadApp({
    location: LOCATION,
    onConditions: () => CONDITIONS,
  });

  await flush(); // initial load settles
  assert.equal(api.calls.length, 1);
  assert.equal(render.calls.length, 2);

  elements["refresh-btn"].listeners.click();
  await flush();

  assert.equal(api.calls.length, 2);
  assert.deepEqual(api.calls[1], {
    fn: "fetchCurrentConditions",
    latitude: 56.9496,
    longitude: 24.1052,
  });
  assert.equal(render.calls.length, 4);
  assert.equal(elements["card-content"].hidden, false);
  assert.equal(elements["error-state"].hidden, true);
});

test("clicking Retry re-runs the pipeline after a failure", async () => {
  let fail = true;
  const { elements, api, render } = loadApp({
    location: LOCATION,
    onConditions: () => {
      if (fail) {
        throw new Error("boom");
      }
      return CONDITIONS;
    },
  });

  await flush(); // initial load fails
  assert.equal(elements["error-state"].hidden, false);
  assert.equal(render.calls.length, 0);

  fail = false;
  elements["retry-btn"].listeners.click();
  await flush();

  assert.equal(api.calls.length, 2);
  assert.equal(elements["error-state"].hidden, true);
  assert.equal(elements["card-content"].hidden, false);
  assert.equal(render.calls.length, 2);
  assert.equal(render.calls[0].kind, "card");
  assert.equal(render.calls[1].kind, "sparkline");
});

test("refreshConditions falls back to setup when no location is saved", () => {
  const { app, elements } = loadApp(); // no location

  app.showCardState(LOCATION);
  assert.equal(elements["card-state"].hidden, false);

  app.refreshConditions();

  assert.equal(elements["setup-state"].hidden, false);
  assert.equal(elements["card-state"].hidden, true);
});
