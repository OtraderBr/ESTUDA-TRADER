// supabase/functions/chat-with-notes/index.ts
// Motor RAG: pergunta → embedding → busca vetorial → Gemini Pro responde com contexto
// Fallback automático: gemini-2.5-pro → gemini-2.5-flash → gemini-2.0-flash
// Retry com backoff exponencial em caso de rate limit (429)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL        = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const GEMINI_KEY          = Deno.env.get('GEMINI_API_KEY') || 'AIzaSyCX5i8hgbxYu_JCEHFiXIXnjySK--9jBHc';
const EMBED_MODEL         = 'gemini-embedding-001';

// Modelos em ordem de preferência: mais inteligente primeiro, fallback para mais rápido
const CHAT_MODELS = ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash'];

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
};

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// ── Embedding com retry ─────────────────────────────────────────────────────

async function embedQuery(text: string): Promise<number[]> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent?key=${GEMINI_KEY}`;

    for (let attempt = 0; attempt < 3; attempt++) {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: `models/${EMBED_MODEL}`,
                content: { parts: [{ text }] },
                outputDimensionality: 768,
            }),
        });

        if (res.ok) {
            const data = await res.json();
            return data.embedding.values;
        }

        if (res.status === 429 && attempt < 2) {
            await sleep((attempt + 1) * 2000);
            continue;
        }

        throw new Error(`Embed falhou: ${res.status} ${await res.text()}`);
    }
    throw new Error('Embed: máximo de tentativas excedido');
}

// ── Geração com fallback de modelos + retry ─────────────────────────────────

const SYSTEM_PROMPT = `Você é o **Professor Brooks**, um Mentor Especialista de nível mundial em Price Action baseado na metodologia completa de Al Brooks. Você tem domínio absoluto de todo o conteúdo do curso e ensina com a profundidade de quem operou por décadas.

SUA MISSÃO:
Ensinar Price Action de forma clara, profunda e prática, sempre fundamentado nos documentos do curso.

COMO RESPONDER:
1. **Base estrita no contexto** — Responda APENAS com informações presentes nos DOCUMENTOS fornecidos. Nunca invente regras, setups, probabilidades ou exemplos.
2. **Citação de fontes** — Sempre cite o módulo e aula de onde veio a informação (ex: "Módulo 3, Aula 25").
3. **Didática de professor** — Explique como se estivesse dando aula particular. Use analogias quando ajudar, exemplos práticos do gráfico, e construa o raciocínio passo a passo.
4. **Profundidade** — Não dê respostas superficiais. Aprofunde nos detalhes, nuances e exceções que Al Brooks ensina. Conecte conceitos relacionados quando relevante.
5. **Formatação Markdown rica**:
   - **Negrito** para conceitos-chave e termos técnicos
   - Listas organizadas para características e regras
   - Separação clara entre tópicos
   - Use cabeçalhos (##) quando a resposta cobrir múltiplos aspectos
6. **Se não encontrar** — Diga honestamente: "Não encontrei essa informação nos materiais do curso. Tente reformular ou perguntar sobre outro conceito."
7. **Linguagem** — Português brasileiro, tom profissional mas acessível. Trate o aluno como um trader sério que está se aprofundando.

CONTEXTO DOS DOCUMENTOS DO CURSO:
---
`;

async function generateAnswer(context: string, query: string, history: Array<{role: string; text: string}>): Promise<{answer: string; model: string}> {
    const fullSystemPrompt = SYSTEM_PROMPT + context + '\n---';

    const contents = [];
    for (const msg of history) {
        contents.push({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.text }],
        });
    }
    contents.push({ role: 'user', parts: [{ text: query }] });

    const requestBody = {
        system_instruction: { parts: [{ text: fullSystemPrompt }] },
        contents,
        generationConfig: {
            temperature: 0.25,
            maxOutputTokens: 4096,
            topP: 0.9,
            topK: 40,
        },
    };

    // Tenta cada modelo em ordem de preferência
    for (const model of CHAT_MODELS) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`;

        // Até 2 tentativas por modelo (retry em 429)
        for (let attempt = 0; attempt < 2; attempt++) {
            try {
                const res = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(requestBody),
                });

                if (res.ok) {
                    const data = await res.json();
                    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (text) return { answer: text, model };
                    continue; // resposta vazia, tenta de novo
                }

                if (res.status === 429) {
                    if (attempt === 0) {
                        await sleep(3000);
                        continue;
                    }
                    break; // pula pro próximo modelo
                }

                if (res.status === 404) {
                    break; // modelo não existe, pula pro próximo
                }

                const errText = await res.text();
                console.error(`Modelo ${model} erro ${res.status}: ${errText.substring(0, 200)}`);
                break;

            } catch (err) {
                console.error(`Modelo ${model} exceção: ${err.message}`);
                break;
            }
        }
    }

    throw new Error('Todos os modelos falharam. Tente novamente em alguns segundos.');
}

// ── Handler principal ───────────────────────────────────────────────────────

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

        // 2. Busca vetorial — top 8 chunks mais relevantes (mais contexto = resposta melhor)
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
        const { data: chunks, error } = await supabase.rpc('match_rag_chunks', {
            query_embedding: `[${queryEmbedding.join(',')}]`,
            match_threshold: 0.30,
            match_count: 8,
        });

        if (error) throw new Error(`RPC match_rag_chunks falhou: ${error.message}`);

        // 3. Montar contexto
        const context = (chunks || [])
            .map((c: any, i: number) => {
                const src = [c.module, c.lesson].filter(Boolean).join(' > ');
                return `[Documento ${i + 1}${src ? ` — ${src}` : ''}]\n${c.content}`;
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

        // 4. Gerar resposta (com fallback automático de modelos)
        const { answer, model } = await generateAnswer(context, query.trim(), history);

        // 5. Montar fontes únicas
        const sources = [...new Set(
            (chunks || [])
                .map((c: any) => [c.module, c.lesson].filter(Boolean).join(' > '))
                .filter(Boolean)
        )];

        return new Response(JSON.stringify({ answer, sources, model }), {
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
