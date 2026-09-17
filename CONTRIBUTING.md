# Contributing

## Branching and merging

`main` is protected. It cannot be pushed to directly, and it cannot be force-pushed or deleted.

Every change goes through a pull request:

```bash
git switch -c <short-branch-name>
# ... work
make check
git push -u origin HEAD
gh pr create --fill
```

A PR merges when CI is green and the branch is up to date with `main`. Squash merge is the default; the PR title becomes the commit message, so write it as one.

## Commits

- One commit per meaningful unit of work. During the MVP that usually means one commit per [build-order step](handout.md#10-mvp-build-order), with the step named in the message.
- Present tense, no ceremony: `add generic module with tie handling`, not `Added stuff`.
- Never rewrite published history on `main`.

## Code conventions

These come from [§12 of the handout](handout.md#12-conventions-for-the-coding-session) and are enforced in review:

- **TypeScript strict.** No `any` outside the erased generics in `lib/games/registry.ts`.
- **The engine is pure.** `lib/games` and `lib/standings` import no React and no Supabase. They are plain TypeScript that runs equally well in a route handler, a test, or the browser. Module UI lives in a separate `ui.tsx` that the engine itself never imports.
- **Every module ships with tests.** Round-based modules need at least one full-game fixture with expected final results.
- **One SQL migration per change.** Never edit a migration that has already been applied — write a new one.
- **Validate external input with Zod** at route handlers and form submits. Anything crossing a trust boundary gets parsed, not cast.
- **Mobile-first.** Build the live scoring screen at 390px wide first, then widen.
- **Small, composable components** over page-level monoliths.
- **Don't add libraries** beyond the [stack table](README.md#stack) without saying why in the PR description.

## Adding a game

1. Decide whether it needs a module at all. A game only gets one if entering it round by round is genuinely useful *during* play. Otherwise it is a preset on the `generic` module — a data change, not a code change.
2. If it does need one: create `lib/games/<id>/` containing `module.ts`, `module.test.ts`, and `ui.tsx`.
3. Add a single line to `lib/games/registry.ts`.

Nothing outside that folder and that line should need to change. If it does, the module interface is wrong — fix the interface rather than working around it.

## Tests

```bash
make test         # unit tests, once
make test-watch   # unit tests, watching
make test-e2e     # Playwright smoke flows
make check        # lint + typecheck + test — what CI runs
```

Engine code (`lib/games`, `lib/standings`) is where test coverage actually matters: it is pure, fast to test, and every scoring bug lives there. Cover ties, minimum and maximum player counts, and both directions of `higherIsBetter`.
