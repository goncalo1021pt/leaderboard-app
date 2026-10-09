import { generic } from "./generic/module";
import type { GameModule } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any --
 * The one place §12 allows `any`. A registry holding modules with different
 * Config/State/Action triples cannot be typed without erasing them; callers
 * recover the concrete types from the module they looked up.
 */
export type AnyGameModule = GameModule<any, any, any>;
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Every playable game module. Adding a game means adding one entry here and
 * one folder under lib/games (handout §3.4).
 */
export const modules = {
  generic,
} satisfies Record<string, AnyGameModule>;

export type ModuleId = keyof typeof modules;

/**
 * Looked up through a Map rather than by property access. `id` arrives as an
 * arbitrary string from games.module_id, and `modules["constructor"]` would
 * otherwise hand back something off Object.prototype instead of throwing.
 */
const byId = new Map<string, AnyGameModule>(Object.entries(modules));

export function getModule(id: string): AnyGameModule {
  const found = byId.get(id);
  if (found === undefined) {
    throw new Error(`Unknown game module: ${id}`);
  }
  return found;
}
