import { describe, expect, it } from "vitest";

import { generic } from "./generic/module";
import { getModule, modules } from "./registry";

describe("getModule", () => {
  it("finds a registered module", () => {
    expect(getModule("generic")).toBe(generic);
  });

  it("throws for an id nothing is registered under", () => {
    expect(() => getModule("king")).toThrow(/Unknown game module: king/);
  });

  it("throws rather than returning an inherited property", () => {
    expect(() => getModule("constructor")).toThrow();
  });
});

// These run over every registered module, so a new game gets them for free.
describe.each(Object.entries(modules))("module %s", (key, module) => {
  it("is registered under its own id", () => {
    expect(module.id).toBe(key);
  });

  it("accepts its own default config", () => {
    expect(module.configSchema.safeParse(module.defaultConfig).success).toBe(true);
  });

  it("declares a sane player range", () => {
    expect(module.players.min).toBeGreaterThanOrEqual(1);
    expect(module.players.max).toBeGreaterThanOrEqual(module.players.min);
  });

  it("declares a version that can be stored and compared", () => {
    expect(Number.isInteger(module.version)).toBe(true);
    expect(module.version).toBeGreaterThanOrEqual(1);
  });

  it("has a name worth showing a user", () => {
    expect(module.name.trim().length).toBeGreaterThan(0);
  });
});
