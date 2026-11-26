import { describe, expect, it } from "vitest";

import { getDb } from "@/lib/db/client";
import { createLeague } from "@/lib/db/leagues";
import { listPresets } from "@/lib/db/presets";
import { gamePresets } from "@/lib/db/schema";
import { getModule } from "@/lib/games/registry";

import { createUser } from "./helpers";

describe("built-in presets", () => {
  it("are seeded, and every league sees them", async () => {
    const ana = await createUser("Ana");
    const league = await createLeague(ana, { name: "Board games" });

    const presets = await listPresets(ana, league.id);
    expect(presets.filter((p) => p.builtIn).map((p) => p.name)).toEqual([
      "Bowling",
      "Catan",
      "Dune",
    ]);
  });

  it("each carry a config their module accepts", async () => {
    // Seed SQL is hand-written jsonb; this is what keeps it honest.
    const rows = await getDb().select().from(gamePresets);
    const builtIns = rows.filter((row) => row.leagueId === null);
    expect(builtIns.length).toBeGreaterThan(0);
    for (const preset of builtIns) {
      expect(() =>
        getModule(preset.moduleId).configSchema.parse(preset.config),
      ).not.toThrow();
    }
  });
});

describe("league presets", () => {
  it("are visible to their own league only, after the built-ins", async () => {
    const ana = await createUser("Ana");
    const bruno = await createUser("Bruno");
    const anas = await createLeague(ana, { name: "Ana's" });
    const brunos = await createLeague(bruno, { name: "Bruno's" });

    await getDb()
      .insert(gamePresets)
      .values({
        leagueId: anas.id,
        name: "Darts",
        moduleId: "generic",
        config: { scoreLabel: "Points", higherIsBetter: false },
      });

    const forAna = await listPresets(ana, anas.id);
    expect(forAna.at(-1)).toMatchObject({ name: "Darts", builtIn: false });
    expect((await listPresets(bruno, brunos.id)).some((p) => p.name === "Darts")).toBe(
      false,
    );
  });
});
