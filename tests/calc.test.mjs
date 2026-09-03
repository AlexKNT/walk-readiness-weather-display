import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * Unit 03 — domain logic (calc.js) tests.
 *
 * `calc.js` is a plain browser script (no ES modules in production code).
 * To test it in Node we load `config.js` + `calc.js` together inside a `vm`
 * context (config first, so its `const` constants are visible), then expose
 * the `calc` object. All tests are pure and deterministic.
 *
 * Cross-realm note: `calc` and the object returned by `deriveSignals` are
 * created inside the vm realm, so `deepStrictEqual` would fail on their
 * prototype. We assert individual fields and primitives instead.
 */

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const configSource = readFileSync(join(projectRoot, "config.js"), "utf8");
const calcSource = readFileSync(join(projectRoot, "calc.js"), "utf8");

/** Load config.js + calc.js in a fresh vm realm. */
function loadCalc() {
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(
    `${configSource}\n${calcSource}\n;this.__exports = { calc };`,
    sandbox,
  );
  return sandbox.__exports.calc;
}

/** Assert `actual` is within `tolerance` of `expected`. */
function close(actual, expected, tolerance, label = "") {
  assert.ok(
    Number.isFinite(actual),
    `${label} expected a finite number, got ${actual}`,
  );
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${label} expected ${actual} ≈ ${expected} ± ${tolerance}`,
  );
}

/* ------------------------------------------------------------------ */
/* dewPointFallback (Magnus)                                          */
/* ------------------------------------------------------------------ */

test("dewPointFallback matches the Magnus reference value", () => {
  const calc = loadCalc();
  close(calc.dewPointFallback(21.3, 55), 11.9, 0.1, "dewPointFallback(21.3, 55)");
});

test("dewPointFallback equals temperature at 100% humidity", () => {
  const calc = loadCalc();
  close(calc.dewPointFallback(20, 100), 20, 1e-9, "dewPointFallback(20, 100)");
});

test("dewPointFallback returns null for non-finite temperature", () => {
  const calc = loadCalc();
  assert.equal(calc.dewPointFallback(NaN, 55), null);
  assert.equal(calc.dewPointFallback(null, 55), null);
  assert.equal(calc.dewPointFallback(undefined, 55), null);
});

test("dewPointFallback returns null for non-finite or non-positive humidity", () => {
  const calc = loadCalc();
  assert.equal(calc.dewPointFallback(21.3, null), null);
  assert.equal(calc.dewPointFallback(21.3, NaN), null);
  assert.equal(calc.dewPointFallback(21.3, 0), null);
});

/* ------------------------------------------------------------------ */
/* heatIndex (NOAA Rothfusz)                                          */
/* ------------------------------------------------------------------ */

test("heatIndex equals temperature below 80°F", () => {
  const calc = loadCalc();
  assert.equal(calc.heatIndex(20, 50), 20);
});

test("heatIndex equals temperature when humidity is below 40%", () => {
  const calc = loadCalc();
  assert.equal(calc.heatIndex(30, 30), 30);
});

test("heatIndex below 80°F ignores a missing humidity", () => {
  const calc = loadCalc();
  assert.equal(calc.heatIndex(20, null), 20);
});

test("heatIndex matches a known Rothfusz reference (32.22°C, 70%)", () => {
  const calc = loadCalc();
  close(calc.heatIndex(32.22, 70), 41.07, 0.5, "heatIndex(32.22, 70)");
});

test("heatIndex returns null for non-finite temperature", () => {
  const calc = loadCalc();
  assert.equal(calc.heatIndex(null, 60), null);
  assert.equal(calc.heatIndex(NaN, 60), null);
  assert.equal(calc.heatIndex(undefined, 60), null);
});

test("heatIndex returns null when ≥ 80°F and humidity is missing", () => {
  const calc = loadCalc();
  assert.equal(calc.heatIndex(30, null), null);
  assert.equal(calc.heatIndex(30, NaN), null);
});

test("heatIndex increases with humidity at the same temperature", () => {
  const calc = loadCalc();
  assert.ok(calc.heatIndex(30, 80) > calc.heatIndex(30, 50));
});

test("heatIndex increases with temperature at the same humidity", () => {
  const calc = loadCalc();
  assert.ok(calc.heatIndex(35, 60) > calc.heatIndex(30, 60));
});

/* ------------------------------------------------------------------ */
/* classifyHeatIndex                                                  */
/* ------------------------------------------------------------------ */

test("classifyHeatIndex honors GO/CAUTION/NO-GO boundaries", () => {
  const calc = loadCalc();
  assert.equal(calc.classifyHeatIndex(26.9), "GO");
  assert.equal(calc.classifyHeatIndex(27), "CAUTION");
  assert.equal(calc.classifyHeatIndex(38.9), "CAUTION");
  assert.equal(calc.classifyHeatIndex(39), "NO-GO");
});

test("classifyHeatIndex returns null for non-finite input", () => {
  const calc = loadCalc();
  assert.equal(calc.classifyHeatIndex(null), null);
  assert.equal(calc.classifyHeatIndex(NaN), null);
  assert.equal(calc.classifyHeatIndex(undefined), null);
});

/* ------------------------------------------------------------------ */
/* classifyAqi                                                        */
/* ------------------------------------------------------------------ */

test("classifyAqi honors GO/CAUTION/NO-GO boundaries", () => {
  const calc = loadCalc();
  assert.equal(calc.classifyAqi(50), "GO");
  assert.equal(calc.classifyAqi(51), "CAUTION");
  assert.equal(calc.classifyAqi(150), "CAUTION");
  assert.equal(calc.classifyAqi(151), "NO-GO");
});

test("classifyAqi returns null for non-finite input", () => {
  const calc = loadCalc();
  assert.equal(calc.classifyAqi(null), null);
  assert.equal(calc.classifyAqi(NaN), null);
});

/* ------------------------------------------------------------------ */
/* classifyDewPoint                                                   */
/* ------------------------------------------------------------------ */

test("classifyDewPoint honors GO/CAUTION/NO-GO boundaries", () => {
  const calc = loadCalc();
  assert.equal(calc.classifyDewPoint(12.9), "GO");
  assert.equal(calc.classifyDewPoint(13), "CAUTION");
  assert.equal(calc.classifyDewPoint(21), "CAUTION");
  assert.equal(calc.classifyDewPoint(21.1), "NO-GO");
});

test("classifyDewPoint returns null for non-finite input", () => {
  const calc = loadCalc();
  assert.equal(calc.classifyDewPoint(null), null);
  assert.equal(calc.classifyDewPoint(undefined), null);
});

/* ------------------------------------------------------------------ */
/* decide (worst of three signals)                                    */
/* ------------------------------------------------------------------ */

test("decide returns GO when all three signals are safe", () => {
  const calc = loadCalc();
  assert.equal(calc.decide(20, 30, 10), "GO");
});

test("decide returns CAUTION when any single signal is elevated", () => {
  const calc = loadCalc();
  assert.equal(calc.decide(28, 30, 10), "CAUTION"); // heat index
  assert.equal(calc.decide(20, 80, 10), "CAUTION"); // AQI
  assert.equal(calc.decide(20, 30, 15), "CAUTION"); // dew point
});

test("decide returns NO-GO when any single signal is dangerous", () => {
  const calc = loadCalc();
  assert.equal(calc.decide(40, 30, 10), "NO-GO"); // heat index
  assert.equal(calc.decide(20, 200, 10), "NO-GO"); // AQI
  assert.equal(calc.decide(20, 30, 25), "NO-GO"); // dew point
});

test("decide ranks NO-GO over CAUTION over GO", () => {
  const calc = loadCalc();
  assert.equal(calc.decide(40, 80, 15), "NO-GO");
  assert.equal(calc.decide(26, 151, 10), "NO-GO");
  assert.equal(calc.decide(28, 80, 10), "CAUTION");
});

test("decide honors every boundary value exactly", () => {
  const calc = loadCalc();
  assert.equal(calc.decide(26.9, 50, 12.9), "GO");
  assert.equal(calc.decide(27, 51, 13), "CAUTION");
  assert.equal(calc.decide(39, 151, 21.1), "NO-GO");
});

test("decide skips missing signals instead of treating them as safe", () => {
  const calc = loadCalc();
  assert.equal(calc.decide(null, 80, 10), "CAUTION");
  assert.equal(calc.decide(null, null, 10), "GO");
  assert.equal(calc.decide(40, null, null), "NO-GO");
  assert.equal(calc.decide(null, null, null), null);
});

/* ------------------------------------------------------------------ */
/* deriveSignals                                                      */
/* ------------------------------------------------------------------ */

test("deriveSignals prefers the API dew point and classifies all signals", () => {
  const calc = loadCalc();
  const s = calc.deriveSignals({
    temperature: 21.3,
    relativeHumidity: 55,
    dewPoint: 11.8,
    aqi: 42,
  });

  assert.equal(s.temperature, 21.3);
  assert.equal(s.relativeHumidity, 55);
  assert.equal(s.dewPoint, 11.8); // API value, not the Magnus fallback
  assert.equal(s.heatIndex, 21.3); // below 80°F: equals temperature
  assert.equal(s.aqi, 42);
  assert.equal(s.heatIndexSignal, "GO");
  assert.equal(s.dewPointSignal, "GO");
  assert.equal(s.aqiSignal, "GO");
});

test("deriveSignals falls back to the Magnus dew point when it is missing", () => {
  const calc = loadCalc();
  const s = calc.deriveSignals({
    temperature: 30,
    relativeHumidity: 80,
    dewPoint: null,
    aqi: 100,
  });

  close(s.dewPoint, 26.17, 0.1, "deriveSignals dew point fallback");
  assert.equal(s.dewPointSignal, "NO-GO");
  assert.equal(s.heatIndexSignal, "CAUTION");
  assert.equal(s.aqiSignal, "CAUTION");
});

test("deriveSignals marks a missing AQI as unknown", () => {
  const calc = loadCalc();
  const s = calc.deriveSignals({
    temperature: 25,
    relativeHumidity: 40,
    dewPoint: 10,
    aqi: null,
  });

  assert.equal(s.aqi, null);
  assert.equal(s.aqiSignal, null);
  assert.equal(s.dewPoint, 10);
  assert.equal(s.dewPointSignal, "GO");
  assert.equal(s.heatIndex, 25);
  assert.equal(s.heatIndexSignal, "GO");
});

test("deriveSignals normalizes numeric strings", () => {
  const calc = loadCalc();
  const s = calc.deriveSignals({
    temperature: "30",
    relativeHumidity: "80",
    dewPoint: undefined,
    aqi: "100",
  });

  assert.equal(s.temperature, 30);
  assert.equal(s.relativeHumidity, 80);
  close(s.dewPoint, 26.17, 0.1, "deriveSignals string-input dew point");
  assert.equal(s.aqi, 100);
  assert.equal(s.dewPointSignal, "NO-GO");
  assert.equal(s.aqiSignal, "CAUTION");
});

test("deriveSignals returns all-null values for empty or null input", () => {
  const calc = loadCalc();
  for (const input of [{}, null]) {
    const s = calc.deriveSignals(input);

    assert.equal(s.temperature, null);
    assert.equal(s.relativeHumidity, null);
    assert.equal(s.dewPoint, null);
    assert.equal(s.heatIndex, null);
    assert.equal(s.aqi, null);
    assert.equal(s.heatIndexSignal, null);
    assert.equal(s.dewPointSignal, null);
    assert.equal(s.aqiSignal, null);
  }
});
