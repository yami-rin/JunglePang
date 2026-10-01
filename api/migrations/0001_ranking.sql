CREATE TABLE players (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  nickname TEXT NOT NULL DEFAULT '名無しのパング',
  score INTEGER NOT NULL DEFAULT 0,
  hits INTEGER NOT NULL DEFAULT 0,
  max_combo INTEGER NOT NULL DEFAULT 0,
  achieved_at INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX players_order ON players(score DESC, achieved_at ASC, id);
CREATE TABLE rounds (
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL,
  seed INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  consumed TEXT,
  score INTEGER
);
CREATE INDEX rounds_expiry ON rounds(created_at);
CREATE TABLE rate_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at INTEGER NOT NULL);
CREATE INDEX limits_expiry ON rate_limits(expires_at);
