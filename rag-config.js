// rag-config.js — Configuração do sistema RAG (Retrieval-Augmented Generation)
//
// PRÉ-REQUISITOS (gratuitos e locais):
//   1. Instalar Ollama: https://ollama.com
//   2. Baixar modelos:
//        ollama pull nomic-embed-text   (para gerar embeddings)
//        ollama pull llama3.2           (para responder perguntas)
//   3. Manter Ollama rodando em segundo plano

module.exports = {
  // ─── Supabase (mesmo projeto já configurado) ───────────────────────────────
  supabaseUrl: 'https://jebbklacmrxrhbajweug.supabase.co',
  supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImplYmJrbGFjbXJ4cmhiYWp3ZXVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyMzgwOTcsImV4cCI6MjA4ODgxNDA5N30.-41Xg5zhF2hHiTJ3BUoT3TiL5LYwkhwzKfUUhTTUJks',

  // ─── Ollama (rodando localmente) ───────────────────────────────────────────
  ollamaUrl:       'http://localhost:11434',
  embeddingModel:  'nomic-embed-text', // 768 dims — ollama pull nomic-embed-text
  chatModel:       'llama3.2',         // ollama pull llama3.2

  // ─── Material de estudo ────────────────────────────────────────────────────
  materialPath: './MATERIAL AL BROOKS/CURSO AL BROOK',

  // ─── Chunking de texto ─────────────────────────────────────────────────────
  chunkSize:    1500, // caracteres por chunk
  chunkOverlap: 200,  // sobreposição entre chunks consecutivos
};
