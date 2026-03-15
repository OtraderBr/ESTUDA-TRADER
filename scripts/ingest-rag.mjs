#!/usr/bin/env node
// scripts/ingest-rag.mjs
// Ingere arquivos de estudo (.txt) do "MATERIAL AL BROOKS" no banco rag_chunks
// usando Cohere embed-multilingual-v3.0 (1024 dims, otimizado para PT-BR/RAG).
//
// Uso:
//   COHERE_API_KEY=xxx node scripts/ingest-rag.mjs
//
// Requisitos: Node.js 18+ (fetch nativo)

import { readdir, readFile } from 'node:fs/promises';
import { join, relative, extname } from 'node:path';

// ── Config ────────────────────────────────────────────────────────────────────
const COHERE_KEY   = process.env.COHERE_API_KEY || 'YEO4tvrKQ4aTx1tohiF3DEPcA2d5JAoHRlccEWuk';
const SUPABASE_KEY = process.env.SUPABASE_KEY   || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImplYmJrbGFjbXJ4cmhiYWp3ZXVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyMzgwOTcsImV4cCI6MjA4ODgxNDA5N30.-41Xg5zhF2hHiTJ3BUoT3TiL5LYwkhwzKfUUhTTUJks';
const SUPABASE_URL = 'https://jebbklacmrxrhbajweug.supabase.co';

const CHUNK_WORDS    = 800;  // ~1000 tokens por chunk
const OVERLAP_WORDS  = 100;  // sobreposição para não perder contexto
const BATCH_SIZE     = 10;   // chunks por insert (menor para Cohere)
const EMBED_DELAY_MS = 500;  // delay entre chamadas à API Cohere (trial)
const EMBED_BATCH    = 96;   // Cohere suporta até 96 textos por chamada
const MATERIAL_DIR   = join(import.meta.dirname, '..', 'MATERIAL AL BROOKS');

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function extractMeta(filePath) {
    const rel   = relative(MATERIAL_DIR, filePath);
    const parts = rel.split('/');
    if (parts[0] === 'CURSO AL BROOK' && parts.length >= 3) {
        return { module: parts[1], lesson: parts[2], source: rel };
    }
    return { module: '', lesson: '', source: rel };
}

function chunkText(text) {
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

/** Cohere embed-multilingual-v3.0 — batch de até 96 textos */
async function embedBatch(texts) {
    const res = await fetch('https://api.cohere.com/v1/embed', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${COHERE_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            texts,
            model: 'embed-multilingual-v3.0',
            input_type: 'search_document',
            embedding_types: ['float'],
        }),
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Cohere embed erro ${res.status}: ${err}`);
    }

    const data = await res.json();
    return data.embeddings.float; // float[][] — um vetor de 1024 por texto
}

async function insertBatch(rows) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rag_chunks`, {
        method: 'POST',
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal',
        },
        body: JSON.stringify(rows),
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

    // Coleta todos os chunks primeiro
    const allChunks = [];
    for (const filePath of files) {
        const content = await readFile(filePath, 'utf-8');
        if (content.trim().length < 50) continue;

        const meta   = extractMeta(filePath);
        const chunks = chunkText(content);
        console.log(`  📝  ${meta.source} → ${chunks.length} chunk(s)`);

        for (let i = 0; i < chunks.length; i++) {
            allChunks.push({ text: chunks[i], meta, index: i });
        }
    }

    console.log(`\n🔢  Total: ${allChunks.length} chunks para embedar\n`);

    let totalEmbedded = 0;
    const insertRows  = [];

    // Processa em lotes para o Cohere
    for (let i = 0; i < allChunks.length; i += EMBED_BATCH) {
        const batch = allChunks.slice(i, i + EMBED_BATCH);
        const texts = batch.map(c => c.text);

        try {
            const embeddings = await embedBatch(texts);

            for (let j = 0; j < batch.length; j++) {
                const { text, meta, index } = batch[j];
                insertRows.push({
                    content:     text,
                    embedding:   `[${embeddings[j].join(',')}]`,
                    source:      meta.source,
                    module:      meta.module,
                    lesson:      meta.lesson,
                    chunk_index: index,
                });
                totalEmbedded++;
            }

            process.stdout.write(`  ✅  ${totalEmbedded}/${allChunks.length} chunks embedados\r`);

            // Flush se atingiu batch de insert
            while (insertRows.length >= BATCH_SIZE) {
                await insertBatch(insertRows.splice(0, BATCH_SIZE));
            }

            await sleep(EMBED_DELAY_MS);

        } catch (err) {
            console.error(`\n  ❌  Lote ${i}–${i + batch.length}: ${err.message}`);
            console.log('  ⏳  Aguardando 10s e tentando novamente...');
            await sleep(10000);
            i -= EMBED_BATCH; // retry
        }
    }

    // Flush restante
    if (insertRows.length > 0) {
        await insertBatch(insertRows);
    }

    console.log(`\n\n🎉  Ingestão completa! ${totalEmbedded} chunks inseridos com embeddings Cohere.`);
    console.log('💡  Acesse o chat e faça sua primeira pergunta!');
}

main().catch(err => {
    console.error('\n💥  Erro fatal:', err.message);
    process.exit(1);
});
