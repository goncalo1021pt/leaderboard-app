/** 1st, 2nd, 3rd, 4th … 11th, 12th, 13th … 21st, 22nd, 101st, 111th. */
export function ordinal(n: number): string {
  const suffixes = ["th", "st", "nd", "rd"];
  const lastTwo = n % 100;
  return `${n}${suffixes[(lastTwo - 20) % 10] ?? suffixes[lastTwo] ?? "th"}`;
}
