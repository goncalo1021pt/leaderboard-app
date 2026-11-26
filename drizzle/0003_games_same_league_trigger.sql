-- Keeps everything a game points at inside the game's own league. Foreign keys
-- can't express these rules:
--   * preset_id may be a built-in (league_id null) or one of this league's
--     presets, never another league's;
--   * season_id, when set, must be one of this league's seasons;
--   * player_ids is an array, which Postgres can't put a foreign key on: every
--     element must be a player of this league, with no repeats.
-- With authorization in app code rather than RLS, this is the database-level
-- backstop if a data-access function ever forgets to check.

CREATE FUNCTION games_same_league() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM game_presets
    WHERE id = NEW.preset_id
      AND (league_id IS NULL OR league_id = NEW.league_id)
  ) THEN
    RAISE EXCEPTION 'preset % is not available in league %', NEW.preset_id, NEW.league_id
      USING ERRCODE = 'foreign_key_violation', CONSTRAINT = 'games_preset_same_league';
  END IF;

  IF NEW.season_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM seasons WHERE id = NEW.season_id AND league_id = NEW.league_id
  ) THEN
    RAISE EXCEPTION 'season % is not in league %', NEW.season_id, NEW.league_id
      USING ERRCODE = 'foreign_key_violation', CONSTRAINT = 'games_season_same_league';
  END IF;

  IF cardinality(NEW.player_ids) <> (SELECT count(DISTINCT p) FROM unnest(NEW.player_ids) AS p) THEN
    RAISE EXCEPTION 'a player appears twice in game %', NEW.id
      USING ERRCODE = 'check_violation', CONSTRAINT = 'games_players_distinct';
  END IF;

  IF EXISTS (
    SELECT 1 FROM unnest(NEW.player_ids) AS p
    WHERE NOT EXISTS (SELECT 1 FROM players WHERE id = p AND league_id = NEW.league_id)
  ) THEN
    RAISE EXCEPTION 'game % names a player outside league %', NEW.id, NEW.league_id
      USING ERRCODE = 'foreign_key_violation', CONSTRAINT = 'games_players_same_league';
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER games_same_league
  BEFORE INSERT OR UPDATE OF league_id, preset_id, season_id, player_ids ON games
  FOR EACH ROW EXECUTE FUNCTION games_same_league();
