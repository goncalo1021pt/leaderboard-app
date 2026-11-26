import { asc, eq, isNull, or, sql } from "drizzle-orm";

import { type Actor, requireMember } from "./access";
import { getDb } from "./client";
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
