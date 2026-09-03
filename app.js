"use strict";

/**
 * Unit 00 scaffold: read the saved location and toggle between the setup
 * state (no city) and the card shell (city saved). No API calls yet.
 */
function init() {
  const setupState = document.getElementById("setup-state");
  const cardState = document.getElementById("card-state");

  let hasLocation = false;
  try {
    hasLocation = Boolean(localStorage.getItem("walk.location"));
  } catch (err) {
    hasLocation = false;
  }

  setupState.hidden = hasLocation;
  cardState.hidden = !hasLocation;

  // The city form is not wired until Unit 04. Prevent a page reload on
  // submit for now.
  const form = document.getElementById("setup-form");
  form.addEventListener("submit", (event) => {
    event.preventDefault();
  });
}

init();
