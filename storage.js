"use strict";

/**
 * Persistence layer. Only the saved location is stored, under the
 * `walk.location` key, as a JSON string. Nothing else is ever persisted.
 */

const STORAGE_KEY = "walk.location";

const storage = {
  /**
   * Save the geocoded location for later loads.
   *
   * @param {{ name: string, latitude: number, longitude: number }} location
   */
  saveLocation(location) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(location));
    } catch (err) {
      // localStorage may be unavailable (private mode, disabled). The app
      // keeps working for this session; the city is simply asked again next
      // load.
    }
  },

  /**
   * Load the saved location.
   *
   * @returns {{ name: string, latitude: number, longitude: number } | null}
   *   The saved location, or null when absent, malformed, or unreadable.
   */
  loadLocation() {
    let raw;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch (err) {
      return null;
    }

    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw);
      return isValidLocation(parsed) ? parsed : null;
    } catch (err) {
      return null;
    }
  },

  /** Remove the saved location, returning to the setup state. */
  clearLocation() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (err) {
      // Nothing to clear when storage is unavailable.
    }
  },
};

/**
 * @param {unknown} value
 * @returns {boolean} true when `value` has the expected location shape:
 *   a non-empty string name plus finite numeric latitude/longitude.
 */
function isValidLocation(value) {
  if (value === null || typeof value !== "object") {
    return false;
  }
  return (
    typeof value.name === "string" &&
    value.name.trim().length > 0 &&
    Number.isFinite(value.latitude) &&
    Number.isFinite(value.longitude)
  );
}
