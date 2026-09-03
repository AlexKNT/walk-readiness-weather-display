import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * Unit 09 — persistence layer (storage.js) tests.
 *
 * `storage.js` is a plain browser script that only touches the
 * `localStorage` global. We load it in a `vm` context with an injected fake
 * `localStorage` (in-memory Map), then assert the round-trip and the
 * hardening contract: malformed or wrong-shaped values read as "no
 * location", and an unavailable `localStorage` never throws.
 *
 * Cross-realm note: `loadLocation` returns an object created inside the vm
 * realm, so we assert its fields individually, never `deepStrictEqual`.
 */

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const storageSource = readFileSync(join(projectRoot, "storage.js"), "utf8");

/** An in-memory localStorage stand-in over a plain Map. */
function makeLocalStorage() {
  const map = new Map();
  return {
    map,
    getItem(key) {
      return map.has(key) ? map.get(key) : null;
    },
    setItem(key, value) {
      map.set(key, String(value));
    },
    removeItem(key) {
      map.delete(key);
    },
  };
}

/** Load storage.js in a fresh vm realm with the given localStorage. */
function loadStorage(localStorageImpl) {
  const sandbox = { localStorage: localStorageImpl };
  vm.createContext(sandbox);
  vm.runInContext(
    `${storageSource}\n;this.__exports = { storage };`,
    sandbox,
  );
  return sandbox.__exports.storage;
}

/** Load storage.js over a backend pre-seeded with `raw` at the key. */
function loadWithRaw(raw) {
  const backend = makeLocalStorage();
  backend.map.set("walk.location", raw);
  return { storage: loadStorage(backend), backend };
}

const LOCATION = { name: "Riga", latitude: 56.9496, longitude: 24.1052 };

/* ------------------------------------------------------------------ */
/* round-trip                                                         */
/* ------------------------------------------------------------------ */

test("a saved location round-trips through localStorage", () => {
  const backend = makeLocalStorage();
  const storage = loadStorage(backend);

  storage.saveLocation(LOCATION);
  const loaded = storage.loadLocation();

  assert.ok(loaded, "expected the saved location back");
  assert.equal(loaded.name, "Riga");
  assert.equal(loaded.latitude, 56.9496);
  assert.equal(loaded.longitude, 24.1052);
  assert.equal(
    backend.map.get("walk.location"),
    JSON.stringify(LOCATION),
    "the location should be stored as JSON",
  );
});

test("clearLocation removes the saved location", () => {
  const backend = makeLocalStorage();
  const storage = loadStorage(backend);

  storage.saveLocation(LOCATION);
  storage.clearLocation();

  assert.equal(storage.loadLocation(), null);
});

/* ------------------------------------------------------------------ */
/* malformed / absent values                                          */
/* ------------------------------------------------------------------ */

test("loadLocation returns null when nothing is saved", () => {
  const storage = loadStorage(makeLocalStorage());
  assert.equal(storage.loadLocation(), null);
});

test("loadLocation returns null for malformed JSON", () => {
  const { storage } = loadWithRaw("{not json");
  assert.equal(storage.loadLocation(), null);
});

test("loadLocation rejects values without a valid location shape", () => {
  const invalid = [
    "null",
    "42",
    '"Riga"',
    "[]",
    "{}",
    '{"name":"Riga"}',
    '{"name":"Riga","latitude":"56.9","longitude":24.1}',
    '{"name":"Riga","latitude":null,"longitude":24.1}',
    '{"name":"  ","latitude":56.9,"longitude":24.1}',
    '{"name":"Riga","latitude":1e400,"longitude":24.1}',
  ];

  for (const raw of invalid) {
    const { storage } = loadWithRaw(raw);
    assert.equal(storage.loadLocation(), null, `should reject ${raw}`);
  }
});

/* ------------------------------------------------------------------ */
/* unavailable storage                                                */
/* ------------------------------------------------------------------ */

test("loadLocation returns null when localStorage throws", () => {
  const storage = loadStorage({
    getItem() {
      throw new Error("storage disabled");
    },
    setItem() {},
    removeItem() {},
  });

  assert.equal(storage.loadLocation(), null);
});

test("saveLocation and clearLocation swallow storage errors", () => {
  const backend = makeLocalStorage();
  backend.getItem = () => {
    throw new Error("storage disabled");
  };
  backend.setItem = () => {
    throw new Error("storage disabled");
  };
  backend.removeItem = () => {
    throw new Error("storage disabled");
  };
  const storage = loadStorage(backend);

  assert.doesNotThrow(() => storage.saveLocation(LOCATION));
  assert.doesNotThrow(() => storage.clearLocation());
});
