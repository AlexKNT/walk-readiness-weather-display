import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * Unit 06 — humidity sparkline (render.js) tests.
 *
 * `render.sparkline` is a plain browser script that assembles an inline SVG
 * from the hourly humidity series. We load `config.js` + `render.js` in a vm
 * with a fake document exposing only `#sparkline` (whose `innerHTML` we
 * record), then assert the SVG is assembled from numeric values, renders one
 * point per hour, and highlights the lowest-humidity window.
 */

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const configSource = readFileSync(join(projectRoot, "config.js"), "utf8");
const renderSource = readFileSync(join(projectRoot, "render.js"), "utf8");
const i18nSource = readFileSync(join(projectRoot, "i18n.js"), "utf8");

/** Load config.js + render.js in a fresh vm realm with a fake #sparkline. */
function loadRender() {
  const sparkline = { id: "sparkline", innerHTML: "" };
  const document = {
    getElementById(id) {
      if (id !== "sparkline") {
        throw new Error(`render.js looked up unknown element #${id}`);
      }
      return sparkline;
    },
  };

  const sandbox = { document };
  vm.createContext(sandbox);
  vm.runInContext(
    `${configSource}\n${i18nSource}\n${renderSource}\n` +
      `;this.__exports = { render, SPARKLINE_WIDTH, SPARKLINE_HEIGHT, SPARKLINE_PAD_X, SPARKLINE_PAD_Y };`,
    sandbox,
  );

  return {
    render: sandbox.__exports.render,
    sparkline,
    constants: {
      WIDTH: sandbox.__exports.SPARKLINE_WIDTH,
      HEIGHT: sandbox.__exports.SPARKLINE_HEIGHT,
      PAD_X: sandbox.__exports.SPARKLINE_PAD_X,
      PAD_Y: sandbox.__exports.SPARKLINE_PAD_Y,
    },
  };
}

function countOccurrences(haystack, needle) {
  return haystack.split(needle).length - 1;
}

/** Extract the highlight band's x attribute from the assembled SVG. */
function bandX(html) {
  const match = /class="sparkline__band" x="([^"]+)"/.exec(html);
  return match ? Number(match[1]) : null;
}

/* ------------------------------------------------------------------ */
/* lowestHumidityIndex (pure helper)                                  */
/* ------------------------------------------------------------------ */

test("lowestHumidityIndex returns the first index of the minimum", () => {
  const { render } = loadRender();
  assert.equal(render.lowestHumidityIndex([50, 40, 60]), 1);
  assert.equal(render.lowestHumidityIndex([50, 40, 40, 60]), 1); // ties → first
});

test("lowestHumidityIndex skips missing values and coerces strings", () => {
  const { render } = loadRender();
  assert.equal(render.lowestHumidityIndex([null, 50, null, 30]), 3);
  assert.equal(render.lowestHumidityIndex(["50", "30"]), 1); // numeric strings
});

test("lowestHumidityIndex returns -1 when nothing is evaluable", () => {
  const { render } = loadRender();
  assert.equal(render.lowestHumidityIndex([]), -1);
  assert.equal(render.lowestHumidityIndex([null, null]), -1);
  assert.equal(render.lowestHumidityIndex(null), -1);
  assert.equal(render.lowestHumidityIndex(undefined), -1);
});

/* ------------------------------------------------------------------ */
/* sparkline (SVG assembly)                                           */
/* ------------------------------------------------------------------ */

test("sparkline renders an SVG with one point per hour and a polyline", () => {
  const { render, sparkline } = loadRender();
  const humidity = [50, 45, 40, 35, 30, 40, 50, 60, 70, 65, 60, 55];

  render.sparkline(humidity);

  assert.ok(sparkline.innerHTML.startsWith("<svg"));
  assert.equal(countOccurrences(sparkline.innerHTML, "<circle"), 12);
  assert.ok(sparkline.innerHTML.includes('<polyline class="sparkline__line"'));
  assert.ok(sparkline.innerHTML.includes('<rect class="sparkline__band"'));
  assert.ok(
    sparkline.innerHTML.includes(
      'aria-label="12-hour humidity sparkline. График влажности на 12 часов"',
    ),
    "the sparkline should carry a bilingual aria-label",
  );
});

test("sparkline highlights the lowest-humidity hour slot", () => {
  const { render, sparkline, constants } = loadRender();
  // Lowest value (30) sits at index 4.
  const humidity = [50, 45, 40, 60, 30, 40, 50, 60, 70, 65, 60, 55];

  render.sparkline(humidity);

  const plotWidth = constants.WIDTH - 2 * constants.PAD_X;
  const slot = plotWidth / (humidity.length - 1);
  // The band x is emitted rounded to 2 decimals, so compare against the same
  // rounding rather than the raw float.
  const expected = Number((constants.PAD_X + 4 * slot - slot / 2).toFixed(2));

  assert.equal(bandX(sparkline.innerHTML), expected);
});

test("sparkline clamps the band to the plot area at the first hour", () => {
  const { render, sparkline, constants } = loadRender();
  // Lowest value is the very first point, whose band would start left of the
  // plot padding; it must be clamped back inside.
  const humidity = [10, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 99];

  render.sparkline(humidity);

  assert.equal(bandX(sparkline.innerHTML), constants.PAD_X);
});

test("sparkline clears the slot when there is no data to draw", () => {
  const { render, sparkline } = loadRender();
  render.sparkline(null);
  assert.equal(sparkline.innerHTML, "");

  render.sparkline([null, null]);
  assert.equal(sparkline.innerHTML, "");
});

test("sparkline renders a single point without a polyline", () => {
  const { render, sparkline } = loadRender();
  render.sparkline([55]);

  assert.ok(sparkline.innerHTML.startsWith("<svg"));
  assert.equal(countOccurrences(sparkline.innerHTML, "<circle"), 1);
  assert.ok(!sparkline.innerHTML.includes("<polyline"));
});

test("sparkline parses numeric strings before assembling the SVG", () => {
  const { render, sparkline } = loadRender();
  render.sparkline(["55", "60", "50"]);

  assert.ok(sparkline.innerHTML.startsWith("<svg"));
  assert.equal(countOccurrences(sparkline.innerHTML, "<circle"), 3);
});
