-- Existing records have no device metadata and remain in the overall ranking.
ALTER TABLE rounds ADD COLUMN device TEXT NOT NULL DEFAULT 'unknown';
CREATE TABLE device_scores (
  player_id TEXT NOT NULL,
  device TEXT NOT NULL CHECK(device IN ('mobile', 'pc')),
  nickname TEXT NOT NULL,
  score INTEGER NOT NULL,
  hits INTEGER NOT NULL,
  max_combo INTEGER NOT NULL,
  achieved_at INTEGER NOT NULL,
  PRIMARY KEY(player_id, device)
);
CREATE INDEX device_scores_order ON device_scores(device, score DESC, achieved_at ASC, player_id);
