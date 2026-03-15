// supabase/functions/chat-with-notes/index.ts
// Modos:
//   'rag'      (padrão) — pergunta → embedding → busca vetorial → Gemini com contexto do curso
//   'free'     — prompt livre → Gemini sem RAG (IA geral sobre Price Action)
//   'generate' — gerar conhecimento completo sobre um conceito (RAG com mais chunks)
//
// Fallback automático: gemini-2.5-pro → gemini-2.5-flash → gemini-2.0-flash
// Retry com backoff exponencial em caso de rate limit (429)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL        = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const GEMINI_KEY          = Deno.env.get('GEMINI_API_KEY') || 'AIzaSyCX5i8hgbxYu_JCEHFiXIXnjySK--9jBHc';
const EMBED_MODEL         = 'gemini-embedding-001';

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
        if (res.ok) { const d = await res.json(); return d.embedding.values; }
        if (res.status === 429 && attempt < 2) { await sleep((attempt + 1) * 2000); continue; }
        throw new Error(`Embed falhou: ${res.status} ${await res.text()}`);
    }
    throw new Error('Embed: máximo de tentativas excedido');
}

// ── System Prompts ──────────────────────────────────────────────────────────

const PROMPT_RAG = `Você é o **Professor Brooks**, Mentor Especialista de nível mundial em Price Action baseado na metodologia de Al Brooks.

COMO RESPONDER:
1. **Base no contexto** — Responda APENAS com informações dos DOCUMENTOS fornecidos.
2. **Citação de fontes** — Cite o módulo e aula (ex: "Módulo 3, Aula 25").
3. **Didática** — Explique passo a passo como em aula particular. Use analogias e exemplos práticos.
4. **Profundidade** — Detalhe nuances, exceções e conexões entre conceitos.
5. **Formatação Markdown**: **negrito** para termos-chave, listas, cabeçalhos (##) para múltiplos aspectos.
6. **Se não encontrar** — Diga: "Não encontrei essa informação nos materiais do curso."
7. **Linguagem** — Português brasileiro, tom profissional e acessível.

CONTEXTO DOS DOCUMENTOS:
---
`;

const PROMPT_FREE = `Você é o **Professor Brooks**, especialista de nível mundial em Price Action e na metodologia de Al Brooks. Você tem décadas de experiência no mercado financeiro e domínio completo de análise técnica baseada em Price Action.

Você responde perguntas LIVRES sobre qualquer tema relacionado a:
- Price Action e metodologia Al Brooks
- Mercados financeiros, trading e análise técnica
- Psicologia do trading
- Gestão de risco e capital
- Dúvidas gerais de um trader em formação

COMO RESPONDER:
1. **Seja direto e didático** — Responda com profundidade e clareza.
2. **Exemplos práticos** — Use exemplos de gráfico quando ajudar.
3. **Formatação Markdown rica**: **negrito** para conceitos-chave, listas, cabeçalhos (##).
4. **Linguagem** — Português brasileiro, tom profissional mas acessível.
5. **Honestidade** — Se não souber algo com certeza, diga claramente.

Você NÃO está limitado ao material do curso neste modo — responda com todo seu conhecimento.`;

const PROMPT_GENERATE = (conceptName: string) => `Você é o **Professor Brooks**, Mentor Especialista de nível mundial em Price Action baseado na metodologia de Al Brooks.

Sua tarefa é gerar um **conhecimento completo e aprofundado** sobre o conceito: **"${conceptName}"**

Use TODO o conteúdo dos documentos fornecidos abaixo para montar uma explicação rica e estruturada.

ESTRUTURA DA RESPOSTA (use Markdown):
## O que é
[Definição clara e precisa do conceito]

## Características Principais
[Lista das características mais importantes]

## Como Identificar no Gráfico
[Critérios visuais de identificação]

## Regras de Operação
[Regras específicas de entrada, saída, stop]

## Probabilidades e Contexto
[Em que contextos funciona melhor, probabilidades de sucesso]

## Armadilhas e Erros Comuns
[O que evitar, exceções importantes]

## Conexões com Outros Conceitos
[Como se relaciona com outros conceitos do Price Action]

REGRAS:
- Use APENAS informações dos documentos fornecidos
- Seja exaustivo — este será o material de estudo principal do aluno
- Formate bem com Markdown (negrito, listas, cabeçalhos)
- Cite a fonte (módulo/aula) ao final de cada seção quando disponível
- Português brasileiro

DOCUMENTOS DO CURSO:
---
`;

// ── Geração com fallback de modelos + retry ─────────────────────────────────

async function callGemini(
    systemPrompt: string,
    contents: Array<{role: string; parts: Array<{text: string}>}>,
    maxTokens = 4096
): Promise<{text: string; model: string}> {
    const requestBody = {
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents,
        generationConfig: {
            temperature: 0.25,
            maxOutputTokens: maxTokens,
            topP: 0.9,
            topK: 40,
        },
    };

    for (const model of CHAT_MODELS) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`;
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
                    if (text) return { text, model };
                    continue;
                }
                if (res.status === 429) { if (attempt === 0) { await sleep(3000); continue; } break; }
                if (res.status === 404) break;
                console.error(`Modelo ${model} erro ${res.status}: ${(await res.text()).substring(0, 200)}`);
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
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });

    try {
        const body = await req.json();
        const { query, history = [], mode = 'rag', conceptName } = body;

        if (!query || typeof query !== 'string' || query.trim().length < 2) {
            return new Response(JSON.stringify({ error: 'Envie uma pergunta válida (campo "query").' }), {
                status: 400,
                headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
            });
        }

        // ── MODO LIVRE: sem RAG ──────────────────────────────────────────────
        if (mode === 'free') {
            const contents = [
                ...history.map((m: any) => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.text }] })),
                { role: 'user', parts: [{ text: query.trim() }] },
            ];
            const { text, model } = await callGemini(PROMPT_FREE, contents, 4096);
            return new Response(JSON.stringify({ answer: text, sources: [], model, mode: 'free' }), {
                headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
            });
        }

        // ── MODO RAG (padrão) e GENERATE: usa busca vetorial ────────────────
        const queryEmbedding = await embedQuery(query.trim());
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

        const matchCount = mode === 'generate' ? 12 : 8;
        const { data: chunks, error } = await supabase.rpc('match_rag_chunks', {
            query_embedding: `[${queryEmbedding.join(',')}]`,
            match_threshold: 0.28,
            match_count: matchCount,
        });

        if (error) throw new Error(`RPC match_rag_chunks falhou: ${error.message}`);

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
            }), { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
        }

        // Monta system prompt com contexto
        const sysPrompt = mode === 'generate'
            ? PROMPT_GENERATE(conceptName || query) + context + '\n---'
            : PROMPT_RAG + context + '\n---';

        const contents = [
            ...history.map((m: any) => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.text }] })),
            { role: 'user', parts: [{ text: query.trim() }] },
        ];

        const maxTokens = mode === 'generate' ? 6000 : 4096;
        const { text, model } = await callGemini(sysPrompt, contents, maxTokens);

        const sources = [...new Set(
            (chunks || [])
                .map((c: any) => [c.module, c.lesson].filter(Boolean).join(' > '))
                .filter(Boolean)
        )];

        return new Response(JSON.stringify({ answer: text, sources, model, mode }), {
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
