-- ─────────────────────────────────────────────────────────────────
--  Bloom · to-do archiving + priority
--  Tasks can now be archived (leave the board, keep their details)
--  and carry a priority of low / medium / high. Existing rows default
--  to not-archived and medium priority.
-- ─────────────────────────────────────────────────────────────────

ALTER TABLE todos ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE todos ADD COLUMN IF NOT EXISTS importance VARCHAR(10) NOT NULL DEFAULT 'medium';
