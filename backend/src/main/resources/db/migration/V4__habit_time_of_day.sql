-- ─────────────────────────────────────────────────────────────────
--  Bloom · habit time of day
--  Each habit can now belong to a Morning / Afternoon / Evening group.
--  Existing rows leave this null and fall back to their deadline.
-- ─────────────────────────────────────────────────────────────────

ALTER TABLE habits ADD COLUMN IF NOT EXISTS time_of_day VARCHAR(10);
