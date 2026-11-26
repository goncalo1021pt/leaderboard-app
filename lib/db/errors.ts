/**
 * The thing asked for does not exist — or exists in a league the actor is not
 * in. The two are deliberately indistinguishable, so a stranger cannot probe
 * for which league ids are real.
 */
export class NotFoundError extends Error {
  constructor(message = "Not found") {
    super(message);
    this.name = "NotFoundError";
  }
}

/** The actor is in the league but lacks the role this needs. */
export class ForbiddenError extends Error {
  constructor(message = "Not allowed") {
    super(message);
    this.name = "ForbiddenError";
  }
}
