"use strict";

/**
 * Unit 04 — location flow (orchestration only).
 *
 * Reads the saved location and toggles between the setup state (no city) and
 * the card state (city saved). Wires the first-run city form: geocode the
 * typed city, persist it, and proceed to the card — or show an inline error
 * when geocoding fails. "Change city" clears the saved location and returns
 * to the setup form.
 *
 * No business rules here (those live in `calc.js`), no networking (that
 * lives in `api.js`), and no persistence (that lives in `storage.js`). This
 * file only orchestrates the three.
 */

const SETUP_ERRORS = {
  empty: "Please enter a city.",
  "not-found": "We couldn't find that city. Check the spelling and try again.",
  api: "Something went wrong. Please try again.",
};

function getElement(id) {
  return document.getElementById(id);
}

function showSetupState(message) {
  getElement("setup-state").hidden = false;
  getElement("card-state").hidden = true;

  const errorEl = getElement("setup-error");
  if (message) {
    errorEl.textContent = message;
    errorEl.hidden = false;
  } else {
    errorEl.textContent = "";
    errorEl.hidden = true;
  }
}

function showCardState(location) {
  getElement("setup-state").hidden = true;
  getElement("card-state").hidden = false;
  getElement("city-label").textContent = location.name;
}

function setSubmitting(submitting) {
  const submitBtn = getElement("setup-submit");
  submitBtn.disabled = submitting;
  submitBtn.textContent = submitting ? "Finding city…" : "Set city";
}

/**
 * Geocode a city and persist it. Returns a result object instead of touching
 * the DOM, so the flow is trivially testable.
 *
 * @param {string} cityValue
 * @returns {Promise<
 *   | { location: { name: string, latitude: number, longitude: number } }
 *   | { error: "empty" | "not-found" | "api" }
 * >}
 */
async function submitCity(cityValue) {
  const city = String(cityValue ?? "").trim();
  if (city === "") {
    return { error: "empty" };
  }

  try {
    const location = await api.geocode(city);
    storage.saveLocation(location);
    return { location };
  } catch (err) {
    if (err instanceof LocationNotFound) {
      return { error: "not-found" };
    }
    return { error: "api" };
  }
}

async function handleSubmit(event) {
  if (event && typeof event.preventDefault === "function") {
    event.preventDefault();
  }

  const city = getElement("city-input").value;
  if (String(city ?? "").trim() === "") {
    showSetupState(SETUP_ERRORS.empty);
    return;
  }

  setSubmitting(true);
  const result = await submitCity(city);
  setSubmitting(false);

  if (result.location) {
    getElement("city-input").value = "";
    showCardState(result.location);
  } else {
    showSetupState(SETUP_ERRORS[result.error] ?? SETUP_ERRORS.api);
  }
}

function handleChangeCity() {
  storage.clearLocation();
  getElement("city-input").value = "";
  showSetupState();
}

function init() {
  getElement("setup-form").addEventListener("submit", handleSubmit);
  getElement("change-city-btn").addEventListener("click", handleChangeCity);

  const location = storage.loadLocation();
  if (location) {
    showCardState(location);
  } else {
    showSetupState();
  }
}

const app = {
  init,
  submitCity,
  handleSubmit,
  handleChangeCity,
  showSetupState,
  showCardState,
};

init();
