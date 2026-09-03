# Unit 00: Project Scaffold

## Goal

Produce a runnable static skeleton: `index.html`, `styles.css`, and `app.js`.
The page shows the dark card shell and a setup state (no city saved), served
by any static file server. No API calls yet.

## Design

Minimal by intent — a shell, not a feature. The page renders the full card
layout from `ui-context.md` (decision banner, 2×2 metrics grid, sparkline
slot, controls row) with placeholder content, and the dark-only theme tokens.
`app.js` has a single `init()` that reads `localStorage` and toggles between
the setup state (no location) and a placeholder "set your city first" card.

## Implementation

### Files

- `index.html` — the single page: `<!doctype html>` shell, `<link>` to
  `styles.css`, `<script>` for `app.js`, and the card markup (banner, grid,
  sparkline slot, controls, setup state).
- `styles.css` — `:root` tokens from `ui-context.md`, a reset, dark
  background, and the base card layout classes.
- `app.js` — `init()` reads the `walk.location` key and shows the setup
  state when absent.

### Layout

- `.card` — centered, `max-width: 560px`, `--radius-lg`.
- `#decision-banner` — empty placeholder.
- `.metrics` — 2×2 grid of four `.metric` tiles.
- `.sparkline` — empty placeholder container.
- `.controls` — city label + Refresh button (disabled for now).

### Setup state

When `storage.loadLocation()` returns nothing, show the city input form and
hide the metrics/sparkline. This is the only behavior in this unit.

## Dependencies

None — plain HTML/CSS/JS, no build step, no npm packages.

## Verify when done

- [ ] `python -m http.server` serves the page (open `http://localhost:8000`)
- [ ] The page renders dark with the card shell and setup state
- [ ] No browser console errors
- [ ] All hex values live in `:root` only
