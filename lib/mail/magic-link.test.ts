import { describe, expect, it } from "vitest";

import { magicLinkMessage } from "./magic-link";

describe("magicLinkMessage", () => {
  it("puts the link in both parts and says how long it lasts", () => {
    const url =
      "http://localhost:3000/api/auth/magic-link/verify?token=abc&callbackURL=%2F";
    const message = magicLinkMessage(url);
    expect(message.text).toContain(url);
    expect(message.text).toContain("15 minutes");
    // & must be escaped inside the href or some clients truncate the link.
    expect(message.html).toContain("verify?token=abc&amp;callbackURL=%2F");
  });

  it("can't be broken out of by a hostile URL", () => {
    const message = magicLinkMessage('https://x.test/"><script>alert(1)</script>');
    expect(message.html).not.toContain("<script>");
  });
});
