# Unit 10: Deploy & Docs

## Goal

Finish the project as a recruiter-ready static site: a root `README.md` that
lets a stranger run, test, and deploy the app; a `netlify.toml` that serves
the repo root as-is; an invariants audit proving the code still honors every
rule in `architecture.md`; and a check of all five success criteria in
`project-overview.md`.

## Design

- **`README.md` (root)** — what the app does, the stack, the project layout,
  the decision thresholds, and three copy-paste paths: run locally, run the
  tests, and deploy to Netlify (git-connected and drag-and-drop).
- **`netlify.toml`** — a static config. There is no build step, so the only
  thing Netlify needs is `publish = "."` (the repo root holds `index.html`).
- **`.gitignore`** — keep the Python `.venv/` and editor folders out of git
  so a git-connected Netlify deploy stays clean and small.
- **Invariants audit** — walk the nine invariants in `architecture.md` and
  state, for each, where the code satisfies it. Documentation of a verified
  pass, not new behavior.
- **Success criteria check** — map the five criteria in `project-overview.md`
  to the code/tests that prove each one, flagging the single item that needs
  a real Netlify account (criterion 5, the actual deploy).

## Files

- `README.md` — new (root).
- `netlify.toml` — new.
- `.gitignore` — fill in (currently empty).
- `architecture.md` — refresh the file-layout tree to match the real,
  root-level script layout (it still sketches a `js/` folder).
- `progress-tracker.md` — mark Unit 10 complete; resolve the open question
  about Netlify deploy mechanics.

## Verify when done

- [ ] `README.md` lets a stranger run, test, and deploy the app without
  reading any other file.
- [ ] `netlify.toml` sets `publish = "."` and nothing else (no build step).
- [ ] The invariants audit confirms all nine `architecture.md` invariants.
- [ ] All five success criteria are demonstrably true (the Netlify deploy
  itself is the one manual step, documented in `README.md`).
- [ ] The full suite is green (`node --test` over all ten test files).
