-- Adiciona campos de timer e notas às sessões de estudo
ALTER TABLE study_sessions
  ADD COLUMN IF NOT EXISTS elapsed_seconds INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS timer_state TEXT NOT NULL DEFAULT 'stopped',
  ADD COLUMN IF NOT EXISTS timer_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS notes TEXT NOT NULL DEFAULT '';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'chk_timer_state'
  ) THEN
    ALTER TABLE study_sessions
      ADD CONSTRAINT chk_timer_state CHECK (timer_state IN ('playing', 'paused', 'stopped'));
  END IF;
END$$;
