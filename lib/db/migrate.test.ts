import { describe, expect, it } from "vitest";

import { describeError, migrateWithRetry } from "./migrate";

/** A fake clock: sleeping just moves time forward. */
function harness(failures: number) {
  let time = 0;
  let calls = 0;
  const sleeps: number[] = [];
  const options = {
    deadlineMs: 30_000,
    now: () => time,
    sleep: async (ms: number) => {
      sleeps.push(ms);
      time += ms;
    },
    log: () => {},
    run: async () => {
      calls++;
      if (calls <= failures) throw new Error(`connection refused #${calls}`);
    },
  };
  return { options, sleeps, calls: () => calls };
}

describe("migrateWithRetry", () => {
  it("returns at once when the database is ready", async () => {
    const h = harness(0);
    await migrateWithRetry("unused", h.options);
    expect(h.calls()).toBe(1);
    expect(h.sleeps).toEqual([]);
  });

  it("rides out a database that is still starting, backing off", async () => {
    const h = harness(3);
    await migrateWithRetry("unused", h.options);
    expect(h.calls()).toBe(4);
    expect(h.sleeps).toEqual([1000, 2000, 4000]);
  });

  it("caps the backoff at ten seconds", async () => {
    const h = harness(6);
    await migrateWithRetry("unused", { ...h.options, deadlineMs: 120_000 });
    expect(h.sleeps).toEqual([1000, 2000, 4000, 8000, 10_000, 10_000]);
  });

  it("gives up with the last error once the deadline would pass", async () => {
    const h = harness(Infinity);
    await expect(migrateWithRetry("unused", h.options)).rejects.toThrow(
      "connection refused #6",
    );
    // 1 + 2 + 4 + 8 + 10 = 25s slept. Another 10s would end past the 30s
    // deadline, so the sixth failure is final.
    expect(h.sleeps).toEqual([1000, 2000, 4000, 8000, 10_000]);
    expect(h.calls()).toBe(6);
  });
});

describe("describeError", () => {
  it("prefers the driver's reason over drizzle's wrapper", () => {
    const wrapped = new Error("Failed query: CREATE SCHEMA", {
      cause: new Error('password authentication failed for user "leaderboard"'),
    });
    expect(describeError(wrapped)).toBe(
      'password authentication failed for user "leaderboard"',
    );
    expect(describeError(new Error("plain"))).toBe("plain");
    expect(describeError("a string")).toBe("a string");
  });
});
