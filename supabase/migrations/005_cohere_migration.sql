-- supabase/migrations/005_cohere_migration.sql
-- Migra embeddings Gemini (768 dims) → Cohere embed-multilingual-v3.0 (1024 dims)

-- 1. Remove índice antigo
DROP INDEX IF EXISTS idx_rag_chunks_embedding;

-- 2. Remove função antiga (qualquer variação de assinatura)
DROP FUNCTION IF EXISTS match_rag_chunks(vector, float, int);
DROP FUNCTION IF EXISTS match_rag_chunks(vector(768), float, int);

-- 3. Limpa dados incompatíveis
DELETE FROM rag_chunks;

-- 4. Recria coluna embedding com 1024 dimensões (Cohere embed-multilingual-v3.0)
ALTER TABLE rag_chunks DROP COLUMN IF EXISTS embedding;
ALTER TABLE rag_chunks ADD COLUMN embedding vector(1024);

-- 5. Recria função de busca semântica com nova dimensão
CREATE OR REPLACE FUNCTION match_rag_chunks(
  query_embedding vector(1024),
  match_threshold FLOAT DEFAULT 0.3,
  match_count     INT   DEFAULT 8
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

-- 6. Cria índice HNSW (funciona com tabela vazia, ao contrário do IVFFlat)
CREATE INDEX IF NOT EXISTS idx_rag_chunks_embedding
  ON rag_chunks USING hnsw (embedding vector_cosine_ops);

-- 7. Permissões
GRANT EXECUTE ON FUNCTION match_rag_chunks TO anon;
GRANT ALL ON TABLE rag_chunks TO anon;
ALTER TABLE rag_chunks DISABLE ROW LEVEL SECURITY;
