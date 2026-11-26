import { sql } from "drizzle-orm";
import {
  check,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { users } from "./auth";

/* The domain tables of handout §7. */

export const scoringMethod = pgEnum("scoring_method", ["table", "elo", "points"]);
export const memberRole = pgEnum("member_role", ["owner", "member"]);
export const gameStatus = pgEnum("game_status", ["in_progress", "published"]);

const createdAt = timestamp({ withTimezone: true }).notNull().defaultNow();

export const leagues = pgTable("leagues", {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull(),
  // Restrict: an owner's account cannot vanish from under their league.
  ownerId: text()
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  inviteCode: text().notNull().unique(),
  scoringMethod: scoringMethod().notNull().default("table"),
  settings: jsonb().$type<Record<string, unknown>>().notNull().default({}),
  createdAt,
});

export const leagueMembers = pgTable(
  "league_members",
  {
    leagueId: uuid()
      .notNull()
      .references(() => leagues.id, { onDelete: "cascade" }),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: memberRole().notNull().default("member"),
    createdAt,
  },
  (t) => [
    primaryKey({ columns: [t.leagueId, t.userId] }),
    // "Which leagues am I in" is the query every page starts with.
    index().on(t.userId),
  ],
);

/** A person who appears in games. No user_id means a guest (handout §2). */
export const players = pgTable(
  "players",
  {
    id: uuid().primaryKey().defaultRandom(),
    leagueId: uuid()
      .notNull()
      .references(() => leagues.id, { onDelete: "cascade" }),
    displayName: text().notNull(),
    userId: text().references(() => users.id, { onDelete: "set null" }),
    createdAt,
  },
  (t) => [
    index().on(t.leagueId),
    // A user is at most one player per league. Guests (null) are unlimited,
    // which Postgres gives us for free: nulls are distinct by default.
    uniqueIndex().on(t.leagueId, t.userId),
  ],
);

/** v2. The table exists from day one so games can reference it later. */
export const seasons = pgTable(
  "seasons",
  {
    id: uuid().primaryKey().defaultRandom(),
    leagueId: uuid()
      .notNull()
      .references(() => leagues.id, { onDelete: "cascade" }),
    name: text().notNull(),
    startsAt: timestamp({ withTimezone: true }).notNull(),
    endsAt: timestamp({ withTimezone: true }),
    createdAt,
  },
  (t) => [
    index().on(t.leagueId),
    check(
      "seasons_ends_after_start",
      sql`${t.endsAt} is null or ${t.endsAt} > ${t.startsAt}`,
    ),
  ],
);

export const gamePresets = pgTable(
  "game_presets",
  {
    id: uuid().primaryKey().defaultRandom(),
    /** Null for built-in presets, which every league can use. */
    leagueId: uuid().references(() => leagues.id, { onDelete: "cascade" }),
    name: text().notNull(),
    moduleId: text().notNull(),
    /** Validated against the module's configSchema before it is written. */
    config: jsonb().notNull(),
    createdAt,
  },
  (t) => [
    index().on(t.leagueId),
    // NULLS NOT DISTINCT so two built-ins can't share a name either.
    unique("game_presets_league_name").on(t.leagueId, t.name).nullsNotDistinct(),
  ],
);

export const games = pgTable(
  "games",
  {
    id: uuid().primaryKey().defaultRandom(),
    leagueId: uuid()
      .notNull()
      .references(() => leagues.id, { onDelete: "cascade" }),
    seasonId: uuid().references(() => seasons.id, { onDelete: "set null" }),
    presetId: uuid()
      .notNull()
      .references(() => gamePresets.id, { onDelete: "restrict" }),
    /** Copied from the preset so a game replays even if the preset changes. */
    moduleId: text().notNull(),
    moduleVersion: integer().notNull(),
    /** The scorekeeper. */
    recordedBy: text()
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    status: gameStatus().notNull().default("in_progress"),
    config: jsonb().notNull(),
    /**
     * Seating order, which round-based modules care about. Postgres cannot put
     * a foreign key on array elements; the data-access layer checks every id
     * belongs to the league, and game_results enforces it once published.
     */
    playerIds: uuid().array().notNull(),
    /** The action log: the only source of truth for the game (handout §3.2). */
    actions: jsonb().$type<unknown[]>().notNull().default([]),
    playedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    publishedAt: timestamp({ withTimezone: true }),
    createdAt,
  },
  (t) => [
    index().on(t.leagueId, t.status),
    check(
      "games_published_at_matches_status",
      sql`(${t.status} = 'published') = (${t.publishedAt} is not null)`,
    ),
    check("games_has_players", sql`cardinality(${t.playerIds}) > 0`),
  ],
);

/** Written once, on publish. Standings read this, never the action log. */
export const gameResults = pgTable(
  "game_results",
  {
    gameId: uuid()
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    playerId: uuid()
      .notNull()
      .references(() => players.id, { onDelete: "restrict" }),
    score: doublePrecision().notNull(),
    placement: integer().notNull(),
    createdAt,
  },
  (t) => [
    primaryKey({ columns: [t.gameId, t.playerId] }),
    index().on(t.playerId),
    check("game_results_placement_positive", sql`${t.placement} >= 1`),
  ],
);
