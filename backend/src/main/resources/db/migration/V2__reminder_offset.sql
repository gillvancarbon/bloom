-- ─────────────────────────────────────────────────────────────────
--  Bloom · reminders as an offset before the deadline
--  Habits now store `reminder_offset` (minutes before the daily
--  deadline) instead of the fixed `reminder_time` clock time. The old
--  column is left in place so this migration is non-destructive.
-- ─────────────────────────────────────────────────────────────────

ALTER TABLE habits ADD COLUMN IF NOT EXISTS reminder_offset INTEGER;

-- Backfill from the legacy "HH:mm" time, relative to the habit's deadline.
-- Values are left for the app to snap to the nearest preset on read.
UPDATE habits
SET reminder_offset =
      (CAST(SUBSTRING(deadline, 1, 2) AS INTEGER) * 60 + CAST(SUBSTRING(deadline, 4, 2) AS INTEGER))
    - (CAST(SUBSTRING(reminder_time, 1, 2) AS INTEGER) * 60 + CAST(SUBSTRING(reminder_time, 4, 2) AS INTEGER))
WHERE reminder_offset IS NULL
  AND reminder_time IS NOT NULL
  AND deadline IS NOT NULL
  AND LENGTH(reminder_time) = 5
  AND LENGTH(deadline) = 5;
