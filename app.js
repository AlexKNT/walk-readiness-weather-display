"use strict";

/**
 * Orchestration only — the glue that wires the four boundaries together.
 *
 * It owns the app's states (setup / loading / error / content), the
 * location flow (first-run city entry + change city), and the read pipeline
 * (fetch → compute → render) triggered on load, on city entry, and by the
 * Refresh / Retry buttons.
 *
 * No business rules here (those live in `calc.js`), no networking (that
 * lives in `api.js`), no DOM drawing (that lives in `render.js`), and no
 * persistence (that lives in `storage.js`). This file only orchestrates the
 * four.
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

/** Show the loading sub-state inside the card, disabling Refresh. */
function showLoadingState() {
  getElement("loading-state").hidden = false;
  getElement("error-state").hidden = true;
  getElement("card-content").hidden = true;
  setRefreshing(true);
}

/** Show the error sub-state inside the card, re-enabling Refresh. */
function showErrorState() {
  getElement("loading-state").hidden = true;
  getElement("error-state").hidden = false;
  getElement("card-content").hidden = true;
  setRefreshing(false);
}

/** Show the rendered data inside the card, re-enabling Refresh. */
function showContentState() {
  getElement("loading-state").hidden = true;
  getElement("error-state").hidden = true;
  getElement("card-content").hidden = false;
  setRefreshing(false);
}

function setSubmitting(submitting) {
  const submitBtn = getElement("setup-submit");
  submitBtn.disabled = submitting;
  submitBtn.textContent = submitting ? "Finding city…" : "Set city";
}

function setRefreshing(refreshing) {
  getElement("refresh-btn").disabled = refreshing;
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
    loadConditions(result.location);
  } else {
    showSetupState(SETUP_ERRORS[result.error] ?? SETUP_ERRORS.api);
  }
}

function handleChangeCity() {
  storage.clearLocation();
  getElement("city-input").value = "";
  showSetupState();
}

/**
 * Run the read pipeline for a saved location: fetch → compute → render.
 *
 * The card shows a loading sub-state while the fetch is in flight, the
 * rendered content on success, and the error sub-state (with Retry) on
 * failure — so the page never blanks (invariant 8).
 *
 * @param {{ name: string, latitude: number, longitude: number }} location
 * @returns {Promise<void>}
 */
async function loadConditions(location) {
  showLoadingState();
  try {
    const current = await api.fetchCurrentConditions(
      location.latitude,
      location.longitude,
    );
    const signals = calc.deriveSignals(current);
    const decision = calc.decide(
      signals.heatIndex,
      signals.aqi,
      signals.dewPoint,
    );
    render.card(signals, decision);
    render.sparkline(current.hourlyHumidity);
    showContentState();
  } catch (err) {
    showErrorState();
  }
}

/**
 * Re-run the read pipeline for the currently saved location. Used by both
 * the Refresh and Retry buttons. Falls back to setup when no location is
 * saved (e.g. the city was cleared).
 */
function refreshConditions() {
  const location = storage.loadLocation();
  if (!location) {
    showSetupState();
    return;
  }
  loadConditions(location);
}

function init() {
  getElement("setup-form").addEventListener("submit", handleSubmit);
  getElement("change-city-btn").addEventListener("click", handleChangeCity);
  getElement("refresh-btn").addEventListener("click", refreshConditions);
  getElement("retry-btn").addEventListener("click", refreshConditions);

  const location = storage.loadLocation();
  if (location) {
    showCardState(location);
    loadConditions(location);
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
  loadConditions,
  refreshConditions,
  showLoadingState,
  showErrorState,
  showContentState,
};

init();
