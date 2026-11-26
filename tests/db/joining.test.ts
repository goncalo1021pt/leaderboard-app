import { describe, expect, it } from "vitest";

import { ForbiddenError, NotFoundError } from "@/lib/db/errors";
import {
  createLeague,
  joinLeagueByCode,
  previewInvite,
  rotateInviteCode,
} from "@/lib/db/leagues";
import {
  addGuestPlayer,
  claimGuestPlayer,
  createOwnPlayer,
  listPlayers,
  myPlayer,
} from "@/lib/db/players";

import { createUser } from "./helpers";

async function leagueAndNewcomer() {
  const ana = await createUser("Ana");
  const bruno = await createUser("Bruno");
  const league = await createLeague(ana, { name: "Cards" });
  await joinLeagueByCode(bruno, league.inviteCode);
  return { ana, bruno, league };
}

describe("rotateInviteCode", () => {
  it("retires the old code; the new one works", async () => {
    const ana = await createUser("Ana");
    const carla = await createUser("Carla");
    const league = await createLeague(ana, { name: "Cards" });

    const fresh = await rotateInviteCode(ana, league.id);
    expect(fresh).not.toBe(league.inviteCode);
    await expect(joinLeagueByCode(carla, league.inviteCode)).rejects.toBeInstanceOf(
      NotFoundError,
    );
    expect((await joinLeagueByCode(carla, fresh)).leagueId).toBe(league.id);
  });

  it("is for the owner only", async () => {
    const { bruno, league } = await leagueAndNewcomer();
    await expect(rotateInviteCode(bruno, league.id)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });
});

describe("previewInvite", () => {
  it("names the league behind a code, and says whether you're in it", async () => {
    const ana = await createUser("Ana");
    const carla = await createUser("Carla");
    const league = await createLeague(ana, { name: "Cards" });

    expect(await previewInvite(carla, league.inviteCode.toLowerCase())).toEqual({
      leagueId: league.id,
      name: "Cards",
      alreadyMember: false,
    });
    expect((await previewInvite(ana, league.inviteCode))?.alreadyMember).toBe(true);
  });

  it("returns null for a code that leads nowhere", async () => {
    const carla = await createUser("Carla");
    expect(await previewInvite(carla, "ZZZZZZZZZZ")).toBeNull();
    expect(await previewInvite(carla, "--")).toBeNull();
  });
});

describe("linking yourself to a player", () => {
  it("a newcomer has no player until they pick one", async () => {
    const { bruno, league } = await leagueAndNewcomer();
    expect(await myPlayer(bruno, league.id)).toBeNull();
  });

  it("claiming a guest takes it over, games and all", async () => {
    const { ana, bruno, league } = await leagueAndNewcomer();
    const guest = await addGuestPlayer(ana, league.id, { displayName: "Bruno (guest)" });

    const claimed = await claimGuestPlayer(bruno, league.id, guest.id);
    expect(claimed).toEqual({ ...guest, userId: bruno.userId });
    expect(await myPlayer(bruno, league.id)).toEqual(claimed);
  });

  it("can't claim a guest twice, nor someone who already has an account", async () => {
    const { ana, bruno, league } = await leagueAndNewcomer();
    const carla = await createUser("Carla");
    await joinLeagueByCode(carla, league.inviteCode);
    const guest = await addGuestPlayer(ana, league.id, { displayName: "Guest" });

    await claimGuestPlayer(bruno, league.id, guest.id);
    await expect(claimGuestPlayer(carla, league.id, guest.id)).rejects.toBeInstanceOf(
      NotFoundError,
    );
    const anasPlayer = (await myPlayer(ana, league.id))!;
    await expect(
      claimGuestPlayer(carla, league.id, anasPlayer.id),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("one player per person: no second claim, no extra own player", async () => {
    const { ana, bruno, league } = await leagueAndNewcomer();
    const first = await addGuestPlayer(ana, league.id, { displayName: "One" });
    const second = await addGuestPlayer(ana, league.id, { displayName: "Two" });

    await claimGuestPlayer(bruno, league.id, first.id);
    await expect(claimGuestPlayer(bruno, league.id, second.id)).rejects.toThrow(
      "You already have a player in this league",
    );
    await expect(createOwnPlayer(bruno, league.id)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    // The failed claim left the guest untouched.
    expect(
      (await listPlayers(ana, league.id)).find((p) => p.id === second.id)?.userId,
    ).toBeNull();
  });

  it("'I'm new here' creates a player under your name", async () => {
    const { bruno, league } = await leagueAndNewcomer();
    expect(await createOwnPlayer(bruno, league.id)).toMatchObject({
      displayName: "Bruno",
      userId: bruno.userId,
    });
  });

  it("can't claim a guest from another league", async () => {
    const { bruno, league } = await leagueAndNewcomer();
    const dora = await createUser("Dora");
    const other = await createLeague(dora, { name: "Elsewhere" });
    const theirGuest = await addGuestPlayer(dora, other.id, { displayName: "Theirs" });

    await expect(
      claimGuestPlayer(bruno, league.id, theirGuest.id),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(claimGuestPlayer(bruno, other.id, theirGuest.id)).rejects.toBeInstanceOf(
      NotFoundError,
    );
    await expect(claimGuestPlayer(bruno, league.id, "not-a-uuid")).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});
