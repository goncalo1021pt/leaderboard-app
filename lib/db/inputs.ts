import { z } from "zod";

/* Everything a person types that reaches the database is parsed here first. */

const name = (what: string) =>
  z
    .string()
    .trim()
    .min(1, `${what} can't be empty`)
    .max(60, `${what} can be at most 60 characters`);

export const leagueNameSchema = name("League name");
export const displayNameSchema = name("Name");

export const idSchema = z.uuid();
