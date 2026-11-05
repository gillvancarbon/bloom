-- ─────────────────────────────────────────────────────────────────
--  Bloom · repeating tasks + checklists
--  Tasks can repeat (none / daily / weekly / monthly) and carry a
--  small inline checklist stored as JSON. Existing rows default to a
--  one-off task with no steps.
-- ─────────────────────────────────────────────────────────────────

ALTER TABLE todos ADD COLUMN IF NOT EXISTS recurrence VARCHAR(10) NOT NULL DEFAULT 'none';
ALTER TABLE todos ADD COLUMN IF NOT EXISTS subtasks TEXT;
