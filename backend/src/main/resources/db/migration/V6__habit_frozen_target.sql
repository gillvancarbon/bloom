-- ─────────────────────────────────────────────────────────────────
--  Bloom · streak freezes + completion target
--  Habits can now protect individual days with a "freeze" and record
--  how many completions count as a full day. Existing rows default to
--  a target of 1 and no frozen days.
-- ─────────────────────────────────────────────────────────────────

ALTER TABLE habits ADD COLUMN IF NOT EXISTS target INTEGER NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS habit_frozen (
    habit_id    BIGINT NOT NULL,
    frozen_date DATE   NOT NULL,
    PRIMARY KEY (habit_id, frozen_date),
    CONSTRAINT fk_habit_frozen_habit
        FOREIGN KEY (habit_id) REFERENCES habits (id) ON DELETE CASCADE
);
