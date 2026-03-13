-- supabase/migrations/002_add_aula_curso.sql
-- Adiciona coluna aula_curso à tabela conceitos para armazenar
-- a referência precisa da aula do curso Al Brooks (ex: "12A - Ciclo de Mercado")

ALTER TABLE conceitos ADD COLUMN IF NOT EXISTS aula_curso TEXT DEFAULT '';
