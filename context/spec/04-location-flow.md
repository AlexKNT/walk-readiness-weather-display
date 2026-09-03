# Unit 04: Location Flow

## Goal

Wire the first-run city entry end to end: on load with no saved location,
show the setup form; on submit, geocode the typed city, persist the
`walk.location`, and proceed to the card state. On later loads, skip the
form. A "Change city" affordance clears the saved location and returns to
the setup state. An un-geocodable city shows an inline error — never a
blank screen.

## Design

Plain ordered script (Unit 00 decision): all location-flow orchestration
lives in `app.js`, which reads `storage`, calls `api.geocode`, and toggles
the two DOM states. No ES modules, no new production files beyond this spec
and the tests.

- `app.js` owns orchestration only: read location → geocode → persist →
  toggle state. It implements no thresholds (those stay in `calc.js`) and
  no networking (that stays in `api.js`).
- The setup form submit handler is async and always catches:
  `LocationNotFound` → inline "not found" error; any other failure → inline
  "try again" error.
- All error text is rendered with `textContent`, never `innerHTML`.

## States

| State | When | DOM |
|---|---|---|
| Setup | no saved location (first run, or after "Change city") | `#setup-state` visible, `#card-state` hidden |
| Card | saved location exists | `#card-state` visible, `#setup-state` hidden, `#city-label` shows the name |

Both states exist in the DOM from the start and are toggled via the `hidden`
attribute (invariant 8: the page never blanks).

## Behavior

- `init()` reads `storage.loadLocation()`. If a location exists → card state
  with the city label filled; otherwise → setup state.
- Setup submit:
  1. Read and trim the input; empty input → inline "enter a city" error.
  2. `api.geocode(city)`.
  3. On success: `storage.saveLocation(location)`, clear the input, show the
     card state.
  4. On `LocationNotFound`: inline "couldn't find that city" error, stay in
     setup.
  5. On any other error: inline "something went wrong" error, stay in setup.
- "Change city": `storage.clearLocation()`, clear the input, show setup.

## Files

- `app.js` — rewrite: location-flow orchestration; `init()` auto-runs on load.
- `index.html` — add `id="setup-submit"` to the submit button, an inline
  `#setup-error` element, and a `#change-city-btn` in the controls row.
- `styles.css` — add `.setup-error`, `.controls__actions`, and a
  `.btn--ghost` variant using only `:root` tokens.
- `tests/location.test.mjs` — new; vm-based tests with fakes for `document`,
  `storage`, and `api`.

## Testing approach

`app.js` auto-runs `init()`, which touches the DOM, so the test loads it in
a `vm` context with fakes for `document` (elements that record listeners),
`storage`, `api`, and a realm-local `LocationNotFound`. Tests assert:

- `submitCity` classification (valid / empty / not-found / api error) and
  that `storage.saveLocation` is called exactly once on success.
- `init` initial state for a saved vs. absent location.
- Submit and change-city flows via the captured listeners.

Cross-realm note: `submitCity` returns an object created inside the vm realm,
so assert its fields individually (`.location`, `.error`) rather than with
`deepStrictEqual`.

## Verify when done

- [ ] `node --test tests/location.test.mjs` passes (green).
- [ ] A typed city persists across reloads; the form is skipped thereafter.
- [ ] An un-geocodable city shows an inline error (not a blank screen).
- [ ] "Change city" clears the saved location and re-shows the setup form.
- [ ] The page loads with no console errors in a browser.
