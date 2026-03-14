// server.js — Servidor HTTP com suporte RAG (Retrieval-Augmented Generation)
// Uso: node server.js
// Depois acesse: http://localhost:3000

const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');

const PORT = 3000;
const ROOT = __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
  '.csv':  'text/csv; charset=utf-8',
  '.md':   'text/markdown; charset=utf-8',
};

// ─── RAG Config ───────────────────────────────────────────────────────────────
let RAG = null;
try { RAG = require('./rag-config.js'); } catch { /* RAG desabilitado */ }

// ─── Helpers HTTP (Promise-based) ─────────────────────────────────────────────
function httpRequest(urlStr, method, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const url  = new URL(urlStr);
    const mod  = url.protocol === 'https:' ? https : http;
    const data = body ? JSON.stringify(body) : null;

    const options = {
      hostname: url.hostname,
      port:     url.port || (url.protocol === 'https:' ? 443 : 80),
      path:     url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
        ...headers,
      },
    };

    const req = mod.request(options, (res) => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, headers: res.headers, data: JSON.parse(buf) }); }
        catch { resolve({ status: res.statusCode, headers: res.headers, data: buf }); }
      });
    });

    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

const sbHeaders = () => ({
  'apikey':        RAG.supabaseKey,
  'Authorization': `Bearer ${RAG.supabaseKey}`,
});

// ─── Supabase REST helpers ────────────────────────────────────────────────────
function sbInsert(table, rows) {
  return httpRequest(
    `${RAG.supabaseUrl}/rest/v1/${table}`,
    'POST', rows,
    { ...sbHeaders(), 'Prefer': 'return=minimal' }
  );
}

function sbRpc(fn, params) {
  return httpRequest(
    `${RAG.supabaseUrl}/rest/v1/rpc/${fn}`,
    'POST', params,
    sbHeaders()
  );
}

async function sbCount(table) {
  // Usa aggregate count do Supabase — retorna [{count: "N"}]
  const r = await httpRequest(
    `${RAG.supabaseUrl}/rest/v1/${table}?select=count`,
    'GET', null,
    { ...sbHeaders(), 'Prefer': 'count=exact' }
  );
  if (Array.isArray(r.data) && r.data[0]?.count !== undefined) {
    return parseInt(r.data[0].count) || 0;
  }
  return 0;
}

function sbDeleteAll(table) {
  return httpRequest(
    `${RAG.supabaseUrl}/rest/v1/${table}?id=not.is.null`,
    'DELETE', null,
    { ...sbHeaders(), 'Prefer': 'return=minimal' }
  );
}

// ─── Ollama helpers ───────────────────────────────────────────────────────────
async function getEmbedding(text) {
  const res = await httpRequest(
    `${RAG.ollamaUrl}/api/embeddings`,
    'POST', { model: RAG.embeddingModel, prompt: text }
  );
  if (!res.data || !res.data.embedding) {
    throw new Error('Ollama não retornou embedding. Verifique se está rodando e o modelo está instalado.');
  }
  return res.data.embedding;
}

async function ollamaGenerate(prompt, opts = {}) {
  const res = await httpRequest(
    `${RAG.ollamaUrl}/api/generate`,
    'POST', {
      model:  RAG.chatModel,
      prompt,
      stream: false,
      options: {
        num_ctx:        4096,  // seguro para llama3.2 em hardware local
        temperature:    0.15,  // preciso e consistente
        top_p:          0.9,
        repeat_penalty: 1.1,
        num_predict:    1200,  // suficiente para respostas detalhadas sem travar
        ...opts,
      },
    }
  );
  return (res.data && res.data.response) ? res.data.response : '';
}

// Helper para ler body da request de forma segura
function readBody(req) {
  return new Promise((resolve, reject) => {
    let buf = '';
    req.on('data', d => buf += d);
    req.on('end',  () => resolve(buf));
    req.on('error', reject);
  });
}

// ─── Multi-Query Search: busca em paralelo com múltiplas queries e deduplica ──
async function multiQuerySearch(queries, threshold, countPerQuery) {
  // Gera todos os embeddings em paralelo
  const embeddings = await Promise.all(
    queries.map(q => getEmbedding(q).catch(() => null))
  );

  // Busca em paralelo para cada query com embedding válido
  const searches = await Promise.all(
    embeddings.map((emb) => {
      if (!emb) return Promise.resolve({ data: [] });
      return sbRpc('match_rag_chunks', {
        query_embedding: `[${emb.join(',')}]`,
        match_threshold: threshold,
        match_count:     countPerQuery,
      }).catch(() => ({ data: [] }));
    })
  );

  // Mescla e deduplica: mantém apenas a ocorrência com maior similaridade
  const seen = new Map();
  for (const r of searches) {
    for (const m of (Array.isArray(r.data) ? r.data : [])) {
      const key = m.content.slice(0, 120); // hash por início do conteúdo
      if (!seen.has(key) || seen.get(key).similarity < m.similarity) {
        seen.set(key, m);
      }
    }
  }

  // Retorna ordenado por similaridade descendente
  return [...seen.values()].sort((a, b) => b.similarity - a.similarity);
}

// ─── Chunking de texto ────────────────────────────────────────────────────────
function chunkText(text, size, overlap) {
  const chunks = [];
  let start = 0;
  const clean = text.replace(/\s+/g, ' ').trim();
  while (start < clean.length) {
    const end = Math.min(start + size, clean.length);
    const chunk = clean.slice(start, end).trim();
    if (chunk.length > 80) chunks.push(chunk);
    if (end === clean.length) break;
    start = end - overlap;
  }
  return chunks;
}

function getAllTxtFiles(dir) {
  const results = [];
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) results.push(...getAllTxtFiles(full));
      else if (entry.name.toLowerCase().endsWith('.txt')) results.push(full);
    }
  } catch {}
  return results;
}

function parseFileMeta(filePath) {
  const parts = filePath.replace(/\\/g, '/').split('/');
  const cursoIdx = parts.findIndex(p => p.includes('CURSO AL BROOK'));
  const module   = (cursoIdx >= 0 && parts[cursoIdx + 1]) ? parts[cursoIdx + 1] : '';
  const lesson   = path.basename(filePath, path.extname(filePath));
  return { module, lesson };
}

// ─── Helpers de resposta ──────────────────────────────────────────────────────
function jsonRes(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify(data));
}

function sseWrite(res, data) {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

// ─── RAG Handlers ─────────────────────────────────────────────────────────────

async function handleTest(_req, res) {
  if (!RAG) return jsonRes(res, 500, { error: 'rag-config.js não encontrado. Reinicie o servidor.' });

  const result = { ollama: false, embeddingModel: false, chatModel: false, supabase: false, errors: [] };

  // 1. Verificar se Ollama está rodando
  try {
    const r = await httpRequest(`${RAG.ollamaUrl}/api/tags`, 'GET', null);
    if (r.status === 200) {
      result.ollama = true;
      const models = (r.data.models || []).map(m => m.name);
      result.modelsInstalled = models;
      result.embeddingModel = models.some(m => m.startsWith(RAG.embeddingModel));
      result.chatModel      = models.some(m => m.startsWith(RAG.chatModel));
      if (!result.embeddingModel) result.errors.push(`Modelo "${RAG.embeddingModel}" não instalado. Rode: ollama pull ${RAG.embeddingModel}`);
      if (!result.chatModel)      result.errors.push(`Modelo "${RAG.chatModel}" não instalado. Rode: ollama pull ${RAG.chatModel}`);
    } else {
      result.errors.push(`Ollama retornou status ${r.status}`);
    }
  } catch (e) {
    result.errors.push(`Ollama offline ou não iniciado: ${e.message}`);
  }

  // 2. Verificar Supabase
  try {
    const count = await sbCount('rag_chunks');
    result.supabase = true;
    result.chunks = count;
  } catch (e) {
    result.errors.push(`Supabase: ${e.message}`);
  }

  jsonRes(res, 200, result);
}

async function handleStatus(_req, res) {
  if (!RAG) return jsonRes(res, 500, { error: 'rag-config.js não encontrado' });
  try {
    const chunks = await sbCount('rag_chunks');
    jsonRes(res, 200, { chunks, ready: chunks > 0 });
  } catch (e) {
    jsonRes(res, 500, { error: e.message });
  }
}

async function handleIngest(_req, res) {
  if (!RAG) return jsonRes(res, 500, { error: 'rag-config.js não encontrado' });

  // SSE para enviar progresso em tempo real
  res.writeHead(200, {
    'Content-Type':  'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache',
    'Connection':    'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });
  res.flushHeaders(); // garante que o browser recebe o header antes de qualquer await

  try {
    const materialDir = path.resolve(ROOT, RAG.materialPath);
    const files = getAllTxtFiles(materialDir);

    if (files.length === 0) {
      sseWrite(res, { type: 'error', message: 'Nenhum arquivo .txt encontrado em: ' + materialDir });
      return res.end();
    }

    sseWrite(res, { type: 'start', total: files.length });

    // Limpar chunks antigos
    await sbDeleteAll('rag_chunks');
    sseWrite(res, { type: 'info', message: 'Chunks antigos removidos. Iniciando ingestão...' });

    let totalChunks = 0;

    for (let i = 0; i < files.length; i++) {
      const filePath = files[i];
      const { module, lesson } = parseFileMeta(filePath);

      let text;
      try {
        text = fs.readFileSync(filePath, 'utf-8');
      } catch {
        continue;
      }

      const chunks = chunkText(text, RAG.chunkSize, RAG.chunkOverlap);

      for (let ci = 0; ci < chunks.length; ci++) {
        const chunk = chunks[ci];
        const embedding = await getEmbedding(chunk);
        await sbInsert('rag_chunks', [{
          content:     chunk,
          embedding:   `[${embedding.join(',')}]`,
          source:      path.relative(ROOT, filePath).replace(/\\/g, '/'),
          module,
          lesson,
          chunk_index: ci,
        }]);
        totalChunks++;
      }

      sseWrite(res, {
        type:      'progress',
        processed: i + 1,
        total:     files.length,
        lesson,
        chunks:    chunks.length,
        totalChunks,
      });

      console.log(`  [RAG] ${i + 1}/${files.length} — ${lesson} (${chunks.length} chunks)`);
    }

    sseWrite(res, {
      type:    'done',
      files:   files.length,
      chunks:  totalChunks,
      message: `Concluído! ${files.length} arquivos → ${totalChunks} chunks indexados.`,
    });

  } catch (e) {
    console.error('[RAG ingest]', e);
    sseWrite(res, { type: 'error', message: e.message });
  }

  res.end();
}

async function handleDescribe(req, res) {
  if (!RAG) return jsonRes(res, 500, { error: 'rag-config.js não encontrado' });

  let body = '';
  req.on('data', d => body += d);
  await new Promise(resolve => req.on('end', resolve));

  try {
    const { concept } = JSON.parse(body);
    if (!concept?.trim()) return jsonRes(res, 400, { error: 'Parâmetro "concept" é obrigatório.' });

    const c = concept.trim();

    // Multi-query: 5 ângulos diferentes do mesmo conceito para cobertura máxima
    const queries = [
      c,
      `definição e características de ${c} no Price Action`,
      `como identificar ${c} no gráfico`,
      `como operar ${c} entrada stop alvo`,
      `probabilidade ${c} Al Brooks tendência lateralidade`,
    ];

    // Busca ampla: threshold baixo (0.30) para capturar contexto periférico
    // 12 por query × 5 queries → até ~40-50 chunks únicos após deduplicação
    const allMatches = await multiQuerySearch(queries, 0.30, 12);

    // Limita aos 25 mais relevantes para não sobrecarregar o contexto do LLM
    const matches = allMatches.slice(0, 25);

    if (matches.length === 0) {
      return jsonRes(res, 200, {
        description: `Não encontrei informações específicas sobre "${c}" no material do Al Brooks disponível. Tente um termo mais específico.`,
        sources: [],
      });
    }

    // Contexto agrupado por módulo para facilitar a síntese do LLM
    const byModule = {};
    for (const m of matches) {
      const key = m.module || 'Geral';
      if (!byModule[key]) byModule[key] = [];
      byModule[key].push(m);
    }

    const context = Object.entries(byModule).map(([mod, chunks]) =>
      `=== MÓDULO: ${mod} ===\n` +
      chunks.map((m, i) =>
        `[Fonte ${i + 1} | Aula: ${m.lesson} | Similaridade: ${Math.round(m.similarity * 100)}%]\n${m.content}`
      ).join('\n\n')
    ).join('\n\n' + '='.repeat(60) + '\n\n');

    const prompt = `Você é um especialista em Price Action do método Al Brooks com mais de 10 anos de experiência. Responda SEMPRE em português brasileiro.

CONCEITO A ANALISAR: "${c}"

INSTRUÇÕES CRÍTICAS:
- Use SOMENTE as informações do material do Al Brooks fornecido abaixo
- Seja EXTREMAMENTE DETALHADO em cada seção
- Inclua EXEMPLOS PRÁTICOS e situações reais de mercado quando o material mencionar
- Cite as aulas específicas quando relevante
- Se uma seção não tiver dados suficientes, escreva: "Material insuficiente neste tópico."
- NÃO invente informações que não estejam no material

Estruture sua resposta EXATAMENTE neste formato (inclua TODOS os títulos):

## Definição
[Explique o que é este conceito, sua natureza fundamental, por que Al Brooks o considera importante no Price Action. Seja completo.]

## Como Identificar no Gráfico
[Descreva com precisão as características visuais: formato das barras, tamanho dos corpos e pavios, posicionamento relativo, padrões de candlestick associados, o que diferencia deste de outros padrões similares.]

## Contexto e Condições de Mercado
[Em quais situações este conceito aparece: tendência de alta, tendência de baixa, mercado lateral (trading range), após rompimentos, em reversões. Mencione timeframes relevantes se o material citar.]

## Regras de Operação — Entrada
[Quando e como entrar: no fechamento da barra, na abertura da próxima, em pullback, com ordem stop ou limite. Condições que devem estar presentes para confirmar a entrada.]

## Regras de Operação — Stop e Alvo
[Onde colocar o stop loss: abaixo/acima da barra, do swing anterior, em ponto específico. Onde realizar lucro: medida mínima, alvo em swing anterior, trailing stop.]

## Probabilidade e Edge
[Qual a probabilidade de sucesso que Al Brooks menciona para este setup. Relação risco/retorno esperada. Em quais condições a probabilidade aumenta ou diminui. Quantas tentativas costuma ter antes de funcionar.]

## Erros Comuns e Armadilhas
[Quais os erros mais frequentes ao operar este conceito. O que pode parecer este padrão mas não é. Situações em que deve ser evitado. Falsos sinais e como distingui-los.]

## Relação com Outros Conceitos
[Como este conceito se relaciona com outros elementos do método Al Brooks: barras de sinal, barras climáticas, gaps, tendências, canais, flags, triângulos, reversões de duas pernas, etc.]

---
MATERIAL DE REFERÊNCIA DO CURSO AL BROOKS:
${context}

---
ANÁLISE COMPLETA DE "${c}" (baseada exclusivamente no material acima):`;

    const description = await ollamaGenerate(prompt);

    const sources = matches.map(m => ({
      lesson:     m.lesson,
      module:     m.module,
      similarity: Math.round(m.similarity * 100),
    }));

    jsonRes(res, 200, { description: description.trim(), sources });

  } catch (e) {
    console.error('[RAG describe]', e);
    jsonRes(res, 500, { error: e.message });
  }
}

async function handleChat(req, res) {
  if (!RAG) return jsonRes(res, 500, { error: 'rag-config.js não encontrado' });

  let body = '';
  req.on('data', d => body += d);
  await new Promise(resolve => req.on('end', resolve));

  try {
    const { question } = JSON.parse(body);
    if (!question?.trim()) return jsonRes(res, 400, { error: 'Parâmetro "question" é obrigatório.' });

    const q = question.trim();

    // Extrai termos-chave removendo palavras de pergunta em português
    const keyTerms = q
      .replace(/\b(o que|como|quando|onde|por que|qual|quais|me explique|explique|fale sobre|defina|definição de|me diga)\b/gi, '')
      .replace(/[?!]/g, '')
      .trim();

    // Multi-query: pergunta original + variação com termos-chave + versão técnica
    const queries = [
      q,
      keyTerms.length > 5 ? keyTerms : q,
      `Al Brooks Price Action: ${keyTerms || q}`,
    ];

    // 10 chunks por query × 3 queries → até ~20-25 únicos após deduplicação
    const allMatches = await multiQuerySearch(queries, 0.38, 10);
    const matches = allMatches.slice(0, 18);

    if (matches.length === 0) {
      return jsonRes(res, 200, {
        answer:  'Não encontrei conteúdo relevante sobre isso no material do Al Brooks. Tente reformular usando termos técnicos do Price Action (ex: "barra de sinal", "tendência", "trading range").',
        sources: [],
      });
    }

    const context = matches.map((m, i) =>
      `[Fonte ${i + 1} | Aula: ${m.lesson} | Módulo: ${m.module} | Relevância: ${Math.round(m.similarity * 100)}%]\n${m.content}`
    ).join('\n\n---\n\n');

    const prompt = `Você é um especialista em Price Action do método Al Brooks. Responda SEMPRE em português brasileiro, de forma didática, estruturada e extremamente detalhada.

INSTRUÇÕES:
- Baseie-se EXCLUSIVAMENTE no material do curso Al Brooks fornecido abaixo
- Organize a resposta com títulos em markdown (##) quando houver múltiplos aspectos
- Use listas com "-" para enumerar regras, características ou passos
- Inclua detalhes práticos: números, percentuais, condições específicas quando o material mencionar
- Cite a aula de origem quando o dado for específico de uma aula
- Se a pergunta tiver múltiplas partes, responda cada uma separadamente
- Se a informação não estiver no material, diga claramente: "O material do Al Brooks não detalha este ponto específico."

PERGUNTA: ${q}

MATERIAL DE REFERÊNCIA:
${context}

RESPOSTA COMPLETA E DETALHADA (em português):`;

    const answer = await ollamaGenerate(prompt);

    const sources = matches.map(m => ({
      lesson:     m.lesson,
      module:     m.module,
      similarity: Math.round(m.similarity * 100),
    }));

    jsonRes(res, 200, { answer: answer.trim(), sources });

  } catch (e) {
    console.error('[RAG chat]', e);
    jsonRes(res, 500, { error: e.message });
  }
}

// ─── Servidor HTTP ────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const urlPath = req.url.split('?')[0];

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin':  '*',
      'Access-Control-Allow-Methods': 'GET,POST',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    return res.end();
  }

  // ─── Rotas RAG ────────────────────────────────────────────────────────────
  if (urlPath === '/api/rag/test'     && req.method === 'GET')  return handleTest(req, res);
  if (urlPath === '/api/rag/status'   && req.method === 'GET')  return handleStatus(req, res);
  if (urlPath === '/api/rag/ingest'   && req.method === 'POST') return handleIngest(req, res);
  if (urlPath === '/api/rag/chat'     && req.method === 'POST') return handleChat(req, res);
  if (urlPath === '/api/rag/describe' && req.method === 'POST') return handleDescribe(req, res);

  // ─── Servir arquivos estáticos (comportamento original) ──────────────────
  let staticPath = urlPath === '/' ? '/index.html' : urlPath;
  const filePath = path.join(ROOT, staticPath);
  const ext      = path.extname(filePath).toLowerCase();
  const mimeType = MIME[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end(`404 - Arquivo não encontrado: ${staticPath}`);
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('500 - Erro interno do servidor');
      }
      return;
    }

    res.writeHead(200, {
      'Content-Type': mimeType,
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log('');
  console.log('  ✅  Motor Brooks rodando!');
  console.log(`  🌐  Acesse: \x1b[36mhttp://localhost:${PORT}\x1b[0m`);
  console.log('  🤖  RAG disponível em /api/rag/  (Ollama + pgvector)');
  console.log('');
  console.log('  Pressione Ctrl+C para parar o servidor.');
  console.log('');
});
