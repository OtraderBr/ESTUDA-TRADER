-- Motor Brooks v3 — Tabelas de progresso, notas, avaliações e sessões
-- Aplicar via Supabase MCP: apply_migration com project_id jebbklacmrxrhbajweug

-- 1. Progresso por conceito (substitui localStorage brooks_progress_v4)
CREATE TABLE IF NOT EXISTS user_concept_progress (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conceito_name      TEXT NOT NULL UNIQUE,
  abc_category       TEXT NOT NULL DEFAULT 'C'
                       CHECK (abc_category IN ('A','B','C')),
  macro_category     TEXT NOT NULL DEFAULT 'Fundamento',
  importance         TEXT DEFAULT 'Média'
                       CHECK (importance IN ('Baixa','Média','Alta')),
  mastery_percentage INT NOT NULL DEFAULT 0
                       CHECK (mastery_percentage BETWEEN 0 AND 100),
  last_studied_at    TIMESTAMPTZ,
  next_review_at     TIMESTAMPTZ,
  sm2_ease_factor    FLOAT NOT NULL DEFAULT 2.5,
  sm2_interval       INT NOT NULL DEFAULT 1,
  sm2_repetitions    INT NOT NULL DEFAULT 0,
  tags               TEXT[] NOT NULL DEFAULT '{}',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ucp_next_review ON user_concept_progress(next_review_at);
CREATE INDEX IF NOT EXISTS idx_ucp_tags ON user_concept_progress USING gin(tags);

-- 2. Notas ricas por conceito (substitui notesList no localStorage)
CREATE TABLE IF NOT EXISTS concept_notes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conceito_name  TEXT NOT NULL,
  type           TEXT NOT NULL DEFAULT 'Anotação'
                   CHECK (type IN (
                     'Descrição',
                     'Anotação',
                     'Dúvida',
                     'Pergunta',
                     'Questionamento',
                     'Observação de Tela'
                   )),
  content_html   TEXT NOT NULL DEFAULT '',
  content_text   TEXT NOT NULL DEFAULT '',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Garante que cada conceito tenha no máximo uma nota do tipo 'Descrição'
CREATE UNIQUE INDEX IF NOT EXISTS idx_notes_descricao_unique
  ON concept_notes(conceito_name)
  WHERE type = 'Descrição';

CREATE INDEX IF NOT EXISTS idx_notes_conceito ON concept_notes(conceito_name);
CREATE INDEX IF NOT EXISTS idx_notes_fts ON concept_notes
  USING gin(to_tsvector('portuguese', content_text));

-- 3. Avaliações (substitui evaluations no localStorage)
-- self_score = autoavaliação Técnica de Feynman (0-100), substitui quizScore
CREATE TABLE IF NOT EXISTS concept_evaluations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conceito_name    TEXT NOT NULL,
  flashcard_score  INT NOT NULL CHECK (flashcard_score BETWEEN 0 AND 100),
  self_score       INT NOT NULL CHECK (self_score BETWEEN 0 AND 100),
  explanation      TEXT NOT NULL,
  mastery_at_time  INT NOT NULL,
  sm2_quality      INT NOT NULL CHECK (sm2_quality BETWEEN 0 AND 5),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_evals_conceito ON concept_evaluations(conceito_name);
CREATE INDEX IF NOT EXISTS idx_evals_date ON concept_evaluations(created_at DESC);

-- 4. Sessões de estudo (substitui brooks_sessions_v1)
CREATE TABLE IF NOT EXISTS study_sessions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title          TEXT NOT NULL,
  type           TEXT NOT NULL DEFAULT 'Estudo'
                   CHECK (type IN ('Estudo','Revisão','Prática')),
  scheduled_date DATE NOT NULL,
  completed_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS session_concepts (
  session_id    UUID NOT NULL REFERENCES study_sessions(id) ON DELETE CASCADE,
  conceito_name TEXT NOT NULL,
  PRIMARY KEY (session_id, conceito_name)
);

-- 5. Desabilitar RLS (projeto single-user, acesso via anon key)
ALTER TABLE user_concept_progress DISABLE ROW LEVEL SECURITY;
ALTER TABLE concept_notes DISABLE ROW LEVEL SECURITY;
ALTER TABLE concept_evaluations DISABLE ROW LEVEL SECURITY;
ALTER TABLE study_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE session_concepts DISABLE ROW LEVEL SECURITY;
