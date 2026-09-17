# Leaderboard App — Project Handout

Handout for a Claude Code session. Read fully before writing code. Decisions below are settled unless marked **Open**.

---

## 1. What we're building

A mobile-first website where a group of friends records the games they play together and keeps league standings. One person (the **scorekeeper**) records a game on their phone, optionally round by round while playing, then publishes it. Published games feed league standings.

Games are pluggable. Some are **result-only** (enter final scores at the end: Catan, Dune, bowling, any user-defined game). Some are **round-based** (a dedicated module with live round-by-round scoring: King, Sueca, Espadinha, Cospe). Both kinds produce the same output for the league layer.

### Goals
- Recording a game on a phone must be fast and one-thumb friendly.
- Adding support for a new game must touch only one folder plus a registry line.
- League standings must be independent of any specific game.
- Work with poor connectivity mid-game (in-progress game lives locally, syncs on publish).

### Non-goals (for now)
- Native iOS/Android apps. This is a web app / PWA only.
- Real-time multi-device scoring in the MVP (v2).
- Social features, chat, notifications.
- Rules enforcement beyond score validation (we don't referee the game, we score it).

---

## 2. Core concepts

**User ≠ Player.** This is the central modelling decision.

- **User** — an account. Can log in, own leagues, record games.
- **Player** — a person who appears in games. Belongs to a league. May be linked to a User, or may be a **guest** created by the scorekeeper (someone without an account). Guests can be claimed later by a User (v2).
- **League** — a group of Players plus settings. Games are recorded inside a league.
- **Season** — optional time window inside a league. Standings are computed per season (v2; MVP has one implicit "all time" season).
- **GamePreset** — a named, playable game: either a built-in preset (King, Catan, Bowling…) or a user-defined custom preset. Every preset points at exactly one **GameModule** and carries a `config` for it.
- **GameModule** — the code that knows how a game is scored. Built-in only, lives in the repo. The `generic` module handles all result-only games.
- **Game** — one played session: league, preset, players, scorekeeper, action log, status (`in_progress` → `published`).
- **Standing** — derived. Never the source of truth; recomputed from published games.

Principle: **a game only gets a dedicated module if entering it round by round is actually useful mid-game.** Otherwise it's a preset on `generic`. Bowling is a good example — the alley already shows the frames; we only want the final pins.

---

## 3. Game module system

### 3.1 Interface

Modules are pure TypeScript, framework-free, and unit-tested. The UI parts are React components that consume the pure parts.

```ts
export type PlayerId = string;

export interface Result {
  playerId: PlayerId;
  score: number;
  placement: number;      // 1 = winner; ties share the same placement
}

export interface GameModule<Config, State, Action> {
  id: string;             // "generic", "king", "sueca", ...
  name: string;
  players: { min: number; max: number };
  version: number;        // bump when reduce/scores semantics change

  defaultConfig: Config;
  configSchema: ZodSchema<Config>;
  actionSchema: ZodSchema<Action>;

  init(config: Config, playerIds: PlayerId[]): State;
  reduce(state: State, action: Action): State;   // pure; throw on invalid action
  scores(state: State): Record<PlayerId, number>; // running totals
  isComplete(state: State): boolean;
  results(state: State): Result[];               // only valid when isComplete

  ui: {
    ActionInput: React.ComponentType<{ state: State; config: Config; onAction: (a: Action) => void }>;
    Scoreboard?: React.ComponentType<{ state: State; config: Config }>; // optional; default scoreboard uses scores()
    ConfigForm?: React.ComponentType<{ value: Config; onChange: (c: Config) => void }>;
  };
}
```

### 3.2 Action log is the source of truth

A `Game` stores `config`, `playerIds`, and `actions: Action[]`. State and scores are always derived by replaying:

```ts
const state = actions.reduce(module.reduce, module.init(config, playerIds));
```

Consequences:
- **Undo** = remove the last action.
- **Bug fixes in a module** apply retroactively by replaying.
- **Validation on publish** = replay server-side, check `isComplete`, store `results`.
- Store `moduleId` and `moduleVersion` on each Game. If a module's semantics change, either keep old versions replayable or migrate the log.

### 3.3 The `generic` module

Reference implementation and the module behind every result-only game.

- `config`: `{ scoreLabel: string; higherIsBetter: boolean; fields?: {key, label, type}[] }`
- `action`: `{ type: "setResults"; entries: { playerId, score }[] }` (only one action ever)
- `isComplete` = one `setResults` action recorded
- `results` = sort by score according to `higherIsBetter`, assign placements with ties

Built-in presets on `generic` (seed data): Catan (victory points, higher wins), Dune (victory points), Bowling (pins). Users create their own presets on `generic` from the UI.

### 3.4 Registry

```ts
// lib/games/registry.ts
export const modules = { generic, king /* , sueca, ... */ } as const;
export function getModule(id: string): GameModule<any, any, any>;
```

Adding a game = create `lib/games/<id>/{module.ts, module.test.ts, ui.tsx}` and add one line here.

### 3.5 Planned modules

| Game       | Shape       | Module    | Notes                                              |
|------------|-------------|-----------|----------------------------------------------------|
| Custom     | result-only | generic   | user-defined preset                                |
| Catan      | result-only | generic   | built-in preset                                    |
| Dune       | result-only | generic   | built-in preset                                    |
| Bowling    | result-only | generic   | built-in preset, final pins only                   |
| King       | round-based | king      | first real module; rules to be provided            |
| Sueca      | round-based | sueca     | team game (2v2) — module must support team scoring |
| Espadinha  | round-based | espadinha | rules to be provided                               |
| Cospe      | round-based | cospe     | rules to be provided                               |

Note on **teams**: Sueca is played in pairs. Keep `Result` per player, but let a module's config define teams (`teams: PlayerId[][]`) and give teammates identical scores/placements. Don't design a separate team system.

---

## 4. Standings

The league layer only ever consumes `Result[]` from published games.

Per league setting `scoringMethod` (**MVP ships with `table` only; others are v2**):

- `table` — games played, wins, total placement points. Placement points for N players: winner gets N-1, last gets 0, ties share. Sort by placement points, then wins.
- `elo` (v2) — per league per preset; multiplayer Elo where each pair of players is a virtual head-to-head.
- `points` (v2) — sum of raw scores; only sensible for some games.

Standings are computed per `(league, season, preset)` and also as a league-wide aggregate. Compute on read for the MVP (the numbers are small); cache in a table later if needed.

---

## 5. Stack

Deliberately boring and well-documented.

| Layer          | Choice                                              |
|----------------|-----------------------------------------------------|
| Framework      | Next.js (App Router), TypeScript strict             |
| Styling        | Tailwind CSS                                        |
| Validation     | Zod (module schemas, form inputs, API boundaries)   |
| Client state   | Zustand (in-progress game), persisted to localStorage / IndexedDB |
| Database/Auth  | Supabase, self-hosted (Postgres, Auth, Row Level Security) |
| DB access      | Supabase JS client + generated types; SQL migrations in repo |
| Testing        | Vitest (engine + lib), Playwright for a couple of smoke flows |
| PWA            | Serwist (or next-pwa) — manifest, icons, offline shell |
| Hosting        | Self-hosted: Docker Compose on a homelab, exposed via Cloudflare Tunnel |
| Package mgr    | pnpm                                                |

Auth: Supabase magic link (email) for the MVP. Add Google OAuth later.

**Self-hosting note.** The Supabase stack is trimmed to what this app uses: `db`, `auth`
(GoTrue), `rest` (PostgREST), `kong`, `meta` and `studio`. Dropped: `storage`, `imgproxy`,
`functions`, `analytics`, `vector` and `supavisor` — none are used. `realtime` is dropped
too and gets added back when the v2 spectator link needs it.

Self-hosted GoTrue has no built-in email sender, so **magic links require an external SMTP
provider** (Resend, Postmark, Mailgun…). This is a hard prerequisite for step 5 — without
it nobody can log in.

---

## 6. Folder layout

```
/app
  /(auth)            login, callback
  /(app)
    /leagues/[id]    standings, games, players, settings
    /games/new       choose preset + players
    /games/[id]      live scoring (in_progress) or summary (published)
  /api               route handlers where needed (publish validation)
/components          shared UI (mobile-first primitives, scoreboard, player picker)
/lib
  /games
    types.ts         GameModule, Result, PlayerId
    registry.ts
    replay.ts        replay(actions) helper
    /generic
    /king
  /standings         computeStandings(results, method)
  /db                supabase client (server + browser), queries, generated types
  /store             zustand store for in-progress game
/supabase
  /migrations        SQL, one file per change
  seed.sql           built-in presets
/tests
```

---

## 7. Database schema (initial)

Postgres via Supabase migrations. `id` columns are UUIDs. All tables have `created_at`.

```
users            (managed by Supabase auth; profile table below)
profiles         id (= auth uid), display_name
leagues          id, name, owner_id, invite_code, scoring_method, settings jsonb
league_members   league_id, user_id, role ('owner'|'member')
players          id, league_id, display_name, user_id nullable   -- guest if null
seasons          id, league_id, name, starts_at, ends_at nullable  -- v2, table can exist from day one
game_presets     id, league_id nullable (null = built-in), name, module_id, config jsonb
games            id, league_id, season_id nullable, preset_id, module_id, module_version,
                 recorded_by, status ('in_progress'|'published'), config jsonb,
                 player_ids uuid[], actions jsonb, played_at, published_at
game_results     game_id, player_id, score, placement   -- written on publish
```

- `games.actions` is the log (section 3.2). `game_results` is the denormalised output for fast standings queries.
- In-progress games live client-side first; they may also be saved to `games` with `status='in_progress'` as a backup. Publish is a single transaction: validate by replay, write `game_results`, flip status.
- Published games are immutable in the MVP. Corrections (v2): unpublish → edit → republish, owner-only, audit logged.

### Row Level Security
- A user can read a league and everything inside it if they are in `league_members`.
- Only league members can insert games in that league; only the scorekeeper (or owner) can update an in-progress game.
- Built-in presets (`league_id is null`) are readable by everyone.
- Joining by invite code goes through a server route (service role) so the code can't be enumerated.

---

## 8. Key flows

1. **Create league** → name → invite code generated → owner added as member and as a Player.
2. **Join league** → paste code → user added as member → asked to link to an existing guest Player or create a new Player.
3. **Add player** → name only (guest). Later linkable.
4. **Record game** → pick preset → pick players (from league) → optional config tweaks → live screen.
   - Round-based: `ActionInput` at bottom, running scoreboard on top, undo button, state persisted locally after every action.
   - Result-only: single form with one score per player.
5. **Publish** → replay + validate server-side → results stored → redirect to game summary → standings updated.
6. **Standings** → league page: table per preset + overall; tap a game for its summary.

Mobile-first: design the live scoring screen for one thumb, portrait, ~390px wide. Everything else is normal responsive layout.

---

## 9. Architecture decisions (and why)

| Decision | Rationale |
|---|---|
| Web/PWA, no native | Zero store overhead; users are a friend group. Engine and data layer stay portable if native is ever wanted. |
| User ≠ Player | One scorekeeper records for everyone; most participants won't have accounts at first. |
| Action log as source of truth | Undo, retroactive fixes, server validation by replay, look-ahead scoring all fall out for free. |
| `generic` module + presets | "Supported vs custom" becomes a data distinction, not a code one. Most games never need a module. |
| Standings consume `Result[]` only | League code never depends on a game. Adding a game can't break standings. |
| Scoring method per league | Groups disagree on fairness; make it a setting with a sane default. |
| Supabase + RLS | Auth and multi-tenant access control without writing a backend. |
| Compute standings on read | Data volume is tiny; avoid cache invalidation until measured. |
| Zod schemas on modules | Config and actions are validated at the boundary and typed in one place. |
| Self-hosted on a homelab, not Vercel | Hardware and a domain already exist. Removes the managed free tier's 7-day pause, which would otherwise take the app down mid-game-night after a quiet week. |
| Trimmed Supabase over plain Postgres | RLS keeps authorization in the database, so a missing filter in app code can't leak one league's data to another. Six containers instead of ten keeps the footprint honest. |
| Cloudflare Tunnel | No open ports and no dynamic DNS; TLS terminates at the edge. The app and the Supabase gateway each get a hostname — the browser talks to Supabase directly, so it must be publicly reachable. |
| One environment, not prod + staging | Local dev runs the same Docker stack, so migrations are exercised against a real Supabase before they reach the homelab. A second always-on stack would earn little. |
| Dev entirely in Docker | No Node on the host; the dev container is the same image lineage as production, so "works locally" means something. |

---

## 10. MVP build order

Work in this order; each step should leave the app runnable and tests green.

1. **Scaffold** — Next.js + TS strict + Tailwind + Vitest + pnpm. Supabase project, env vars, generated types script.
2. **Engine core** — `lib/games/types.ts`, `replay.ts`, `registry.ts`. `generic` module with full unit tests (ties, higher/lower is better).
3. **Standings** — `computeStandings` with `table` method, unit tests (ties, mixed player counts).
4. **DB** — migrations for section 7, RLS policies, seed built-in presets. Smoke test policies with two test users.
5. **Auth + leagues** — magic link login, create league, join by invite code, add guest players.
6. **Record & publish a generic game** — preset picker, player picker, result form, publish route with server-side replay, game summary page.
7. **Standings page** — per preset + overall.
8. **In-progress game store** — Zustand persisted locally; resume an unfinished game after reload.
9. **First round-based module** — King (rules to be supplied). `ActionInput` + scoreboard + undo. Full unit tests against known hand results.
10. **PWA** — manifest, icons, offline shell, install prompt.
11. **Polish** — empty states, loading, error boundaries, mobile QA on a real phone.

---

## 11. v2 backlog

- Seasons (start/end, reset standings)
- Elo and points scoring methods
- Claim a guest Player; merge Player histories
- Result confirmation by linked players
- Live spectator link for an in-progress game (Supabase Realtime)
- Per-player stats: win rate, average placement, head-to-head
- Corrections to published games with audit log
- More modules: Sueca, Espadinha, Cospe
- Google OAuth
- Export league data (CSV/JSON)

---

## 12. Conventions for the coding session

- TypeScript strict; no `any` outside `registry.ts`'s erased generics.
- Engine code (`lib/games`, `lib/standings`) must have no React or Supabase imports.
- Every module ships with tests. Round-based modules must include at least one full-game fixture with expected final results.
- One SQL migration per change; never edit a migration that has been applied.
- Validate all external input with Zod at route handlers and form submits.
- Mobile-first: build the live scoring screen at 390px first, then widen.
- Commit per build-order step, with a short message naming the step.
- Prefer small, composable components over page-level monoliths.
- Don't add libraries beyond the stack table without noting why.

---

## 13. Open questions

- **King rules** — exact variant (players, hand list, points per hand, house rules). Needed before step 9.
- **Ties in `table` placement points** — share the average of the tied positions (proposed) vs. all get the higher value.
- **Multiple games of the same preset on one night** — just multiple `games` rows (proposed); no "session" grouping for now.
- **Player display in mixed leagues** — show the Player's league name or the linked User's profile name? Proposed: Player name, editable per league.