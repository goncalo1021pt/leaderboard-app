/**
 * Crockford's base32: no I, L, O or U, so a code read aloud across the table
 * cannot be mistyped as a different valid code.
 */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** 10 characters × 5 bits = 50 bits: far beyond guessing (handout §7). */
export const INVITE_CODE_LENGTH = 10;

export function generateInviteCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(INVITE_CODE_LENGTH));
  // 256 is a multiple of 32, so masking the low five bits is unbiased.
  return Array.from(bytes, (byte) => ALPHABET[byte & 31]).join("");
}

/**
 * What a person typed into what we stored. Case and separators are ignored,
 * and the letters Crockford excludes map to the digits they resemble.
 */
export function normalizeInviteCode(input: string): string {
  return input
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "")
    .replace(/[IL]/g, "1")
    .replace(/O/g, "0");
}
