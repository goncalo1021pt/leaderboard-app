# Leaderboard

A mobile-first web app where a group of friends records the games they play together and keeps league standings.

One person — the **scorekeeper** — records a game on their phone, optionally round by round while playing, then publishes it. Published games feed the league standings.

Games are pluggable:

- **Result-only** games (Catan, Dune, bowling, anything you define yourself) just need the final scores.
- **Round-based** games (King, Sueca, Espadinha, Cospe) get a dedicated module with live round-by-round scoring.

Both kinds produce the same `Result[]` output, so the league layer never depends on a specific game.

## Status

Step 1 of the [build order](handout.md#10-mvp-build-order) is done: the app scaffold, the
Docker toolchain and CI are in place. The game engine (step 2) is next.

The design is settled in [handout.md](handout.md).

## Stack

| Layer         | Choice                                                    |
| ------------- | --------------------------------------------------------- |
| Framework     | Next.js (App Router), TypeScript strict                   |
| Styling       | Tailwind CSS                                              |
| Validation    | Zod                                                       |
| Client state  | Zustand, persisted to localStorage / IndexedDB            |
| Database/Auth | Supabase, self-hosted (Postgres, Auth, Row Level Security) |
| Testing       | Vitest (engine + lib); Playwright later, for smoke flows   |
| PWA           | Serwist                                                   |
| Hosting       | Docker Compose on a homelab, via Cloudflare Tunnel         |
| Package mgr   | pnpm                                                      |

## Getting started

**Docker is the only prerequisite.** There is no Node on the host — the app, its toolchain and
Supabase all run in containers.

```bash
cp .env.example .env    # nothing needs filling in yet
make up                 # build the image, install dependencies, start the app
```

The app is then on http://localhost:3000, with hot reload. Supabase joins the stack at
build-order step 4.

```bash
make check              # format, lint, types, tests — what CI runs
make shell              # a shell inside the container
make down               # stop
```

Run `make` to see every target. Anything you would normally run with pnpm goes through the
Makefile, which runs it inside the container. Dependencies are installed into `./node_modules`
on the host as your own user, so your editor's TypeScript server works without Node installed.

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
