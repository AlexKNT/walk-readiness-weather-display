# AI Workflow Rules

## Approach

Build this project incrementally using a spec-driven workflow. The context
files define what to build, how to build it, and the current state of
progress; `context/spec/00-build-plan.md` defines the ordered units. Each
unit is implemented from its spec, verified against its checklist, then
marked complete in `progress-tracker.md`. Always implement against these
specs — do not infer or invent behavior from scratch.

## Scoping Rules

- Work on one feature unit at a time.
- Prefer small, verifiable increments over large speculative changes.
- Do not combine unrelated system boundaries in a single step (e.g. API
  client + rules engine + SVG rendering at once).
- No runtime dependencies. Any new library or build tool is a design change
  and requires explicit approval before use.
- Build the domain core (rules/calc) before the visual layer; build the
  static shell before wiring live data.

## When to Split Work

Split an implementation step if it combines:

- Networking changes with rules or rendering changes
- Multiple unrelated UI regions
- Behavior not clearly defined in the context files or unit spec
- A new dependency together with the feature that uses it

If a change cannot be verified end to end quickly (open the page via a static
server, click through), the scope is too broad — split it.

## Handling Missing Requirements

- Do not invent product behavior not defined in the context files or the
  unit spec.
- If a requirement is ambiguous, resolve it in the relevant context file —
  or ask — before implementing.
- If a requirement is missing, add it as an open question in
  `progress-tracker.md` before continuing.
- Never silently change a locked decision (thresholds, dark-only theme,
  statelessness). Record the change in the context file first.

## Protected Files

Do not modify the following unless explicitly instructed:

- The six `context/*.md` files beyond what the current task authorizes;
  `progress-tracker.md` is updated as part of the normal workflow.
- `context/spec/00-build-plan.md` — units are added or removed deliberately,
  not rewritten mid-build.

## Keeping Docs in Sync

Update the relevant context file whenever implementation changes:

- System architecture or boundaries → `architecture.md`
- Storage model decisions → `architecture.md`
- Code conventions or standards → `code-standards.md`
- Feature scope or thresholds → `project-overview.md`
- Visual or animation decisions → `ui-context.md`

`progress-tracker.md` is updated after every meaningful implementation change.

## Before Moving to the Next Unit

1. The current unit works end to end within its defined scope.
2. No invariant defined in `architecture.md` was violated.
3. The page loads with no browser console errors (verified via a static
   server in a real browser).
4. The behavior satisfies every item in the unit's verification checklist.
5. `progress-tracker.md` reflects the completed work.