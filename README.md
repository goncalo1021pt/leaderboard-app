# Leaderboard

A mobile-first web app where a group of friends records the games they play together and keeps league standings.

One person — the **scorekeeper** — records a game on their phone, optionally round by round while playing, then publishes it. Published games feed the league standings.

Games are pluggable:

- **Result-only** games (Catan, Dune, bowling, anything you define yourself) just need the final scores.
- **Round-based** games (King, Sueca, Espadinha, Cospe) get a dedicated module with live round-by-round scoring.

Both kinds produce the same `Result[]` output, so the league layer never depends on a specific game.

## Status

Steps 1–6 of the [build order](handout.md#10-mvp-build-order) are done: the scaffold and
Docker toolchain, the game engine with the `generic` module, standings with the `table`
method, the database with its data-access layer, sign-in with leagues (magic-link login,
invites by code or link, guests, claiming a guest), and recording result-only games: pick
a game type or define your own, enter scores, publish, see the game summary. The standings
page (step 7) is next.

The design is settled in [handout.md](handout.md).

## Stack

| Layer         | Choice                                                    |
| ------------- | --------------------------------------------------------- |
| Framework     | Next.js (App Router), TypeScript strict                   |
| Styling       | Tailwind CSS                                              |
| Validation    | Zod                                                       |
| Client state  | Zustand, persisted to localStorage / IndexedDB            |
| Database      | PostgreSQL, self-hosted                                   |
| DB access     | Drizzle ORM (postgres.js), migrations via drizzle-kit     |
| Auth          | Better Auth, magic link                                    |
| Testing       | Vitest (engine + lib); Playwright later, for smoke flows   |
| PWA           | Serwist                                                   |
| Hosting       | Docker Compose on a homelab, via Cloudflare Tunnel         |
| Package mgr   | pnpm                                                      |

## Getting started

**Docker is the only prerequisite.** There is no Node on the host — the app, its toolchain and
Postgres all run in containers.

```bash
cp .env.example .env    # nothing needs filling in yet
make up                 # build the image, install dependencies, start the app
```

The app is then on http://localhost:3000, with hot reload. Postgres runs next to it, and
the app applies any pending migrations when it starts.

To sign in, enter any email address: the magic link lands in **Mailpit**, a local inbox at
http://localhost:8025. Nothing is really sent.

```bash
make check              # format, lint, types, tests — what CI runs
make shell              # a shell inside the container
make db-psql            # psql on the dev database
make down               # stop (the database volume is kept)
```

From the host, a GUI client can reach the dev database on `localhost:5433`
(user, password and database all `leaderboard`).

### Changing the schema

Edit `lib/db/schema/`, then `make db-generate NAME=what_changed` to write the migration into
`drizzle/`. Commit both. For hand-written SQL (data changes, seeds), `make db-migration
NAME=…` gives you an empty migration to fill in. CI fails if the schema and migrations
disagree.

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
  /db                Drizzle schema, client, and the data-access layer (all authorization)
  /store             Zustand store for the in-progress game
/drizzle             SQL migrations, one per change; built-in presets are seeded here
/tests
  /db                integration tests against a real Postgres
```

Adding a game means creating `lib/games/<id>/` and adding one line to the registry. Nothing else changes.

## Documentation

- [handout.md](handout.md) — full design: concepts, module interface, schema, flows, and the reasoning behind each decision.
- [CONTRIBUTING.md](CONTRIBUTING.md) — how to work in this repo.
