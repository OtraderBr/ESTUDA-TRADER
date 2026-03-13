-- supabase/migrations/003_free_notes.sql
-- Tabela de notas livres estilo Notion: hierárquica, suporta conteúdo Tiptap HTML

CREATE TABLE IF NOT EXISTS free_notes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title        TEXT NOT NULL DEFAULT 'Sem título',
  emoji        TEXT DEFAULT '',
  content_html TEXT NOT NULL DEFAULT '',
  content_text TEXT NOT NULL DEFAULT '',
  parent_id    UUID REFERENCES free_notes(id) ON DELETE CASCADE,
  sort_order   INT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_free_notes_parent ON free_notes(parent_id);
CREATE INDEX IF NOT EXISTS idx_free_notes_fts ON free_notes
  USING gin(to_tsvector('portuguese', content_text));

-- RLS desabilitado (projeto single-user, sem auth)
ALTER TABLE free_notes DISABLE ROW LEVEL SECURITY;
