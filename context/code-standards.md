# Code Standards

## General

- Keep files small and single-purpose, mirroring `architecture.md`:
  `api.js` = networking, `calc.js` = rules, `render.js` = drawing,
  `storage.js` = persistence, `app.js` = orchestration.
- No build step, no framework, no runtime dependencies. Plain HTML, CSS, and
  vanilla JavaScript only.
- Fix root causes; never layer workarounds in the render layer.

## JavaScript

- ES modules or a single ordered script — decided in the scaffold unit, then
  held consistent.
- `const` for values that never change, `let` for reassignment; never `var`.
- `async`/`await` with `try/catch` for every network call; never leave a
  rejected promise unhandled.
- Prefer small pure functions for anything computable (dew point, heat index,
  signal bands) so the rules logic is trivially testable.
- JSDoc `@param`/`@returns` on public functions; trivial helpers don't need it.
- Constants live in `config.js` as `UPPER_SNAKE_CASE` named values; no magic
  numbers in `calc.js`, `api.js`, or `render.js`.

## Business Rules (calc.js)

- `calc.js` is the **single source of truth** for thresholds, signal bands,
  and the GO/CAUTION/NO-GO decision. `render.js` consumes results and never
  re-derives them.
- The decision is a pure function of `(heatIndex, aqi, dewPoint)`; it touches
  no DOM and no network.
- Threshold bands match `project-overview.md` exactly. Changing a threshold
  means updating `project-overview.md` first, then the named constant.

## DOM & Rendering (render.js)

- Use `textContent` for any API-derived string; never inject fetched data via
  `innerHTML`. The SVG sparkline string may be assembled from **numeric**
  values only, after parsing with `Number()`.
- `render.js` builds DOM and SVG from the computed state object; it contains
  no `fetch` and no threshold logic.
- Keep render functions pure-ish: they take state in, return/mutate elements
  out.

## Networking (api.js)

- All `fetch` calls live in `api.js`; endpoint URLs and query building are
  centralized there (or in `config.js`).
- Parse and validate responses into plain objects; throw typed errors
  (`LocationNotFound`, `ApiError`) that `app.js` catches to show a state.

## CSS

- Use only the custom properties defined in `ui-context.md`. No raw hex
  values outside `:root`.
- Class naming is BEM-like: `.card`, `.banner`, `.banner--go`,
  `.metric`, `.metric__value`, etc.
- Dark-only: no light theme, no `prefers-color-scheme` branch, no theme
  toggle.

## Naming

- JavaScript: `camelCase` for functions and variables, `UPPER_SNAKE_CASE` for
  constants, `PascalCase` only for error classes.
- CSS and file names: `kebab-case`.
- HTML ids/classes: kebab-case, semantic (`.metric`, `#decision-banner`).

## Error States

- The page never blanks. Missing location, failed fetch, or malformed data
  must render a clear setup/error state with a path forward (set city,
  retry). All three states are represented in the DOM from the start and
  toggled, not constructed ad hoc.

## Testing

- No test framework dependency. Pure logic in `calc.js` is unit-testable with
  Node's built-in runner (`node --test`, ES modules) — a `tests/` folder is
  optional but encouraged for the rules engine.
- Manual verification uses `python -m http.server` and a browser; check
  DevTools for console errors and the Network tab for the Open-Meteo calls.
- Verify boundary values explicitly: AQI 50/51/150/151, heat index 26.9/27,
  dew point 12.9/13/21/21.1.