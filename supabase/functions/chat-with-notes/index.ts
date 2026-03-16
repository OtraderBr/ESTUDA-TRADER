// supabase/functions/chat-with-notes/index.ts
// Motor RAG com Cohere:
//   Embedding: embed-multilingual-v3.0 (1024 dims, otimizado para PT-BR)
//   Chat:      command-r (modo RAG nativo com citações)
//
// Fluxo: query → embed → busca vetorial (pgvector) → Cohere chat com documents → resposta

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL        = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const COHERE_API_KEY      = Deno.env.get('COHERE_API_KEY') || 'YEO4tvrKQ4aTx1tohiF3DEPcA2d5JAoHRlccEWuk';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
};

const DEFAULT_PREAMBLE = `Você é o **Professor Brooks**, mentor especialista de nível mundial em Price Action baseado na metodologia de Al Brooks.

COMO RESPONDER:
1. **Base no contexto** — Responda com base nos documentos fornecidos. Se não encontrar, diga claramente.
2. **Citação de fontes** — Cite o módulo e aula quando disponível (ex: "Módulo 3, Aula 25").
3. **Didática** — Explique passo a passo como em aula particular. Use analogias e exemplos práticos.
4. **Profundidade** — Detalhe nuances, exceções e conexões entre conceitos.
5. **Formatação Markdown** — Use **negrito** para termos-chave, listas e cabeçalhos (##).
6. **Linguagem** — Português brasileiro, tom profissional e acessível.`;

// ── Gera embedding via Cohere embed-multilingual-v3.0 ────────────────────────

async function embedQuery(text: string): Promise<number[]> {
  const res = await fetch('https://api.cohere.com/v1/embed', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${COHERE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      texts: [text],
      model: 'embed-multilingual-v3.0',
      input_type: 'search_query',
      embedding_types: ['float'],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Cohere embed falhou: ${res.status} — ${err.substring(0, 300)}`);
  }

  const data = await res.json();
  return data.embeddings.float[0];
}

// ── Handler principal ────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });

  try {
    const body = await req.json();
    const { query, history = [], customPreamble } = body;

    if (!query || typeof query !== 'string' || query.trim().length < 2) {
      return new Response(JSON.stringify({ error: 'Envie uma pergunta válida (campo "query").' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // 1. Gera embedding da pergunta
    const queryEmbedding = await embedQuery(query.trim());

    // 2. Busca chunks relevantes no Supabase
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: chunks, error: rpcError } = await supabase.rpc('match_rag_chunks', {
      query_embedding: `[${queryEmbedding.join(',')}]`,
      match_threshold: 0.3,
      match_count: 8,
    });

    if (rpcError) throw new Error(`Busca vetorial falhou: ${rpcError.message}`);

    // 3. Formata documentos para o Cohere RAG
    const documents = (chunks || []).map((c: any, i: number) => ({
      id: String(i),
      title: [c.module, c.lesson].filter(Boolean).join(' > ') || 'Material do Curso',
      snippet: c.content,
    }));

    // 4. Monta preamble (base + personalizado)
    const preamble = customPreamble
      ? `${DEFAULT_PREAMBLE}\n\nINSTRUÇÕES ADICIONAIS:\n${customPreamble}`
      : DEFAULT_PREAMBLE;

    // 5. Histórico de conversa no formato Cohere
    const chatHistory = (history || []).slice(-8).map((m: any) => ({
      role: m.role === 'user' ? 'USER' : 'CHATBOT',
      message: m.text,
    }));

    // 6. Chama Cohere command-r via API v2
    const messages: any[] = [
      { role: 'system', content: preamble },
      ...chatHistory.map((m: any) => ({
        role: m.role === 'USER' ? 'user' : 'assistant',
        content: m.message,
      })),
      { role: 'user', content: query.trim() },
    ];

    const cohereBody: any = {
      model: 'command-r-08-2024',
      messages,
      temperature: 0.3,
    };

    if (documents.length > 0) {
      cohereBody.documents = documents.map((d: any) => ({
        id: d.id,
        data: { title: d.title, text: d.snippet },
      }));
    }

    const chatRes = await fetch('https://api.cohere.com/v2/chat', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${COHERE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(cohereBody),
    });

    if (!chatRes.ok) {
      const err = await chatRes.text();
      throw new Error(`Cohere chat falhou: ${chatRes.status} — ${err.substring(0, 300)}`);
    }

    const chatData = await chatRes.json();
    const answer = chatData.message?.content?.[0]?.text || chatData.text || '';

    // Extrai fontes únicas dos chunks retornados
    const sources = [...new Set(
      (chunks || [])
        .map((c: any) => [c.module, c.lesson].filter(Boolean).join(' > '))
        .filter(Boolean)
    )];

    return new Response(JSON.stringify({
      answer,
      sources,
      model: 'Cohere command-r-08-2024',
      citations: chatData.citations || [],
    }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('chat-with-notes error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Erro interno no servidor.' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});
