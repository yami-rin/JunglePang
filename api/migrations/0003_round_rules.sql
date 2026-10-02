-- Existing challenges keep their original unbounded sequence for replay.
ALTER TABLE rounds ADD COLUMN rules_version TEXT NOT NULL DEFAULT '2';
