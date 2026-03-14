-- supabase/migrations/004_rag_vector.sql
-- Sistema RAG: pgvector + tabela de chunks + função de busca semântica
-- Requer: extensão vector (pgvector) disponível no Supabase por padrão

-- 1. Habilitar extensão pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Tabela de chunks do material Al Brooks
CREATE TABLE IF NOT EXISTS rag_chunks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content     TEXT NOT NULL,
  embedding   vector(768),           -- nomic-embed-text: 768 dimensões
  source      TEXT NOT NULL DEFAULT '', -- caminho relativo do arquivo
  module      TEXT NOT NULL DEFAULT '', -- ex: "1 - Analise de Graficos (08-11)"
  lesson      TEXT NOT NULL DEFAULT '', -- ex: "10A"
  chunk_index INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Índice IVFFlat para busca por similaridade de cosseno (rápido)
-- Criado após ingestão dos dados para eficiência
CREATE INDEX IF NOT EXISTS idx_rag_chunks_embedding
  ON rag_chunks USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 50);

-- 4. Função de busca semântica por similaridade
CREATE OR REPLACE FUNCTION match_rag_chunks(
  query_embedding vector(768),
  match_threshold FLOAT DEFAULT 0.5,
  match_count     INT   DEFAULT 5
)
RETURNS TABLE (
  id         UUID,
  content    TEXT,
  source     TEXT,
  module     TEXT,
  lesson     TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.id,
    r.content,
    r.source,
    r.module,
    r.lesson,
    1 - (r.embedding <=> query_embedding) AS similarity
  FROM rag_chunks r
  WHERE r.embedding IS NOT NULL
    AND 1 - (r.embedding <=> query_embedding) > match_threshold
  ORDER BY r.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 5. Permissões para o role anon (projeto sem autenticação)
GRANT EXECUTE ON FUNCTION match_rag_chunks TO anon;
GRANT ALL ON TABLE rag_chunks TO anon;
ALTER TABLE rag_chunks DISABLE ROW LEVEL SECURITY;
