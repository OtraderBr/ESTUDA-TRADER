#!/usr/bin/env node
// scripts/ingest-rag.mjs
// Ingere arquivos .txt do "MATERIAL AL BROOKS" no banco rag_chunks.
// Modelo: Cohere embed-multilingual-v3.0 (1024 dims, otimizado para PT-BR/RAG).
//
// Uso:
//   node scripts/ingest-rag.mjs
//
// Requisitos: Node.js 18+
// Limite Trial Cohere: 100.000 tokens/min → batch 20 chunks × ~1000 tokens = 20k tokens/lote
// Com delay de 12s entre lotes: ~100k tokens/min no máximo (seguro)

import { readdir, readFile } from 'node:fs/promises';
import { join, relative, extname } from 'node:path';

// ── Config ────────────────────────────────────────────────────────────────────
const COHERE_KEY   = process.env.COHERE_API_KEY || 'YEO4tvrKQ4aTx1tohiF3DEPcA2d5JAoHRlccEWuk';
const SUPABASE_KEY = process.env.SUPABASE_KEY   || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImplYmJrbGFjbXJ4cmhiYWp3ZXVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyMzgwOTcsImV4cCI6MjA4ODgxNDA5N30.-41Xg5zhF2hHiTJ3BUoT3TiL5LYwkhwzKfUUhTTUJks';
const SUPABASE_URL = 'https://jebbklacmrxrhbajweug.supabase.co';

const CHUNK_WORDS    = 800;  // ~1000 tokens por chunk
const OVERLAP_WORDS  = 100;  // sobreposição para não perder contexto
const EMBED_BATCH    = 20;   // ← reduzido de 96 para respeitar limite Trial (100k tokens/min)
const DB_BATCH       = 20;   // chunks por insert no Supabase
const EMBED_DELAY_MS = 12000; // 12s entre lotes → máx ~100k tokens/min
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
    const parts = rel.split(/[\\/]/);
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

/** Busca no banco quais (source, chunk_index) já estão inseridos para retomar */
async function fetchExistingKeys() {
    let page = 0;
    const pageSize = 1000;
    const existing = new Set();

    while (true) {
        const res = await fetch(
            `${SUPABASE_URL}/rest/v1/rag_chunks?select=source,chunk_index&limit=${pageSize}&offset=${page * pageSize}`,
            { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
        );
        if (!res.ok) break;
        const rows = await res.json();
        if (!rows.length) break;
        rows.forEach(r => existing.add(`${r.source}|${r.chunk_index}`));
        if (rows.length < pageSize) break;
        page++;
    }
    return existing;
}

/** Cohere embed-multilingual-v3.0 — batch de até 96 textos, usamos 20 */
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
        const error = new Error(`Cohere embed erro ${res.status}: ${err}`);
        error.status = res.status;
        throw error;
    }

    const data = await res.json();
    return data.embeddings.float;
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

function formatTime(ms) {
    const s = Math.round(ms / 1000);
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}m${s % 60}s`;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
    console.log('📂  Buscando arquivos em:', MATERIAL_DIR);
    const files = await walk(MATERIAL_DIR);
    console.log(`📄  ${files.length} arquivos .txt encontrados\n`);

    // Coleta todos os chunks
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

    console.log(`\n🔢  Total: ${allChunks.length} chunks gerados`);

    // Verifica o que já está no banco (suporte a retomada)
    console.log('🔍  Verificando chunks já inseridos no banco...');
    const existing = await fetchExistingKeys();
    if (existing.size > 0) {
        console.log(`⏭️   ${existing.size} chunks já existem — serão pulados\n`);
    } else {
        console.log(`📭  Banco vazio — inserindo tudo\n`);
    }

    // Filtra apenas os que faltam
    const pending = allChunks.filter(c => !existing.has(`${c.meta.source}|${c.index}`));
    console.log(`🚀  ${pending.length} chunks para inserir\n`);

    if (pending.length === 0) {
        console.log('✅  Tudo já está no banco! Nada a fazer.');
        return;
    }

    // Estimativa de tempo
    const totalBatches = Math.ceil(pending.length / EMBED_BATCH);
    const estimatedMs  = totalBatches * EMBED_DELAY_MS;
    console.log(`⏱️   Estimativa: ${formatTime(estimatedMs)} (${totalBatches} lotes × ${EMBED_DELAY_MS / 1000}s)\n`);

    let totalEmbedded = 0;
    const insertRows  = [];
    let retryDelay    = EMBED_DELAY_MS;

    for (let i = 0; i < pending.length; i += EMBED_BATCH) {
        const batch = pending.slice(i, i + EMBED_BATCH);
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

            retryDelay = EMBED_DELAY_MS; // reset após sucesso

            // Flush insert batch
            while (insertRows.length >= DB_BATCH) {
                await insertBatch(insertRows.splice(0, DB_BATCH));
            }

            const pct = Math.round((totalEmbedded / pending.length) * 100);
            process.stdout.write(`  ✅  ${totalEmbedded}/${pending.length} (${pct}%) — aguardando ${EMBED_DELAY_MS / 1000}s...\r`);

            await sleep(EMBED_DELAY_MS);

        } catch (err) {
            if (err.status === 429) {
                // Rate limit — espera 65s para o janela de 1 minuto resetar
                retryDelay = Math.min(retryDelay * 2, 120000);
                console.log(`\n  ⏳  Rate limit atingido. Aguardando ${formatTime(retryDelay)}...`);
                await sleep(retryDelay);
                i -= EMBED_BATCH; // retry mesmo lote
            } else {
                console.error(`\n  ❌  Lote ${i}–${i + batch.length}: ${err.message}`);
                console.log('  ⏳  Erro inesperado. Aguardando 15s e tentando novamente...');
                await sleep(15000);
                i -= EMBED_BATCH;
            }
        }
    }

    // Flush final
    if (insertRows.length > 0) {
        await insertBatch(insertRows);
    }

    console.log(`\n\n🎉  Ingestão completa! ${totalEmbedded} chunks inseridos com Cohere.`);
    console.log('💡  Acesse o chat e faça sua primeira pergunta!');
}

main().catch(err => {
    console.error('\n💥  Erro fatal:', err.message);
    process.exit(1);
});
