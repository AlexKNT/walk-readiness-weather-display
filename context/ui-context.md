# UI Context

## Theme

Dark only — calm, high-contrast, "E-Ink style". Light text on a near-black
background, with color used sparingly for the single piece of information
that matters: the walk recommendation. No light mode, no gradients, no
decorative shadows, no animation beyond one optional status pulse (with a
reduced-motion opt-out). The status color of the decision banner is the
single source of truth for urgency — never decorate with additional colors.

## Colors

Define all colors as CSS custom properties on `:root`. Components must use
these tokens — no hardcoded hex values anywhere else in the CSS.

```css
:root {
  /* Neutrals */
  --bg:            #0D0F0D;  /* page background */
  --surface:       #161916;  /* card surface */
  --border:        #2B2E2A;  /* hairline separators */
  --text:          #E8EAE4;  /* primary text */
  --text-muted:    #8A8F84;  /* labels, meta */

  /* Status accents (banner + matching metric value only) */
  --green:  #4ADE80;  /* GO */
  --yellow: #FACC15;  /* CAUTION */
  --red:    #F87171;  /* NO-GO */

  /* Focus */
  --focus-ring: #E8EAE4;
}
```

Usage rules:

- Neutrals (`--bg`, `--surface`, `--border`, `--text`, `--text-muted`) make up
  ~95% of the interface.
- Status colors appear in exactly two places: the decision banner and the
  matching metric value. Nothing else is tinted.
- Text on colored accents must remain readable against `--surface`/`--bg`.

## Typography

System stack only — no webfonts, no build step, no network font request:

```css
font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
```

Numbers and status values use a monospace stack for a fixed, "instrument
panel" feel:

```css
font-family: ui-monospace, "JetBrains Mono", "Cascadia Code", Menlo, Consolas, monospace;
```

| role | size / weight | notes |
|---|---|---|
| decision banner text | clamp(2.5rem, 8vw, 4rem) / 800, monospace | the single most important line |
| metric value | clamp(1.5rem, 5vw, 2.25rem) / 700, monospace | tabular numerals |
| metric label | 0.75rem / 500, uppercase, +0.08em letter-spacing | muted |
| city / meta | 0.875rem / 400 | muted |

## Border Radius

| token | value | use |
|---|---|---|
| `--radius-sm` | 8px | buttons, inputs |
| `--radius-md` | 14px | card, metric tiles |
| `--radius-lg` | 20px | main card container |

## Layout Patterns

- **Single column, centered.** One card, `max-width: 560px`, centered with
  generous padding. No sidebar, no header chrome, one screen, one job.
- **Decision banner first.** The GO/CAUTION/NO-GO banner sits at the top of
  the card: full-width, large type, status-colored text on `--surface`.
- **Metrics grid.** A 2×2 grid of tiles below the banner: Dew Point, Heat
  Index, AQI, Temperature. Each tile is label (muted) + value (mono).
- **Sparkline.** Below the grid, a 12-hour humidity line rendered as inline
  SVG, with a subtle highlight band over the lowest-humidity window.
- **Controls row.** At the bottom: the city label and a single Refresh
  button. Settings (change city) are secondary and tucked away, not part of
  the glance path.
- **Focus states.** Every button and input gets a visible `--focus-ring`
  outline for keyboard accessibility.

## Status Banner

- **GO** — "WALK RECOMMENDED" in `--green`.
- **CAUTION** — "HIGH HUMIDITY: STAY SHADED" in `--yellow`.
- **NO-GO** — "STAY INSIDE: CARDIAC STRESS RISK" in `--red`.

The banner text is the only place the recommendation is expressed in words;
the metric values support it but never repeat it.

## Icons

No icon library. Any icon is an inline SVG, `current-color`-aware, kept
minimal and monochrome. A small status glyph (walker / caution triangle /
stop) may sit beside the banner text; it inherits the banner's status color.

## Motion

No animation in v1. The only permitted motion is a slow opacity pulse on the
NO-GO banner, gated behind `prefers-reduced-motion: no-preference`. Nothing
else moves, flashes, or transitions.

No other elements animate. Motion is reserved for the single most urgent
signal, so it never competes for attention.