// supabase/functions/chat-with-notes/index.ts
// Motor RAG: recebe pergunta → embedding → busca vetorial → Gemini responde com contexto
//
// Secrets necessários (supabase secrets set):
//   GEMINI_API_KEY   – chave da API Google AI Studio

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL        = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const GEMINI_KEY          = Deno.env.get('GEMINI_API_KEY')!;
const EMBED_MODEL         = 'text-embedding-004';
const CHAT_MODEL          = 'gemini-2.0-flash';

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

async function embedQuery(text: string): Promise<number[]> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent?key=${GEMINI_KEY}`;
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: `models/${EMBED_MODEL}`,
            content: { parts: [{ text }] },
        }),
    });

    if (!res.ok) throw new Error(`Embed falhou: ${res.status} ${await res.text()}`);
    const data = await res.json();
    return data.embedding.values;
}

async function generateAnswer(context: string, query: string, history: Array<{role: string; text: string}>): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${CHAT_MODEL}:generateContent?key=${GEMINI_KEY}`;

    const systemPrompt = `Você é um Professor e Mentor Especialista em Price Action, focado exclusivamente na metodologia de Al Brooks. Sua função é ensinar e responder perguntas baseando-se ESTRITAMENTE nos documentos do curso fornecidos abaixo como contexto.

REGRAS RÍGIDAS:
1. Responda APENAS com base nas informações presentes no CONTEXTO fornecido.
2. Se a pergunta NÃO puder ser respondida com o contexto, diga: "Não encontrei essa informação nos materiais do curso. Tente reformular a pergunta ou perguntar sobre outro conceito."
3. Cite o módulo e a aula de onde a informação foi extraída quando possível.
4. Use linguagem didática, clara e objetiva. Você está ensinando um trader que estuda Al Brooks.
5. Formate a resposta em Markdown: use **negrito** para conceitos-chave, listas quando apropriado, e organize bem o texto.
6. Não invente regras, setups ou probabilidades que não estejam no material.

CONTEXTO DOS DOCUMENTOS DO CURSO:
---
${context}
---`;

    // Montar histórico de conversa
    const contents = [];
    for (const msg of history) {
        contents.push({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.text }],
        });
    }
    // Última mensagem do usuário
    contents.push({ role: 'user', parts: [{ text: query }] });

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            system_instruction: { parts: [{ text: systemPrompt }] },
            contents,
            generationConfig: {
                temperature: 0.3,
                maxOutputTokens: 2048,
                topP: 0.85,
            },
        }),
    });

    if (!res.ok) throw new Error(`Gemini chat falhou: ${res.status} ${await res.text()}`);

    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || 'Sem resposta gerada.';
}

// ── Handler ───────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: CORS_HEADERS });
    }

    try {
        const { query, history = [] } = await req.json();

        if (!query || typeof query !== 'string' || query.trim().length < 3) {
            return new Response(JSON.stringify({ error: 'Envie uma pergunta válida (campo "query").' }), {
                status: 400,
                headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
            });
        }

        // 1. Embedding da pergunta
        const queryEmbedding = await embedQuery(query.trim());

        // 2. Busca vetorial — top 6 chunks mais relevantes
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
        const { data: chunks, error } = await supabase.rpc('match_rag_chunks', {
            query_embedding: `[${queryEmbedding.join(',')}]`,
            match_threshold: 0.35,
            match_count: 6,
        });

        if (error) throw new Error(`RPC match_rag_chunks falhou: ${error.message}`);

        // 3. Montar contexto
        const context = (chunks || [])
            .map((c: any, i: number) => {
                const src = [c.module, c.lesson].filter(Boolean).join(' > ');
                return `[Trecho ${i + 1}${src ? ` — ${src}` : ''}]\n${c.content}`;
            })
            .join('\n\n---\n\n');

        if (!context) {
            return new Response(JSON.stringify({
                answer: 'Não encontrei trechos relevantes nos materiais do curso para essa pergunta. Tente reformular ou perguntar sobre outro conceito de Price Action.',
                sources: [],
            }), {
                headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
            });
        }

        // 4. Gerar resposta com Gemini
        const answer = await generateAnswer(context, query.trim(), history);

        // 5. Montar fontes únicas
        const sources = [...new Set(
            (chunks || [])
                .map((c: any) => [c.module, c.lesson].filter(Boolean).join(' > '))
                .filter(Boolean)
        )];

        return new Response(JSON.stringify({ answer, sources }), {
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });

    } catch (err) {
        console.error('chat-with-notes error:', err);
        return new Response(JSON.stringify({ error: err.message || 'Erro interno.' }), {
            status: 500,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
    }
});
