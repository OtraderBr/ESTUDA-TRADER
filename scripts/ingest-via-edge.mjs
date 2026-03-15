#!/usr/bin/env node
// scripts/ingest-via-edge.mjs
// Reads study files, chunks them, sends to the ingest-chunks Edge Function via curl.
// Skips chunks already inserted (checks by source+chunk_index).

import { readdir, readFile } from 'node:fs/promises';
import { writeFileSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { execSync } from 'node:child_process';

const SUPABASE_URL   = 'https://jebbklacmrxrhbajweug.supabase.co';
const EDGE_FN_URL    = `${SUPABASE_URL}/functions/v1/ingest-chunks`;
const ANON_KEY       = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImplYmJrbGFjbXJ4cmhiYWp3ZXVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyMzgwOTcsImV4cCI6MjA4ODgxNDA5N30.-41Xg5zhF2hHiTJ3BUoT3TiL5LYwkhwzKfUUhTTUJks';
const CHUNK_WORDS    = 800;
const OVERLAP_WORDS  = 100;
const BATCH_SIZE     = 3;   // smaller batches to avoid rate limit
const MATERIAL_DIR   = join(import.meta.dirname, '..', 'MATERIAL AL BROOKS');
const TMP_FILE       = '/tmp/ingest-batch.json';

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
    const rel = relative(MATERIAL_DIR, filePath);
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

function getExistingChunks() {
    // Query existing chunks via REST API
    try {
        const url = `${SUPABASE_URL}/rest/v1/rag_chunks?select=source,chunk_index`;
        const result = execSync(`curl -s "${url}" -H "apikey: ${ANON_KEY}" -H "Authorization: Bearer ${ANON_KEY}"`, { encoding: 'utf-8', timeout: 30000 });
        const rows = JSON.parse(result);
        const set = new Set();
        for (const r of rows) {
            set.add(`${r.source}::${r.chunk_index}`);
        }
        return set;
    } catch {
        return new Set();
    }
}

function sendBatchViaCurl(chunks) {
    const payload = JSON.stringify({ chunks });
    writeFileSync(TMP_FILE, payload);
    const cmd = `curl -s --max-time 180 "${EDGE_FN_URL}" -X POST -H "Content-Type: application/json" -H "Authorization: Bearer ${ANON_KEY}" -d @${TMP_FILE}`;
    try {
        const result = execSync(cmd, { encoding: 'utf-8', timeout: 190000 });
        return JSON.parse(result);
    } catch (err) {
        throw new Error(`curl failed: ${err.message}`);
    }
}

function sleep(s) { execSync(`sleep ${s}`); }

async function main() {
    console.log('📂  Reading files from:', MATERIAL_DIR);
    const files = await walk(MATERIAL_DIR);
    console.log(`📄  ${files.length} .txt files found`);

    // Get already-inserted chunks
    console.log('🔍  Checking existing chunks...');
    const existing = getExistingChunks();
    console.log(`📊  ${existing.size} chunks already in DB\n`);

    const allChunks = [];
    for (const filePath of files) {
        const content = await readFile(filePath, 'utf-8');
        if (content.trim().length < 50) continue;
        const meta = extractMeta(filePath);
        const chunks = chunkText(content);
        for (let i = 0; i < chunks.length; i++) {
            const key = `${meta.source}::${i}`;
            if (existing.has(key)) continue; // skip already inserted
            allChunks.push({
                content: chunks[i],
                source: meta.source,
                module: meta.module,
                lesson: meta.lesson,
                chunk_index: i,
            });
        }
    }

    if (allChunks.length === 0) {
        console.log('✅  All chunks already ingested!');
        return;
    }

    console.log(`📦  ${allChunks.length} NEW chunks to ingest\n`);

    let totalOk = 0;
    let totalFail = 0;
    let consecutiveRateLimits = 0;
    const totalBatches = Math.ceil(allChunks.length / BATCH_SIZE);

    for (let i = 0; i < allChunks.length; i += BATCH_SIZE) {
        const batch = allChunks.slice(i, i + BATCH_SIZE);
        const batchNum = Math.floor(i / BATCH_SIZE) + 1;

        process.stdout.write(`  🔄 Batch ${batchNum}/${totalBatches} (${i+1}-${i+batch.length}/${allChunks.length})... `);

        let success = false;
        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                const result = sendBatchViaCurl(batch);
                totalOk += result.inserted || 0;
                totalFail += result.failed || 0;
                console.log(`✅ ${result.inserted} ok, ${result.failed} fail`);

                // Check for rate limit in results
                const hasRateLimit = (result.results || []).some(r => !r.ok && r.error?.includes('429'));
                if (hasRateLimit) {
                    consecutiveRateLimits++;
                    if (consecutiveRateLimits >= 3) {
                        console.log('  ⏳ Rate limited, waiting 60s...');
                        sleep(60);
                        consecutiveRateLimits = 0;
                    }
                } else {
                    consecutiveRateLimits = 0;
                }

                success = true;
                break;
            } catch (err) {
                console.log(`⚠️  attempt ${attempt+1}: ${err.message}`);
                if (attempt < 2) sleep(5);
            }
        }

        if (!success) {
            totalFail += batch.length;
            console.log(`❌ batch ${batchNum} failed`);
        }

        // Small delay between batches to avoid rate limit
        sleep(2);
    }

    console.log(`\n🎉  Done! ${totalOk} inserted, ${totalFail} failed (total in DB: ~${existing.size + totalOk}).`);
}

main().catch(err => {
    console.error('💥  Fatal:', err);
    process.exit(1);
});
