# Unit 08: UI Polish, Responsive, Accessibility & Bilingual UI

## Goal

Apply the final visual layer from `ui-context.md` (typography scale, metric
tiles, banner, sparkline, focus rings, mobile-first layout), make the page
legible at 360px and 1280px, add the only permitted motion (the NO-GO pulse,
gated behind `prefers-reduced-motion`), and — beyond the original unit scope —
make the UI fully keyboard/screen-reader accessible and bilingual: English
originals with Russian translations shown side by side, plus a short
explanation for each metric revealed on hover/focus.

## Design

- **Typography & layout** (per `ui-context.md`): banner
  `clamp(1.75rem, 7vw, 2.75rem)` / 800 monospace (scaled down from the
  aspirational 4rem maximum so the bilingual banner still fits the 560px
  card); metric values `clamp(1.5rem, 5vw, 2.25rem)` / 700 monospace with
  `font-variant-numeric: tabular-nums`; labels 0.75rem / 500 uppercase
  +0.08em; city/meta 0.875rem. Fluid `clamp()` padding on `body` and `.card`
  replaces fixed values; `.controls` wraps so the buttons never overflow at
  360px.
- **Bilingual UI**: new `i18n.js` is the single source of truth for
  user-facing copy — a `STRINGS` table (`en` + `ru`) plus a small `i18n`
  object. `i18n.setText(el, key)` renders the English original and a muted
  `lang="ru"` translation side by side (`·` separator via CSS); on the
  banner the Russian line drops to a smaller second line. `i18n.apply()`
  translates every configured static element; `app.js` calls it from
  `init()`. Dynamic copy (decision banner, setup errors, submitting label,
  sparkline `aria-label`) also flows through `i18n`. No user-facing string
  stays hardcoded in `render.js` or `app.js`.
- **Metric explanations**: each metric tile gains a `.metric__note` — a
  short one-sentence summary of what the metric means and its safe band.
  The note is hidden by default and revealed on hover and keyboard focus
  (`.metric:hover` / `.metric:focus-within`, no animation). Tiles are
  keyboard-reachable (`tabindex="0"`) and link the note via
  `aria-describedby`, so screen-reader users get the explanation on focus.
- **Accessibility**: `#setup-error` and `#error-message` get
  `role="alert"`; the loading message keeps `role="status"`; the banner
  keeps `aria-live="polite"`; the city input gets `aria-describedby` to the
  setup error; the metric tiles get visible `:focus-visible` rings matching
  the buttons/input; the bilingual spans carry `lang="ru"` so screen readers
  switch pronunciation.
- **Motion**: the only animation is a slow opacity pulse on
  `.banner--no-go`, declared inside
  `@media (prefers-reduced-motion: no-preference)`. No transitions, no other
  keyframes.

## Files

- `i18n.js` — new; `STRINGS` (en/ru) + `ELEMENTS` map + `i18n` object
  (`entry`, `aria`, `setText`, `setPlaceholder`, `apply`).
- `index.html` — ids for every static string, `role`s, metric notes +
  `tabindex` + `aria-describedby`, sparkline caption, `i18n.js` script
  before `render.js`, `theme-color` meta.
- `styles.css` — bilingual text styles, metric-note reveal, metric focus
  ring, NO-GO pulse (reduced-motion gated), fluid typography/padding,
  sparkline caption. Every color still comes from `:root` tokens.
- `render.js` — `decision()` composes the bilingual banner via
  `i18n.setText` (replacing the hardcoded `DECISION_TEXT`); sparkline
  `aria-label` comes from `i18n.aria`.
- `app.js` — `SETUP_ERRORS` strings become i18n keys; `showSetupState` and
  `setSubmitting` render via `i18n.setText`; `init()` runs `i18n.apply()`.
- `tests/i18n.test.mjs` — new; vm-based tests for the i18n object and table
  consistency.
- `tests/ui-polish.test.mjs` — new; static checks over `styles.css` and
  `index.html` (tokens only, motion rules, focus rings, a11y wiring).
- `tests/render.test.mjs`, `tests/location.test.mjs`,
  `tests/conditions.test.mjs`, `tests/refresh-errors.test.mjs`,
  `tests/sparkline.test.mjs` — updated: fake documents gain `createElement`
  + `append`, the new element ids, and i18n-aware assertions.

## Testing approach

- `i18n.js`: vm + fake `document` (`getElementById`/`createElement`,
  elements that record children). Assert bilingual `setText`, placeholder,
  `aria`, `apply()` coverage, and that every key has non-empty distinct
  en/ru text.
- Static CSS checks: no hex color outside `:root`; every `var(--token)`
  used is defined; no `animation`/`transition` outside the reduced-motion
  media block; exactly one keyframe; clamp-based banner/metric type;
  focus-visible selectors.
- Static HTML checks: `lang="en"`, `tabindex` × 4, `aria-describedby`
  wiring, `role="alert"` × 2, `role="status"`, `aria-live="polite"`, and
  `i18n.js` loading before `render.js`/`app.js`.
- Updated vm tests assert bilingual text via the recorded child spans
  (cross-realm objects → field-by-field assertions, per repo conventions).

## Verify when done

- [ ] `node --test tests/api.test.mjs tests/calc.test.mjs tests/location.test.mjs tests/render.test.mjs tests/conditions.test.mjs tests/sparkline.test.mjs tests/refresh-errors.test.mjs tests/i18n.test.mjs tests/ui-polish.test.mjs` passes (green).
- [ ] The card is legible at 360px and 1280px; controls never overflow.
- [ ] No hardcoded hex values outside `:root`; no animation beyond the
      reduced-motion-gated NO-GO pulse.
- [ ] Hovering or focusing a metric tile reveals its explanation.
- [ ] Every user-facing string shows English + Russian; no browser console
      errors.
