/**
 * An action that cannot be applied to the state it was given: out of turn,
 * already recorded, naming a player who is not in the game, malformed.
 */
export class GameRuleError extends Error {
  constructor(message: string) {
    super(message);
    // Extending Error through TypeScript's downlevel output loses the name.
    this.name = "GameRuleError";
  }
}

/** A game set up with players a module cannot accept. */
export class GameSetupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GameSetupError";
  }
}
