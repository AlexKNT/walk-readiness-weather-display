import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * Unit 05 — rendering layer (render.js) tests.
 *
 * `render.js` is a plain browser script that turns a computed state into DOM
 * text and status classes. We load it in a `vm` context with a fake
 * `document` whose elements record `classList` changes, then assert text and
 * class toggling. No thresholds are re-derived here — the tests only verify
 * presentation.
 */

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const renderSource = readFileSync(join(projectRoot, "render.js"), "utf8");

const ELEMENT_IDS = [
  "decision-banner",
  "metric-dew",
  "metric-heat",
  "metric-aqi",
  "metric-temp",
];

/** A fake element exposing the text/class surface render.js touches. */
function makeElement(id) {
  const classes = new Set();
  return {
    id,
    textContent: "",
    classList: {
      add(cls) {
        classes.add(cls);
      },
      remove(cls) {
        classes.delete(cls);
      },
      contains(cls) {
        return classes.has(cls);
      },
    },
    hasClass(cls) {
      return classes.has(cls);
    },
  };
}

/** A fake document over exactly the ids render.js looks up. */
function makeDocument() {
  const elements = Object.fromEntries(
    ELEMENT_IDS.map((id) => [id, makeElement(id)]),
  );
  return {
    elements,
    getElementById(id) {
      if (!elements[id]) {
        throw new Error(`render.js looked up unknown element #${id}`);
      }
      return elements[id];
    },
  };
}

/** Load render.js in a fresh vm realm with a fake document. */
function loadRender() {
  const document = makeDocument();
  const sandbox = { document };
  vm.createContext(sandbox);
  vm.runInContext(`${renderSource}\n;this.__exports = { render };`, sandbox);
  return { render: sandbox.__exports.render, elements: document.elements };
}

/** A fully-safe derived-signals object. */
const goSignals = {
  temperature: 21.3,
  relativeHumidity: 55,
  dewPoint: 11.8,
  heatIndex: 21.3,
  aqi: 42,
  heatIndexSignal: "GO",
  dewPointSignal: "GO",
  aqiSignal: "GO",
};

/* ------------------------------------------------------------------ */
/* decision banner                                                    */
/* ------------------------------------------------------------------ */

test("decision renders GO text and class", () => {
  const { render, elements } = loadRender();
  render.decision("GO");

  assert.equal(elements["decision-banner"].textContent, "WALK RECOMMENDED");
  assert.ok(elements["decision-banner"].hasClass("banner--go"));
  assert.ok(!elements["decision-banner"].hasClass("banner--caution"));
  assert.ok(!elements["decision-banner"].hasClass("banner--no-go"));
});

test("decision renders CAUTION text and class", () => {
  const { render, elements } = loadRender();
  render.decision("CAUTION");

  assert.equal(elements["decision-banner"].textContent, "HIGH HUMIDITY: STAY SHADED");
  assert.ok(elements["decision-banner"].hasClass("banner--caution"));
});

test("decision renders NO-GO text and class", () => {
  const { render, elements } = loadRender();
  render.decision("NO-GO");

  assert.equal(elements["decision-banner"].textContent, "STAY INSIDE: CARDIAC STRESS RISK");
  assert.ok(elements["decision-banner"].hasClass("banner--no-go"));
});

test("decision renders a neutral NO DATA banner for null", () => {
  const { render, elements } = loadRender();
  render.decision(null);

  assert.equal(elements["decision-banner"].textContent, "NO DATA");
  assert.ok(!elements["decision-banner"].hasClass("banner--go"));
  assert.ok(!elements["decision-banner"].hasClass("banner--caution"));
  assert.ok(!elements["decision-banner"].hasClass("banner--no-go"));
});

test("decision clears the previous status class on update", () => {
  const { render, elements } = loadRender();
  render.decision("GO");
  render.decision("NO-GO");

  assert.ok(elements["decision-banner"].hasClass("banner--no-go"));
  assert.ok(!elements["decision-banner"].hasClass("banner--go"));
});

/* ------------------------------------------------------------------ */
/* metrics grid                                                       */
/* ------------------------------------------------------------------ */

test("metrics renders the four values with units", () => {
  const { render, elements } = loadRender();
  render.metrics(goSignals, "GO");

  assert.equal(elements["metric-dew"].textContent, "11.8°C");
  assert.equal(elements["metric-heat"].textContent, "21.3°C");
  assert.equal(elements["metric-aqi"].textContent, "42");
  assert.equal(elements["metric-temp"].textContent, "21.3°C");
});

test("metrics tints only the metric whose signal matches the decision", () => {
  const { render, elements } = loadRender();
  const signals = { ...goSignals, aqiSignal: "CAUTION" };
  render.metrics(signals, "CAUTION");

  assert.ok(elements["metric-aqi"].hasClass("metric__value--caution"));
  assert.ok(!elements["metric-dew"].hasClass("metric__value--caution"));
  assert.ok(!elements["metric-heat"].hasClass("metric__value--caution"));
  assert.ok(!elements["metric-temp"].hasClass("metric__value--caution"));
});

test("metrics tints the NO-GO metric in red", () => {
  const { render, elements } = loadRender();
  const signals = { ...goSignals, dewPointSignal: "NO-GO" };
  render.metrics(signals, "NO-GO");

  assert.ok(elements["metric-dew"].hasClass("metric__value--no-go"));
  assert.ok(!elements["metric-heat"].hasClass("metric__value--no-go"));
});

test("metrics leaves values neutral when the decision is null", () => {
  const { render, elements } = loadRender();
  render.metrics(goSignals, null);

  for (const id of ELEMENT_IDS.slice(1)) {
    assert.ok(!elements[id].hasClass("metric__value--go"));
    assert.ok(!elements[id].hasClass("metric__value--caution"));
    assert.ok(!elements[id].hasClass("metric__value--no-go"));
  }
});

test("metrics renders an em dash for missing values", () => {
  const { render, elements } = loadRender();
  render.metrics(
    {
      temperature: null,
      relativeHumidity: null,
      dewPoint: null,
      heatIndex: null,
      aqi: null,
      heatIndexSignal: null,
      dewPointSignal: null,
      aqiSignal: null,
    },
    null,
  );

  assert.equal(elements["metric-dew"].textContent, "—");
  assert.equal(elements["metric-heat"].textContent, "—");
  assert.equal(elements["metric-aqi"].textContent, "—");
  assert.equal(elements["metric-temp"].textContent, "—");
});

test("metrics rounds AQI to an integer and formats °C to one decimal", () => {
  const { render, elements } = loadRender();
  render.metrics(
    {
      temperature: 18.46,
      relativeHumidity: 50,
      dewPoint: 12.86,
      heatIndex: 18.46,
      aqi: 42.6,
      heatIndexSignal: "GO",
      dewPointSignal: "GO",
      aqiSignal: "GO",
    },
    "GO",
  );

  assert.equal(elements["metric-temp"].textContent, "18.5°C");
  assert.equal(elements["metric-dew"].textContent, "12.9°C");
  assert.equal(elements["metric-aqi"].textContent, "43");
});
