import { and, desc, eq, inArray, isNull, or } from "drizzle-orm";
import { z } from "zod";

import { GameRuleError } from "@/lib/games/errors";
import { getModule } from "@/lib/games/registry";
import { replayStoredGame } from "@/lib/games/replay";

import { type Actor, requireMember } from "./access";
import { getDb } from "./client";
import { NotFoundError } from "./errors";
import { idSchema } from "./inputs";
import { gamePresets, gameResults, games, players, users } from "./schema";

export interface PublishInput {
  /**
   * Chosen by the client before it submits, so a double tap or a retry on a
   * flaky connection publishes the game once, not twice.
   */
  gameId: string;
  leagueId: string;
  presetId: string;
  /** Seating order. */
  playerIds: string[];
  /** The module's action log; for result-only games, one setResults action. */
  actions: unknown[];
  playedAt?: Date;
}

const publishSchema = z.object({
  gameId: idSchema,
  leagueId: idSchema,
  presetId: idSchema,
  playerIds: z.array(idSchema).min(1),
  actions: z.array(z.unknown()),
  playedAt: z.date().optional(),
});

/**
 * Handout §8, flow 5: validate by replaying the action log on the server, then
 * store the game and its results in one transaction. Nothing the client says
 * about scores or placements is trusted; they are recomputed here from the
 * log, by the same module code the client ran.
 *
 * Throws GameSetupError / GameRuleError (from the engine) or ZodError when the
 * game itself is invalid, NotFoundError when the league, preset or a player is
 * out of reach. Returns the game id, which is input.gameId.
 */
export async function publishGame(actor: Actor, input: PublishInput): Promise<string> {
  const data = publishSchema.parse(input);
  const db = getDb();
  await requireMember(db, actor, data.leagueId);

  return db.transaction(async (tx) => {
    // Idempotency: this id already published by this person means a retry.
    const [existing] = await tx
      .select({ leagueId: games.leagueId, recordedBy: games.recordedBy })
      .from(games)
      .where(eq(games.id, data.gameId));
    if (existing !== undefined) {
      if (existing.recordedBy === actor.userId && existing.leagueId === data.leagueId) {
        return data.gameId;
      }
      throw new NotFoundError("Game not found");
    }

    const [preset] = await tx
      .select()
      .from(gamePresets)
      .where(
        and(
          eq(gamePresets.id, data.presetId),
          or(isNull(gamePresets.leagueId), eq(gamePresets.leagueId, data.leagueId)),
        ),
      );
    if (preset === undefined)
      throw new NotFoundError("That game type isn't available here");

    const found = await tx
      .select({ id: players.id })
      .from(players)
      .where(
        and(eq(players.leagueId, data.leagueId), inArray(players.id, data.playerIds)),
      );
    if (found.length !== new Set(data.playerIds).size) {
      throw new NotFoundError("Some of those players aren't in this league");
    }

    const gameModule = getModule(preset.moduleId);
    const state = replayStoredGame(gameModule, {
      config: preset.config,
      playerIds: data.playerIds,
      actions: data.actions,
    });
    if (!gameModule.isComplete(state)) {
      throw new GameRuleError("This game isn't finished yet");
    }
    const results = gameModule.results(state);

    const publishedAt = new Date();
    await tx.insert(games).values({
      id: data.gameId,
      leagueId: data.leagueId,
      presetId: preset.id,
      moduleId: gameModule.id,
      moduleVersion: gameModule.version,
      recordedBy: actor.userId,
      status: "published",
      config: preset.config,
      playerIds: data.playerIds,
      actions: data.actions,
      playedAt: data.playedAt ?? publishedAt,
      publishedAt,
    });
    await tx.insert(gameResults).values(
      results.map((result) => ({
        gameId: data.gameId,
        leagueId: data.leagueId,
        playerId: result.playerId,
        score: result.score,
        placement: result.placement,
      })),
    );
    return data.gameId;
  });
}

export interface GameSummary {
  id: string;
  leagueId: string;
  presetName: string;
  scoreLabel: string;
  playedAt: Date;
  recordedByName: string;
  results: { playerId: string; displayName: string; score: number; placement: number }[];
}

/** One published game, for its summary page. */
export async function getGame(actor: Actor, gameId: string): Promise<GameSummary> {
  if (!idSchema.safeParse(gameId).success) throw new NotFoundError("Game not found");
  const db = getDb();
  const [game] = await db
    .select({
      id: games.id,
      leagueId: games.leagueId,
      status: games.status,
      config: games.config,
      playedAt: games.playedAt,
      presetName: gamePresets.name,
      recordedByName: users.name,
    })
    .from(games)
    .innerJoin(gamePresets, eq(gamePresets.id, games.presetId))
    .innerJoin(users, eq(users.id, games.recordedBy))
    .where(eq(games.id, gameId));
  // A game in someone else's league is "not found", same as for leagues.
  if (game === undefined || game.status !== "published")
    throw new NotFoundError("Game not found");
  try {
    await requireMember(db, actor, game.leagueId);
  } catch (error) {
    if (error instanceof NotFoundError) throw new NotFoundError("Game not found");
    throw error;
  }

  const results = await db
    .select({
      playerId: gameResults.playerId,
      displayName: players.displayName,
      score: gameResults.score,
      placement: gameResults.placement,
    })
    .from(gameResults)
    .innerJoin(players, eq(players.id, gameResults.playerId))
    .where(eq(gameResults.gameId, gameId))
    .orderBy(gameResults.placement, players.displayName);

  return {
    id: game.id,
    leagueId: game.leagueId,
    presetName: game.presetName,
    scoreLabel: scoreLabelOf(game.config),
    playedAt: game.playedAt,
    recordedByName: game.recordedByName,
    results,
  };
}

export interface GameListItem {
  id: string;
  presetName: string;
  playedAt: Date;
  /** Everyone sharing first place. */
  winners: string[];
  playerCount: number;
}

/** A league's published games, most recently played first. */
export async function listGames(
  actor: Actor,
  leagueId: string,
  options: { limit?: number } = {},
): Promise<GameListItem[]> {
  const db = getDb();
  await requireMember(db, actor, leagueId);
  const rows = await db
    .select({ id: games.id, presetName: gamePresets.name, playedAt: games.playedAt })
    .from(games)
    .innerJoin(gamePresets, eq(gamePresets.id, games.presetId))
    .where(and(eq(games.leagueId, leagueId), eq(games.status, "published")))
    .orderBy(desc(games.playedAt), desc(games.createdAt))
    .limit(options.limit ?? 20);
  if (rows.length === 0) return [];

  const results = await db
    .select({
      gameId: gameResults.gameId,
      placement: gameResults.placement,
      displayName: players.displayName,
    })
    .from(gameResults)
    .innerJoin(players, eq(players.id, gameResults.playerId))
    .where(
      inArray(
        gameResults.gameId,
        rows.map((r) => r.id),
      ),
    );

  return rows.map((row) => {
    const mine = results.filter((r) => r.gameId === row.id);
    return {
      ...row,
      winners: mine
        .filter((r) => r.placement === 1)
        .map((r) => r.displayName)
        .sort(),
      playerCount: mine.length,
    };
  });
}

function scoreLabelOf(config: unknown): string {
  const label = (config as { scoreLabel?: unknown } | null)?.scoreLabel;
  return typeof label === "string" && label !== "" ? label : "Score";
}
