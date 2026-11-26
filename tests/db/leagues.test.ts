import { describe, expect, it } from "vitest";
import { ZodError } from "zod";

import { requireOwner } from "@/lib/db/access";
import { getDb } from "@/lib/db/client";
import { ForbiddenError, NotFoundError } from "@/lib/db/errors";
import { INVITE_CODE_LENGTH } from "@/lib/db/invite-code";
import {
  createLeague,
  getLeague,
  joinLeagueByCode,
  listMyLeagues,
} from "@/lib/db/leagues";
import { addGuestPlayer, listPlayers } from "@/lib/db/players";
import { listPresets } from "@/lib/db/presets";

import { createUser } from "./helpers";

describe("createLeague", () => {
  it("makes the creator owner, member and player in one go", async () => {
    const ana = await createUser("Ana");
    const league = await createLeague(ana, { name: "  Friday nights  " });

    expect(league.name).toBe("Friday nights");
    expect(league.role).toBe("owner");
    expect(league.scoringMethod).toBe("table");
    expect(league.inviteCode).toHaveLength(INVITE_CODE_LENGTH);

    await expect(requireOwner(getDb(), ana, league.id)).resolves.toBeUndefined();
    expect(await listPlayers(ana, league.id)).toEqual([
      { id: expect.any(String), displayName: "Ana", userId: ana.userId },
    ]);
  });

  it("rejects a blank name before touching the database", async () => {
    const ana = await createUser("Ana");
    await expect(createLeague(ana, { name: "   " })).rejects.toBeInstanceOf(ZodError);
    expect(await listMyLeagues(ana)).toEqual([]);
  });
});

describe("the league boundary, with two users", () => {
  async function twoStrangers() {
    const ana = await createUser("Ana");
    const bruno = await createUser("Bruno");
    const anas = await createLeague(ana, { name: "Ana's table" });
    const brunos = await createLeague(bruno, { name: "Bruno's table" });
    return { ana, bruno, anas, brunos };
  }

  it("lists only your own leagues", async () => {
    const { ana, bruno, anas, brunos } = await twoStrangers();
    expect((await listMyLeagues(ana)).map((l) => l.id)).toEqual([anas.id]);
    expect((await listMyLeagues(bruno)).map((l) => l.id)).toEqual([brunos.id]);
  });

  it("hides another league entirely, as if it did not exist", async () => {
    const { bruno, anas } = await twoStrangers();

    await expect(getLeague(bruno, anas.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(listPlayers(bruno, anas.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(listPresets(bruno, anas.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      addGuestPlayer(bruno, anas.id, { displayName: "Intruder" }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("gives the same answer for a league that really does not exist", async () => {
    const { bruno } = await twoStrangers();
    const missing = "6a3e9f0c-1b2d-4c5e-8f70-9a1b2c3d4e5f";

    await expect(getLeague(bruno, missing)).rejects.toThrow("League not found");
    // Not a UUID at all: must not reach Postgres and come back as a 500.
    await expect(getLeague(bruno, "not-a-uuid")).rejects.toThrow("League not found");
  });

  it("does not leak an intruder's write into the league", async () => {
    const { ana, bruno, anas } = await twoStrangers();
    await addGuestPlayer(bruno, anas.id, { displayName: "Intruder" }).catch(() => {});
    expect((await listPlayers(ana, anas.id)).map((p) => p.displayName)).toEqual(["Ana"]);
  });
});

describe("joinLeagueByCode", () => {
  it("lets someone with the code in as a member, not an owner", async () => {
    const ana = await createUser("Ana");
    const bruno = await createUser("Bruno");
    const league = await createLeague(ana, { name: "Cards" });

    // Typed sloppily, the way people actually type codes from a phone.
    const typed = `${league.inviteCode.slice(0, 5).toLowerCase()}-${league.inviteCode.slice(5)}`;
    expect(await joinLeagueByCode(bruno, typed)).toEqual({
      leagueId: league.id,
      alreadyMember: false,
    });

    expect((await getLeague(bruno, league.id)).role).toBe("member");
    await expect(requireOwner(getDb(), bruno, league.id)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it("is harmless to repeat", async () => {
    const ana = await createUser("Ana");
    const league = await createLeague(ana, { name: "Cards" });
    expect(await joinLeagueByCode(ana, league.inviteCode)).toEqual({
      leagueId: league.id,
      alreadyMember: true,
    });
    // Still the owner: re-joining must not demote anyone.
    expect((await getLeague(ana, league.id)).role).toBe("owner");
  });

  it("rejects a code that matches no league", async () => {
    const bruno = await createUser("Bruno");
    await expect(joinLeagueByCode(bruno, "0000000000")).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});

describe("players", () => {
  it("adds guests without an account, and validates the name", async () => {
    const ana = await createUser("Ana");
    const league = await createLeague(ana, { name: "Board games" });

    const guest = await addGuestPlayer(ana, league.id, { displayName: " Rita " });
    expect(guest).toEqual({ id: expect.any(String), displayName: "Rita", userId: null });

    await expect(
      addGuestPlayer(ana, league.id, { displayName: "" }),
    ).rejects.toBeInstanceOf(ZodError);
    expect((await listPlayers(ana, league.id)).map((p) => p.displayName)).toEqual([
      "Ana",
      "Rita",
    ]);
  });
});
