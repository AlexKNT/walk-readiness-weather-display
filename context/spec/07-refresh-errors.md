# Unit 07: Refresh & Error States

## Goal

Add the manual Refresh button and the three toggled states — loading, error
(retry), setup (set city) — so the page never blanks while fetching, and a
failed fetch shows a clear error state with a working Retry.

## Design

- `app.js` owns state orchestration. The card state (`#card-state`) gains
  three toggled sub-regions that replace the data display area:
  - `#loading-state` — "Loading…" while a fetch is in flight.
  - `#error-state` — a friendly message + a Retry button.
  - `#card-content` — the existing banner + metrics + sparkline.
  The controls row (city label + Change city + Refresh) stays visible the
  whole time the card is shown.
- `loadConditions(location)` becomes the full pipeline with state
  transitions: show loading → fetch → compute → render → show content, or
  show error on failure. It no longer renders a neutral "NO DATA" fallback
  on failure; the dedicated error state replaces that Unit 05 fallback.
- A single `refreshConditions()` re-runs the pipeline for the currently saved
  location; both the Refresh and Retry buttons call it. It falls back to the
  setup state if no location is saved.

## Data flow

```
saved location
  → showLoadingState()                      → #loading-state visible, refresh disabled
  → api.fetchCurrentConditions(lat, lon)    (success) → render → showContentState()
                                               (failure) → showErrorState()
```

## Files

- `index.html` — wrap banner/metrics/sparkline in `#card-content`; add
  `#loading-state` and `#error-state` (with `#retry-btn`) inside
  `#card-state`; keep the controls row as a direct child.
- `styles.css` — minimal styles for `.status-message`, `#loading-state`, and
  `#error-state` using only `:root` tokens.
- `app.js` — add `showLoadingState`/`showErrorState`/`showContentState`,
  `setRefreshing`, and `refreshConditions`; refactor `loadConditions`; wire
  `#refresh-btn` and `#retry-btn`; export the new functions.
- `tests/refresh-errors.test.mjs` — new; vm-based tests for the state
  toggling, the refresh/retry pipeline, and the error path.
- `tests/conditions.test.mjs` — add the new element ids; update the failure
  test to assert the error state instead of the old fallback.
- `tests/location.test.mjs` — add the new element ids to the fake document.

## Testing approach

Same `vm` pattern as Units 04/05: load real `config.js` + `calc.js` + `app.js`
in one realm with fakes for `document`, `storage`, `api`, `render`, and
`LocationNotFound`. Assert:
- `loadConditions` toggles loading first, then content on success.
- `loadConditions` toggles error on failure and never calls `render.card`.
- clicking Refresh or Retry re-runs the pipeline (new `api` call + render).
- `refreshConditions` with no saved location shows the setup state.
- `showLoadingState`/`showErrorState`/`showContentState` hide/show the three
  sub-regions and disable/enable the Refresh button correctly.

## Verify when done

- [ ] `node --test tests/api.test.mjs tests/calc.test.mjs tests/location.test.mjs tests/render.test.mjs tests/conditions.test.mjs tests/sparkline.test.mjs tests/refresh-errors.test.mjs` passes (green).
- [ ] Refresh re-fetches and re-renders without a page reload.
- [ ] A simulated fetch failure shows the error state with a working Retry.
- [ ] No browser console errors on a manual pass.
