-- Built-in presets (handout §3.3). Seeded by a migration rather than a seed
-- script because they are reference data: production needs them as much as
-- dev does, exactly once.
--
-- Fixed ids so later migrations can refer to a preset, and so a game recorded
-- against "Catan" points at the same row on every machine. league_id is null:
-- built-ins belong to no league and every league can use them. Each config
-- must parse with lib/games/generic's configSchema; a test checks that.
INSERT INTO "game_presets" ("id", "league_id", "name", "module_id", "config") VALUES
  ('00000000-0000-4000-8000-000000000001', NULL, 'Catan',   'generic', '{"scoreLabel": "Victory points", "higherIsBetter": true}'),
  ('00000000-0000-4000-8000-000000000002', NULL, 'Dune',    'generic', '{"scoreLabel": "Victory points", "higherIsBetter": true}'),
  ('00000000-0000-4000-8000-000000000003', NULL, 'Bowling', 'generic', '{"scoreLabel": "Pins", "higherIsBetter": true}');
