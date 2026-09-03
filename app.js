"use strict";

/**
 * Unit 00 scaffold: read the saved location and toggle between the setup
 * state (no city) and the card shell (city saved). No API calls yet.
 */
function init() {
  const setupState = document.getElementById("setup-state");
  const cardState = document.getElementById("card-state");

  const location = storage.loadLocation();

  setupState.hidden = Boolean(location);
  cardState.hidden = !location;

  // The city form is not wired until Unit 04. Prevent a page reload on
  // submit for now.
  const form = document.getElementById("setup-form");
  form.addEventListener("submit", (event) => {
    event.preventDefault();
  });
}

init();
