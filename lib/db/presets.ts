import { and, asc, eq, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";

import { genericConfigSchema } from "@/lib/games/generic/module";

import { type Actor, requireMember } from "./access";
import { getDb } from "./client";
import { ForbiddenError, isUniqueViolation } from "./errors";
import { displayNameSchema } from "./inputs";
import { gamePresets } from "./schema";

export interface Preset {
  id: string;
  name: string;
  moduleId: string;
  /** Raw jsonb. Parse with the module's configSchema before trusting it. */
  config: unknown;
  builtIn: boolean;
}

/** Built-in presets plus the league's own, built-ins first. */
export async function listPresets(actor: Actor, leagueId: string): Promise<Preset[]> {
  const db = getDb();
  await requireMember(db, actor, leagueId);
  const builtIn = sql<boolean>`${gamePresets.leagueId} is null`;
  return db
    .select({
      id: gamePresets.id,
      name: gamePresets.name,
      moduleId: gamePresets.moduleId,
      config: gamePresets.config,
      builtIn,
    })
    .from(gamePresets)
    .where(or(isNull(gamePresets.leagueId), eq(gamePresets.leagueId, leagueId)))
    .orderBy(sql`${builtIn} desc`, asc(gamePresets.name));
}

const customPresetSchema = z.object({
  name: displayNameSchema,
  scoreLabel: z.string().trim().min(1, "Say what the score counts").max(30),
  higherIsBetter: z.boolean(),
});

/**
 * A league's own result-only game type: Darts, Mölkky, anything (handout
 * §3.3). Always on the generic module; a game that wants round-by-round
 * scoring needs a module in code, not a preset. Any member may add one.
 */
export async function createPreset(
  actor: Actor,
  leagueId: string,
  input: { name: string; scoreLabel: string; higherIsBetter: boolean },
): Promise<Preset> {
  const { name, scoreLabel, higherIsBetter } = customPresetSchema.parse(input);
  const config = genericConfigSchema.parse({ scoreLabel, higherIsBetter });
  const db = getDb();
  await requireMember(db, actor, leagueId);

  // Same name as a built-in would put two "Catan"s in the picker.
  const [clash] = await db
    .select({ id: gamePresets.id })
    .from(gamePresets)
    .where(
      and(
        sql`lower(${gamePresets.name}) = lower(${name})`,
        or(isNull(gamePresets.leagueId), eq(gamePresets.leagueId, leagueId)),
      ),
    );
  if (clash !== undefined)
    throw new ForbiddenError(`There's already a game called ${name}`);

  try {
    const [preset] = await db
      .insert(gamePresets)
      .values({ leagueId, name, moduleId: "generic", config })
      .returning();
    if (preset === undefined) throw new Error("insert returned nothing");
    return { id: preset.id, name, moduleId: "generic", config, builtIn: false };
  } catch (error) {
    if (isUniqueViolation(error, "game_presets_league_name")) {
      throw new ForbiddenError(`There's already a game called ${name}`);
    }
    throw error;
  }
}

/** One preset, if this league can use it. */
export async function getPreset(
  actor: Actor,
  leagueId: string,
  presetId: string,
): Promise<Preset | null> {
  const db = getDb();
  await requireMember(db, actor, leagueId);
  if (!z.uuid().safeParse(presetId).success) return null;
  const [row] = await db
    .select()
    .from(gamePresets)
    .where(
      and(
        eq(gamePresets.id, presetId),
        or(isNull(gamePresets.leagueId), eq(gamePresets.leagueId, leagueId)),
      ),
    );
  if (row === undefined) return null;
  return {
    id: row.id,
    name: row.name,
    moduleId: row.moduleId,
    config: row.config,
    builtIn: row.leagueId === null,
  };
}
