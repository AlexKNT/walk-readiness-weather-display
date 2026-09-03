import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * Unit 08 — static UI polish checks over `styles.css` and `index.html`.
 *
 * These tests enforce the ui-context rules that no unit test can see at
 * runtime: every color comes from a `:root` token (no hex outside `:root`),
 * the NO-GO pulse is the only animation and is reduced-motion gated, the
 * type scale is fluid, focus rings exist for keyboard users, and the HTML
 * carries the accessibility wiring (roles, aria-descriptions, tabindex) plus
 * the bilingual script order.
 */

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const css = readFileSync(join(projectRoot, "styles.css"), "utf8");
const html = readFileSync(join(projectRoot, "index.html"), "utf8");

/** Slice out the first `{…}` block whose selector contains `match`. */
function removeBlock(source, match) {
  const start = source.indexOf(match);
  if (start === -1) {
    return source;
  }
  const open = source.indexOf("{", start);
  if (open === -1) {
    return source;
  }
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === "{") {
      depth += 1;
    } else if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(0, start) + source.slice(i + 1);
      }
    }
  }
  return source;
}

/** Extract the body of the first `{…}` block containing `match`. */
function blockBody(source, match) {
  const start = source.indexOf(match);
  if (start === -1) {
    return null;
  }
  const open = source.indexOf("{", start);
  if (open === -1) {
    return null;
  }
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === "{") {
      depth += 1;
    } else if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(open + 1, i);
      }
    }
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* color tokens                                                       */
/* ------------------------------------------------------------------ */

test("every color is a :root token — no hex values outside :root", () => {
  const rootBody = blockBody(css, ":root");
  assert.ok(rootBody, ":root token block should exist");

  const outsideRoot = removeBlock(css, ":root");
  assert.doesNotMatch(outsideRoot, /#[0-9a-fA-F]{3,8}\b/);
});

test("every var(--token) used in the stylesheet is defined in :root", () => {
  const rootBody = blockBody(css, ":root");
  const outsideRoot = removeBlock(css, ":root");

  const defined = new Set(
    [...rootBody.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]),
  );
  const used = new Set(
    [...outsideRoot.matchAll(/var\((--[a-z0-9-]+)\)/g)].map((m) => m[1]),
  );

  for (const token of used) {
    assert.ok(defined.has(token), `token var(${token}) is used but not defined`);
  }
});

/* ------------------------------------------------------------------ */
/* motion                                                             */
/* ------------------------------------------------------------------ */

test("the NO-GO pulse is the only animation and is reduced-motion gated", () => {
  const mediaBody = blockBody(
    css,
    "@media (prefers-reduced-motion: no-preference)",
  );
  assert.ok(mediaBody, "reduced-motion media block should exist");
  assert.match(mediaBody, /\.banner--no-go/);
  assert.match(mediaBody, /animation:/);

  const withoutMedia = removeBlock(
    css,
    "@media (prefers-reduced-motion: no-preference)",
  );
  assert.doesNotMatch(withoutMedia, /animation\s*:/);
  assert.doesNotMatch(withoutMedia, /transition\s*:/);

  assert.equal((css.match(/@keyframes/g) || []).length, 1);
});

/* ------------------------------------------------------------------ */
/* type scale & layout                                                */
/* ------------------------------------------------------------------ */

test("banner and metric values use fluid clamp sizes", () => {
  const bannerBody = blockBody(css, ".banner {");
  assert.ok(bannerBody);
  assert.match(bannerBody, /clamp\(/);

  const valueBody = blockBody(css, ".metric__value {");
  assert.ok(valueBody);
  assert.match(valueBody, /clamp\(/);
  assert.match(valueBody, /tabular-nums/);
});

test("the card is centered with the 560px max width from ui-context", () => {
  const cardBody = blockBody(css, ".card {");
  assert.ok(cardBody);
  assert.match(cardBody, /max-width:\s*560px/);
});

/* ------------------------------------------------------------------ */
/* focus rings                                                        */
/* ------------------------------------------------------------------ */

test("buttons, the city input, and metric tiles all have focus-visible rings", () => {
  assert.match(css, /\.btn:focus-visible/);
  assert.match(css, /#city-input:focus-visible/);
  assert.match(css, /\.metric:focus-visible/);
});

/* ------------------------------------------------------------------ */
/* accessibility wiring in index.html                                 */
/* ------------------------------------------------------------------ */

test("metric tiles are focusable and describe their explanation notes", () => {
  assert.equal((html.match(/tabindex="0"/g) || []).length, 4);
  for (const id of [
    "metric-dew-note",
    "metric-heat-note",
    "metric-aqi-note",
    "metric-temp-note",
  ]) {
    assert.match(html, new RegExp(`id="${id}"`), `missing #${id}`);
    assert.match(html, new RegExp(`aria-describedby="${id}"`));
  }
});

test("live regions and alert roles are wired for screen readers", () => {
  assert.match(html, /<html lang="en">/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /role="status"/);
  assert.match(html, /<p id="setup-error"[^>]*role="alert"/);
  assert.match(html, /<p[^>]*id="error-message"[^>]*role="alert"/);
  assert.match(html, /id="city-input-label"/);
  assert.match(html, /id="sparkline-caption"/);
});

/* ------------------------------------------------------------------ */
/* bilingual wiring                                                   */
/* ------------------------------------------------------------------ */

test("i18n.js loads before render.js and app.js", () => {
  assert.ok(
    html.indexOf('src="i18n.js"') < html.indexOf('src="render.js"'),
    "i18n.js should load before render.js",
  );
  assert.ok(
    html.indexOf('src="render.js"') < html.indexOf('src="app.js"'),
    "render.js should load before app.js",
  );
});
