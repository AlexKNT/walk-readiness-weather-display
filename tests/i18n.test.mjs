import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * Unit 08 — i18n.js (bilingual English/Russian UI text) tests.
 *
 * `i18n.js` is a plain browser script holding the string table plus a small
 * `i18n` object. We load it in a `vm` context with a fake `document`
 * (`getElementById` + `createElement`, elements that record their child
 * spans) and assert the bilingual composition, the placeholder/aria helpers,
 * and the consistency of the string table itself.
 */

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const i18nSource = readFileSync(join(projectRoot, "i18n.js"), "utf8");

/** A fake DOM node: textContent clears children, append records them. */
function makeNode(tagName) {
  const node = {
    tagName,
    className: "",
    lang: "",
    placeholder: "",
    children: [],
    _text: "",
  };
  Object.defineProperty(node, "textContent", {
    get() {
      return this._text;
    },
    set(value) {
      this._text = String(value);
      this.children = [];
    },
  });
  node.append = function (...nodes) {
    this.children.push(...nodes);
  };
  return node;
}

/** Load i18n.js in a fresh vm realm with the fake document. */
function loadI18n() {
  const elements = new Map();
  const document = {
    getElementById(id) {
      if (!elements.has(id)) {
        elements.set(id, makeNode(id));
      }
      return elements.get(id);
    },
    createElement(tagName) {
      return makeNode(tagName);
    },
  };

  const sandbox = { document };
  vm.createContext(sandbox);
  vm.runInContext(
    `${i18nSource}\n;this.__exports = { i18n, STRINGS, ELEMENTS };`,
    sandbox,
  );

  return {
    i18n: sandbox.__exports.i18n,
    STRINGS: sandbox.__exports.STRINGS,
    ELEMENTS: sandbox.__exports.ELEMENTS,
    document,
  };
}

/* ------------------------------------------------------------------ */
/* setText                                                            */
/* ------------------------------------------------------------------ */

test("setText renders the English original next to the Russian translation", () => {
  const { i18n, document } = loadI18n();
  const el = document.createElement("span");

  i18n.setText(el, "metric-dew-label");

  assert.equal(el.children.length, 2);
  assert.equal(el.children[0].className, "i18n-en");
  assert.equal(el.children[0].textContent, "Dew Point");
  assert.equal(el.children[0].lang, "");
  assert.equal(el.children[1].className, "i18n-ru");
  assert.equal(el.children[1].textContent, "Точка росы");
  assert.equal(el.children[1].lang, "ru");
});

test("setText replaces previous content instead of stacking duplicates", () => {
  const { i18n, document } = loadI18n();
  const el = document.createElement("span");

  i18n.setText(el, "banner-go");
  i18n.setText(el, "banner-no-go");

  assert.equal(el.children.length, 2);
  assert.equal(el.children[0].textContent, "STAY INSIDE: CARDIAC STRESS RISK");
  assert.equal(el.children[1].textContent, "ОСТАВАЙТЕСЬ ДОМА: РИСК ДЛЯ СЕРДЦА");
});

test("setText empties the element for an unknown key", () => {
  const { i18n, document } = loadI18n();
  const el = document.createElement("span");

  i18n.setText(el, "missing-key");

  assert.equal(el.textContent, "");
  assert.equal(el.children.length, 0);
});

/* ------------------------------------------------------------------ */
/* setPlaceholder / aria                                              */
/* ------------------------------------------------------------------ */

test("setPlaceholder shows both languages in the input placeholder", () => {
  const { i18n, document } = loadI18n();
  const el = document.getElementById("city-input");

  i18n.setPlaceholder(el, "city-placeholder");

  assert.equal(el.placeholder, "City, e.g. Riga · Город, напр. Рига");
});

test("aria combines both languages for screen-reader labels", () => {
  const { i18n } = loadI18n();

  assert.equal(
    i18n.aria("sparkline-label"),
    "12-hour humidity sparkline. График влажности на 12 часов",
  );
});

/* ------------------------------------------------------------------ */
/* apply                                                              */
/* ------------------------------------------------------------------ */

test("apply translates every configured static element", () => {
  const { i18n, ELEMENTS, document } = loadI18n();

  i18n.apply();

  for (const { id, placeholder } of ELEMENTS) {
    const el = document.getElementById(id);
    if (placeholder) {
      assert.ok(el.placeholder.length > 0, `#${id} placeholder should be set`);
    } else {
      assert.equal(el.children.length, 2, `#${id} should hold en + ru spans`);
    }
  }
});

/* ------------------------------------------------------------------ */
/* table consistency                                                  */
/* ------------------------------------------------------------------ */

test("every configured element key exists in the strings table", () => {
  const { STRINGS, ELEMENTS } = loadI18n();

  for (const { key } of ELEMENTS) {
    assert.ok(STRINGS[key], `missing strings entry for key "${key}"`);
  }
});

test("every string has non-empty, distinct English and Russian text", () => {
  const { STRINGS } = loadI18n();

  for (const [key, entry] of Object.entries(STRINGS)) {
    assert.ok(
      typeof entry.en === "string" && entry.en.trim().length > 0,
      `"${key}" has an empty English original`,
    );
    assert.ok(
      typeof entry.ru === "string" && entry.ru.trim().length > 0,
      `"${key}" has an empty Russian translation`,
    );
    assert.notEqual(
      entry.en.trim(),
      entry.ru.trim(),
      `"${key}" is not actually translated`,
    );
  }
});
