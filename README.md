# Leaderboard

A mobile-first web app where a group of friends records the games they play together and keeps league standings.

One person — the **scorekeeper** — records a game on their phone, optionally round by round while playing, then publishes it. Published games feed the league standings.

Games are pluggable:

- **Result-only** games (Catan, Dune, bowling, anything you define yourself) just need the final scores.
- **Round-based** games (King, Sueca, Espadinha, Cospe) get a dedicated module with live round-by-round scoring.

Both kinds produce the same `Result[]` output, so the league layer never depends on a specific game.

## Status

Pre-scaffold. The design is settled in [handout.md](handout.md); the application code does not exist yet.

Build order and progress live in [§10 of the handout](handout.md#10-mvp-build-order).

## Stack

| Layer         | Choice                                                    |
| ------------- | --------------------------------------------------------- |
| Framework     | Next.js (App Router), TypeScript strict                   |
| Styling       | Tailwind CSS                                              |
| Validation    | Zod                                                       |
| Client state  | Zustand, persisted to localStorage / IndexedDB            |
| Database/Auth | Supabase (Postgres, Auth, Row Level Security)             |
| Testing       | Vitest (engine + lib), Playwright (smoke flows)           |
| PWA           | Serwist                                                   |
| Hosting       | TBD                                                       |
| Package mgr   | pnpm                                                      |

## Getting started

Requires Node 20+, pnpm, and Docker (for local Supabase).

```bash
make install     # install dependencies
make db-start    # start local Supabase
make db-reset    # run migrations + seed
make dev         # http://localhost:3000
```

Copy `.env.example` to `.env.local` and fill in the Supabase URL and anon key printed by `make db-start`.

Run `make` to see every available target.

## Development workflow

`main` is protected: no direct pushes, no self-merging without a passing build.

```bash
git switch -c <short-branch-name>
# ... work, committing as you go
make check                      # lint + typecheck + test
git push -u origin HEAD
gh pr create
```

CI runs `make check` on every pull request. A PR needs a green build before it can merge.

See [CONTRIBUTING.md](CONTRIBUTING.md) for conventions — commit granularity, testing expectations, and the rules the engine code has to follow.

## Project structure

```
/app                 Next.js App Router pages
/components          shared UI (mobile-first primitives)
/lib
  /games             game engine: types, registry, replay, one folder per module
  /standings         computeStandings — consumes Result[] only
  /db                Supabase clients, queries, generated types
  /store             Zustand store for the in-progress game
/supabase
  /migrations        SQL, one file per change
  seed.sql           built-in game presets
/tests
```

Adding a game means creating `lib/games/<id>/` and adding one line to the registry. Nothing else changes.

## Documentation

- [handout.md](handout.md) — full design: concepts, module interface, schema, flows, and the reasoning behind each decision.
- [CONTRIBUTING.md](CONTRIBUTING.md) — how to work in this repo.
