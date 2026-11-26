import { describe, expect, it } from "vitest";

import {
  INVITE_CODE_LENGTH,
  generateInviteCode,
  normalizeInviteCode,
} from "./invite-code";

describe("generateInviteCode", () => {
  it("uses only Crockford base32, at the full length", () => {
    for (let i = 0; i < 200; i++) {
      expect(generateInviteCode()).toMatch(
        new RegExp(`^[0-9A-HJKMNP-TV-Z]{${INVITE_CODE_LENGTH}}$`),
      );
    }
  });

  it("does not repeat itself", () => {
    const codes = new Set(Array.from({ length: 1000 }, generateInviteCode));
    expect(codes.size).toBe(1000);
  });
});

describe("normalizeInviteCode", () => {
  it("ignores case, spaces and dashes", () => {
    expect(normalizeInviteCode(" ab3d-ef7 h9k ")).toBe("AB3DEF7H9K");
  });

  it("reads look-alike letters as the digits they resemble", () => {
    expect(normalizeInviteCode("Oil0")).toBe("0110");
  });

  it("leaves a generated code unchanged", () => {
    const code = generateInviteCode();
    expect(normalizeInviteCode(code)).toBe(code);
  });
});
