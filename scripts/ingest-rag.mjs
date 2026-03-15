#!/usr/bin/env node
// scripts/ingest-rag.mjs
// Ingere os arquivos de estudo (.txt) do "MATERIAL AL BROOKS" no banco rag_chunks
// via Gemini text-embedding-004 + Supabase REST API.
//
// Uso:
//   GEMINI_API_KEY=xxx SUPABASE_SERVICE_KEY=xxx node scripts/ingest-rag.mjs
//
// Requisitos: Node.js 18+ (fetch nativo, sem npm install)

import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative, basename, extname } from 'node:path';

// ── Config ────────────────────────────────────────────────────────────────────
const GEMINI_KEY       = process.env.GEMINI_API_KEY;
const SUPABASE_KEY     = process.env.SUPABASE_SERVICE_KEY;
const SUPABASE_URL     = 'https://jebbklacmrxrhbajweug.supabase.co';
const EMBED_MODEL      = 'text-embedding-004';
const CHUNK_WORDS      = 800;   // ~1000 tokens
const OVERLAP_WORDS    = 100;
const BATCH_SIZE       = 20;    // chunks por lote de insert
const EMBED_DELAY_MS   = 220;   // respeitar rate limit Gemini free (300 RPM)
const MATERIAL_DIR     = join(import.meta.dirname, '..', 'MATERIAL AL BROOKS');

if (!GEMINI_KEY || !SUPABASE_KEY) {
    console.error('❌  Defina GEMINI_API_KEY e SUPABASE_SERVICE_KEY como variáveis de ambiente.');
    process.exit(1);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Percorre recursivamente o diretório e retorna todos os .txt */
async function walk(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    const files = [];
    for (const e of entries) {
        const full = join(dir, e.name);
        if (e.isDirectory()) files.push(...await walk(full));
        else if (extname(e.name).toLowerCase() === '.txt') files.push(full);
    }
    return files;
}

/** Extrai módulo e aula do caminho do arquivo */
function extractMeta(filePath) {
    const rel = relative(MATERIAL_DIR, filePath);
    const parts = rel.split('/');

    // Formato: CURSO AL BROOK / 1 - Analise de Graficos (08-11) / 8 / 8a.txt
    if (parts[0] === 'CURSO AL BROOK' && parts.length >= 3) {
        return { module: parts[1], lesson: parts[2], source: rel };
    }
    // Arquivos na raiz do material
    return { module: '', lesson: '', source: rel };
}

/** Divide texto em chunks com overlap */
function chunkText(text) {
    // Normaliza espaços e quebras
    const clean = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    const words = clean.split(/\s+/);

    if (words.length <= CHUNK_WORDS) return [clean];

    const chunks = [];
    let start = 0;
    while (start < words.length) {
        const end = Math.min(start + CHUNK_WORDS, words.length);
        chunks.push(words.slice(start, end).join(' '));
        if (end >= words.length) break;
        start = end - OVERLAP_WORDS;
    }
    return chunks;
}

/** Chama Gemini text-embedding-004 para gerar vetor 768d */
async function embedText(text) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent?key=${GEMINI_KEY}`;
    const body = {
        model: `models/${EMBED_MODEL}`,
        content: { parts: [{ text }] }
    };

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Gemini embed erro ${res.status}: ${err}`);
    }

    const data = await res.json();
    return data.embedding.values; // float[]
}

/** Insere um lote de chunks no Supabase via REST */
async function insertBatch(rows) {
    const url = `${SUPABASE_URL}/rest/v1/rag_chunks`;
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
        },
        body: JSON.stringify(rows)
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Supabase insert erro ${res.status}: ${err}`);
    }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
    console.log('📂  Buscando arquivos em:', MATERIAL_DIR);
    const files = await walk(MATERIAL_DIR);
    console.log(`📄  ${files.length} arquivos .txt encontrados\n`);

    let totalChunks = 0;
    let totalEmbedded = 0;
    const batch = [];

    for (const filePath of files) {
        const content = await readFile(filePath, 'utf-8');
        if (content.trim().length < 50) continue; // pular arquivos muito pequenos

        const meta = extractMeta(filePath);
        const chunks = chunkText(content);

        console.log(`  ⚙️  ${meta.source} → ${chunks.length} chunk(s)`);

        for (let i = 0; i < chunks.length; i++) {
            totalChunks++;

            try {
                const embedding = await embedText(chunks[i]);
                totalEmbedded++;

                batch.push({
                    content: chunks[i],
                    embedding: `[${embedding.join(',')}]`, // formato pgvector
                    source: meta.source,
                    module: meta.module,
                    lesson: meta.lesson,
                    chunk_index: i
                });

                // Flush batch
                if (batch.length >= BATCH_SIZE) {
                    await insertBatch(batch.splice(0));
                    process.stdout.write(`     ✅ ${totalEmbedded}/${totalChunks} chunks inseridos\r`);
                }

                await sleep(EMBED_DELAY_MS); // rate limit
            } catch (err) {
                console.error(`\n  ❌ Chunk ${i} de ${meta.source}: ${err.message}`);
                // Retry após 5s
                await sleep(5000);
                i--; // re-tentar mesmo chunk
            }
        }
    }

    // Flush restante
    if (batch.length > 0) {
        await insertBatch(batch);
    }

    console.log(`\n\n🎉  Ingestão completa! ${totalEmbedded} chunks embedados e inseridos.`);
    console.log('💡  Execute agora a Edge Function chat-with-notes para perguntas ao material.');
}

main().catch(err => {
    console.error('💥  Erro fatal:', err);
    process.exit(1);
});
