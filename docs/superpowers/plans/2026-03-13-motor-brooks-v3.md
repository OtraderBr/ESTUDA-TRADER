# Motor Brooks v3 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar o Motor Brooks de um sistema passivo em um motor inteligente de estudos, migrando persistência para Supabase, adicionando SM-2 adaptativo, editor rico, sistema de tags e heatmap na árvore de decisão.

**Architecture:** O frontend vanilla JS é mantido. A inteligência vive no Supabase (5 novas tabelas + 2 Edge Functions). O localStorage passa a ser apenas cache de sessão para as Edge Functions. Toda persistência de progresso, notas e avaliações vai para o Supabase.

**Tech Stack:** Vanilla JS (ES Modules), Tailwind CSS CDN, Supabase JS v2, Tiptap 2.11.5 (UMD CDN), Deno (Edge Functions), Node.js 22 (testes locais de módulos puros).

**Spec:** `docs/superpowers/specs/2026-03-13-motor-brooks-v3-design.md`
**Supabase Project ID:** `jebbklacmrxrhbajweug`
**Dev server:** `python -m http.server 5500` (ou via preview_start "Motor Brooks (Python)")

---

## Chunk 1: Foundation — DB, SM-2, DataService, Engine

---

### Task 1: Migrations SQL + RLS

**Files:**
- Create: `supabase/migrations/001_v3_tables.sql`

- [ ] **Step 1.1: Criar arquivo de migration**

Criar o arquivo `supabase/migrations/001_v3_tables.sql` com o conteúdo:

```sql
-- Motor Brooks v3 — Tabelas de progresso, notas, avaliações e sessões
-- Aplicar via Supabase MCP: apply_migration com project_id jebbklacmrxrhbajweug

-- 1. Progresso por conceito (substitui localStorage brooks_progress_v4)
CREATE TABLE IF NOT EXISTS user_concept_progress (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conceito_name      TEXT NOT NULL UNIQUE,
  abc_category       TEXT NOT NULL DEFAULT 'C'
                       CHECK (abc_category IN ('A','B','C')),
  macro_category     TEXT NOT NULL DEFAULT 'Fundamento',
  importance         TEXT DEFAULT 'Média'
                       CHECK (importance IN ('Baixa','Média','Alta')),
  mastery_percentage INT NOT NULL DEFAULT 0
                       CHECK (mastery_percentage BETWEEN 0 AND 100),
  last_studied_at    TIMESTAMPTZ,
  next_review_at     TIMESTAMPTZ,
  sm2_ease_factor    FLOAT NOT NULL DEFAULT 2.5,
  sm2_interval       INT NOT NULL DEFAULT 1,
  sm2_repetitions    INT NOT NULL DEFAULT 0,
  tags               TEXT[] NOT NULL DEFAULT '{}',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ucp_next_review ON user_concept_progress(next_review_at);
CREATE INDEX IF NOT EXISTS idx_ucp_tags ON user_concept_progress USING gin(tags);

-- 2. Notas ricas por conceito (substitui notesList no localStorage)
CREATE TABLE IF NOT EXISTS concept_notes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conceito_name  TEXT NOT NULL,
  type           TEXT NOT NULL DEFAULT 'Anotação'
                   CHECK (type IN (
                     'Descrição',
                     'Anotação',
                     'Dúvida',
                     'Pergunta',
                     'Questionamento',
                     'Observação de Tela'
                   )),
  content_html   TEXT NOT NULL DEFAULT '',
  content_text   TEXT NOT NULL DEFAULT '',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Garante que cada conceito tenha no máximo uma nota do tipo 'Descrição'
CREATE UNIQUE INDEX IF NOT EXISTS idx_notes_descricao_unique
  ON concept_notes(conceito_name)
  WHERE type = 'Descrição';

CREATE INDEX IF NOT EXISTS idx_notes_conceito ON concept_notes(conceito_name);
CREATE INDEX IF NOT EXISTS idx_notes_fts ON concept_notes
  USING gin(to_tsvector('portuguese', content_text));

-- 3. Avaliações (substitui evaluations no localStorage)
-- self_score = autoavaliação Técnica de Feynman (0-100), substitui quizScore
CREATE TABLE IF NOT EXISTS concept_evaluations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conceito_name    TEXT NOT NULL,
  flashcard_score  INT NOT NULL CHECK (flashcard_score BETWEEN 0 AND 100),
  self_score       INT NOT NULL CHECK (self_score BETWEEN 0 AND 100),
  explanation      TEXT NOT NULL,
  mastery_at_time  INT NOT NULL,
  sm2_quality      INT NOT NULL CHECK (sm2_quality BETWEEN 0 AND 5),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_evals_conceito ON concept_evaluations(conceito_name);
CREATE INDEX IF NOT EXISTS idx_evals_date ON concept_evaluations(created_at DESC);

-- 4. Sessões de estudo (substitui brooks_sessions_v1)
CREATE TABLE IF NOT EXISTS study_sessions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title          TEXT NOT NULL,
  type           TEXT NOT NULL DEFAULT 'Estudo'
                   CHECK (type IN ('Estudo','Revisão','Prática')),
  scheduled_date DATE NOT NULL,
  completed_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS session_concepts (
  session_id    UUID NOT NULL REFERENCES study_sessions(id) ON DELETE CASCADE,
  conceito_name TEXT NOT NULL,
  PRIMARY KEY (session_id, conceito_name)
);

-- 5. Desabilitar RLS (projeto single-user, acesso via anon key)
ALTER TABLE user_concept_progress DISABLE ROW LEVEL SECURITY;
ALTER TABLE concept_notes DISABLE ROW LEVEL SECURITY;
ALTER TABLE concept_evaluations DISABLE ROW LEVEL SECURITY;
ALTER TABLE study_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE session_concepts DISABLE ROW LEVEL SECURITY;
```

- [ ] **Step 1.2: Aplicar migration no Supabase**

Usar a ferramenta MCP `apply_migration` com:
- `project_id`: `jebbklacmrxrhbajweug`
- `name`: `v3_tables`
- `query`: conteúdo completo do arquivo acima

- [ ] **Step 1.3: Verificar tabelas criadas**

Usar a ferramenta MCP `execute_sql` com:
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'user_concept_progress','concept_notes',
    'concept_evaluations','study_sessions','session_concepts'
  )
ORDER BY table_name;
```

Resultado esperado: 5 linhas, uma para cada tabela.

- [ ] **Step 1.4: Verificar índice partial unique**

```sql
SELECT indexname, indexdef FROM pg_indexes
WHERE tablename = 'concept_notes'
  AND indexname = 'idx_notes_descricao_unique';
```

Resultado esperado: 1 linha com `WHERE (type = 'Descrição')` na definição.

- [ ] **Step 1.5: Commit**

```bash
git add supabase/migrations/001_v3_tables.sql
git commit -m "feat: add supabase migrations for motor brooks v3"
```

---

### Task 2: js/sm2.js — Algoritmo de Repetição Espaçada

**Files:**
- Create: `js/sm2.js`
- Create: `test-sm2.mjs` (temporário, não commitar)

- [ ] **Step 2.1: Criar arquivo de teste**

Criar `test-sm2.mjs` na raiz do projeto:

```js
// test-sm2.mjs — Verificação do algoritmo SM-2
// Executar com: node test-sm2.mjs
// Deletar após verificação.

import { calculateQuality, applySM2, calculateMastery } from './js/sm2.js';

let passed = 0;
let failed = 0;

function assert(description, condition) {
  if (condition) {
    console.log(`  ✅ ${description}`);
    passed++;
  } else {
    console.error(`  ❌ ${description}`);
    failed++;
  }
}

console.log('\n--- calculateQuality ---');
assert('avg 95 → quality 5', calculateQuality(100, 90) === 5);
assert('avg 80 → quality 4', calculateQuality(80, 80) === 4);
assert('avg 60 → quality 3', calculateQuality(60, 60) === 3);
assert('avg 40 → quality 2', calculateQuality(40, 40) === 2);
assert('avg 20 → quality 1', calculateQuality(20, 20) === 1);
assert('avg 0  → quality 0', calculateQuality(0, 0) === 0);
assert('avg 75 → quality 4', calculateQuality(75, 75) === 4);

console.log('\n--- applySM2 — primeira repetição correta ---');
const base = { sm2_ease_factor: 2.5, sm2_interval: 1, sm2_repetitions: 0 };
const r1 = applySM2(base, 4);
assert('repetitions sobe para 1', r1.sm2_repetitions === 1);
assert('interval = 1 (primeira vez)', r1.sm2_interval === 1);
assert('ease_factor ≥ 1.3', r1.sm2_ease_factor >= 1.3);
assert('next_review_at é um Date', r1.next_review_at instanceof Date);

console.log('\n--- applySM2 — segunda repetição correta ---');
const r2 = applySM2(r1, 5);
assert('repetitions sobe para 2', r2.sm2_repetitions === 2);
assert('interval = 6 (segunda vez)', r2.sm2_interval === 6);

console.log('\n--- applySM2 — falha reinicia ---');
const r3 = applySM2(r2, 2);
assert('quality < 3 reinicia repetitions', r3.sm2_repetitions === 0);
assert('quality < 3 reinicia interval para 1', r3.sm2_interval === 1);
assert('next_review_at = amanhã (interval=1)', (() => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const diff = Math.abs(r3.next_review_at.getDate() - tomorrow.getDate());
  return diff === 0;
})());

console.log('\n--- applySM2 — ease_factor mínimo 1.3 ---');
const weakBase = { sm2_ease_factor: 1.3, sm2_interval: 1, sm2_repetitions: 0 };
const rWeak = applySM2(weakBase, 0);
assert('ease_factor nunca abaixo de 1.3', rWeak.sm2_ease_factor >= 1.3);

console.log('\n--- calculateMastery ---');
assert('(80+80)/2 = 80', calculateMastery(80, 80) === 80);
assert('(100+60)/2 = 80', calculateMastery(100, 60) === 80);
assert('arredondamento (70+71)/2 = 71', calculateMastery(70, 71) === 71);

console.log(`\nResultado: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
```

- [ ] **Step 2.2: Executar teste — verificar falha por módulo inexistente**

```bash
node test-sm2.mjs
```

Resultado esperado: erro `Cannot find module './js/sm2.js'`

- [ ] **Step 2.3: Criar js/sm2.js**

```js
// js/sm2.js
// Implementação do algoritmo SuperMemo SM-2 para repetição espaçada adaptativa.
// Módulo puro — sem dependências de DOM ou Supabase. Testável via Node.js.

/**
 * Converte os scores de flashcard e autoavaliação em qualidade SM-2 (0-5).
 * @param {number} flashcardScore - Acertos em flashcards (0-100)
 * @param {number} selfScore - Autoavaliação Feynman (0-100)
 * @returns {number} Qualidade SM-2 de 0 a 5
 */
export function calculateQuality(flashcardScore, selfScore) {
    const avg = (flashcardScore + selfScore) / 2;
    if (avg >= 90) return 5; // perfeito, sem hesitação
    if (avg >= 75) return 4; // correto após leve hesitação
    if (avg >= 60) return 3; // correto mas com dificuldade
    if (avg >= 40) return 2; // errado, mas resposta era recuperável
    if (avg >= 20) return 1; // errado, resposta muito difícil
    return 0;                // blackout total
}

/**
 * Aplica o algoritmo SM-2 ao progresso atual e retorna os campos atualizados.
 * @param {{ sm2_ease_factor: number, sm2_interval: number, sm2_repetitions: number }} progress
 * @param {number} quality - Qualidade SM-2 (0-5) calculada por calculateQuality()
 * @returns {{ sm2_ease_factor: number, sm2_interval: number, sm2_repetitions: number, next_review_at: Date }}
 */
export function applySM2(progress, quality) {
    let { sm2_ease_factor, sm2_interval, sm2_repetitions } = progress;

    if (quality < 3) {
        // Resposta insuficiente — reinicia a sequência.
        // next_review_at = amanhã (intervalo de 1 dia).
        sm2_repetitions = 0;
        sm2_interval = 1;
    } else {
        // Resposta correta — avança a sequência.
        if (sm2_repetitions === 0) {
            sm2_interval = 1;       // 1ª vez certa: revisar amanhã
        } else if (sm2_repetitions === 1) {
            sm2_interval = 6;       // 2ª vez certa: revisar em 6 dias
        } else {
            sm2_interval = Math.round(sm2_interval * sm2_ease_factor); // seguintes: intervalo × fator
        }
        sm2_repetitions += 1;
    }

    // Atualiza fator de facilidade (aplica-se em AMBOS os caminhos)
    sm2_ease_factor = Math.max(
        1.3, // mínimo absoluto do algoritmo SM-2
        sm2_ease_factor + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)
    );

    // Próxima revisão = hoje + sm2_interval dias (sempre no futuro, mínimo amanhã)
    const next_review_at = new Date();
    next_review_at.setDate(next_review_at.getDate() + sm2_interval);

    return { sm2_ease_factor, sm2_interval, sm2_repetitions, next_review_at };
}

/**
 * Calcula a porcentagem de domínio a partir dos dois scores da avaliação.
 * @param {number} flashcardScore - Acertos em flashcards (0-100)
 * @param {number} selfScore - Autoavaliação Feynman (0-100)
 * @returns {number} Porcentagem de domínio (0-100, inteiro)
 */
export function calculateMastery(flashcardScore, selfScore) {
    return Math.round((flashcardScore + selfScore) / 2);
}
```

- [ ] **Step 2.4: Executar teste — verificar aprovação**

```bash
node test-sm2.mjs
```

Resultado esperado:
```
--- calculateQuality ---
  ✅ avg 95 → quality 5
  ✅ avg 80 → quality 4
  ...
Resultado: 16 passed, 0 failed
```

- [ ] **Step 2.5: Deletar arquivo de teste e commitar**

```bash
rm test-sm2.mjs
git add js/sm2.js
git commit -m "feat: add SM-2 spaced repetition algorithm module"
```

---

### Task 3: js/dataService.js — CRUD para Novas Tabelas

**Files:**
- Modify: `js/dataService.js` (substituição completa)

- [ ] **Step 3.1: Substituir js/dataService.js**

Substituir o conteúdo completo do arquivo:

```js
// js/dataService.js
// Camada de acesso a dados: busca conceitos do banco e expõe CRUD
// para todas as tabelas do Motor Brooks v3.
import { supabase } from './supabaseClient.js';

// ─── CONCEITOS (tabela existente, somente leitura) ───────────────────────────

export async function loadConcepts() {
    try {
        const { data, error } = await supabase
            .from('conceitos')
            .select('*')
            .order('id', { ascending: true });

        if (error) throw new Error(`Erro ao buscar conceitos: ${error.message}`);

        return data.map(row => ({
            dbId: row.id,
            id: row.conceito.trim(),
            name: row.conceito.trim(),
            category: row.categoria ? row.categoria.trim() : 'Geral',
            subcategory: row.subcategoria ? row.subcategoria.trim() : '',
            prerequisite: row.prerequisito ? row.prerequisito.trim() : 'Nenhum',
            level: 0,
            macroCategoryStr: row.macro_categoria || '',
            moduloCurso: row.modulo_curso || '',
            conhecimentoAtual: row.conhecimento_atual || 0,
            objetivo: row.objetivo || 10,
            fonteEstudo: row.fonte_estudo || '',
            regrasOperacionais: row.regras_operacionais || '',
            probabilidade: row.probabilidade || '',
            mercadoAplicavel: row.mercado_aplicavel || '',
            notasBD: row.notas || ''
        }));
    } catch (err) {
        console.error('loadConcepts failed:', err);
        return [];
    }
}

// ─── USER_CONCEPT_PROGRESS ────────────────────────────────────────────────────

/**
 * Busca todos os registros de progresso.
 * @returns {Promise<Array>}
 */
export async function getAllProgress() {
    const { data, error } = await supabase
        .from('user_concept_progress')
        .select('*');
    if (error) { console.error('getAllProgress:', error); return []; }
    return data;
}

/**
 * Cria ou atualiza o progresso de um conceito.
 * @param {string} conceitoName
 * @param {Object} fields - campos a atualizar
 */
export async function upsertProgress(conceitoName, fields) {
    const { error } = await supabase
        .from('user_concept_progress')
        .upsert(
            { conceito_name: conceitoName, ...fields, updated_at: new Date().toISOString() },
            { onConflict: 'conceito_name' }
        );
    if (error) console.error('upsertProgress:', error);
}

// ─── CONCEPT_NOTES ────────────────────────────────────────────────────────────

/**
 * Busca todas as notas de todos os conceitos.
 * @returns {Promise<Array>}
 */
export async function getAllNotes() {
    const { data, error } = await supabase
        .from('concept_notes')
        .select('*')
        .order('created_at', { ascending: false });
    if (error) { console.error('getAllNotes:', error); return []; }
    return data;
}

/**
 * Insere uma nova anotação (tipos: Anotação, Dúvida, Pergunta, Questionamento, Observação de Tela).
 * @param {string} conceitoName
 * @param {string} type
 * @param {string} html - conteúdo HTML
 * @param {string} text - conteúdo plain-text para busca
 */
export async function addNote(conceitoName, type, html, text) {
    const { error } = await supabase
        .from('concept_notes')
        .insert({ conceito_name: conceitoName, type, content_html: html, content_text: text });
    if (error) console.error('addNote:', error);
}

/**
 * Cria ou atualiza a Descrição principal do conceito (tipo 'Descrição', único por conceito).
 * Usa ON CONFLICT com o índice partial unique idx_notes_descricao_unique.
 * @param {string} conceitoName
 * @param {string} html
 * @param {string} text
 */
export async function upsertConceptDescription(conceitoName, html, text) {
    // Tenta buscar se já existe uma Descrição
    const { data: existing } = await supabase
        .from('concept_notes')
        .select('id')
        .eq('conceito_name', conceitoName)
        .eq('type', 'Descrição')
        .maybeSingle();

    if (existing) {
        const { error } = await supabase
            .from('concept_notes')
            .update({ content_html: html, content_text: text, updated_at: new Date().toISOString() })
            .eq('id', existing.id);
        if (error) console.error('upsertConceptDescription update:', error);
    } else {
        const { error } = await supabase
            .from('concept_notes')
            .insert({ conceito_name: conceitoName, type: 'Descrição', content_html: html, content_text: text });
        if (error) console.error('upsertConceptDescription insert:', error);
    }
}

// ─── CONCEPT_EVALUATIONS ──────────────────────────────────────────────────────

/**
 * Busca todas as avaliações de todos os conceitos.
 * @returns {Promise<Array>}
 */
export async function getAllEvaluations() {
    const { data, error } = await supabase
        .from('concept_evaluations')
        .select('*')
        .order('created_at', { ascending: false });
    if (error) { console.error('getAllEvaluations:', error); return []; }
    return data;
}

/**
 * Insere uma nova avaliação.
 * @param {string} conceitoName
 * @param {number} flashcardScore - 0-100
 * @param {number} selfScore - autoavaliação Feynman 0-100
 * @param {string} explanation
 * @param {number} masteryAtTime - mastery_percentage no momento da avaliação
 * @param {number} sm2Quality - 0-5
 */
export async function addEvaluation(conceitoName, flashcardScore, selfScore, explanation, masteryAtTime, sm2Quality) {
    const { error } = await supabase
        .from('concept_evaluations')
        .insert({
            conceito_name: conceitoName,
            flashcard_score: flashcardScore,
            self_score: selfScore,
            explanation,
            mastery_at_time: masteryAtTime,
            sm2_quality: sm2Quality
        });
    if (error) console.error('addEvaluation:', error);
}

// ─── STUDY_SESSIONS ───────────────────────────────────────────────────────────

/**
 * Busca todas as sessões com seus conceitos vinculados.
 * @returns {Promise<Array>} Array de sessões com campo conceptIds[]
 */
export async function getAllSessions() {
    const { data: sessions, error: sErr } = await supabase
        .from('study_sessions')
        .select('*')
        .order('scheduled_date', { ascending: true });
    if (sErr) { console.error('getAllSessions:', sErr); return []; }

    const { data: links, error: lErr } = await supabase
        .from('session_concepts')
        .select('session_id, conceito_name');
    if (lErr) { console.error('getAllSessions links:', lErr); return sessions; }

    const linkMap = {};
    links.forEach(l => {
        if (!linkMap[l.session_id]) linkMap[l.session_id] = [];
        linkMap[l.session_id].push(l.conceito_name);
    });

    return sessions.map(s => ({
        id: s.id,
        title: s.title,
        type: s.type,
        date: s.scheduled_date,
        completed: !!s.completed_at,
        completedAt: s.completed_at,
        conceptIds: linkMap[s.id] || []
    }));
}

/**
 * Cria uma nova sessão de estudo e vincula os conceitos.
 * @param {string} title
 * @param {string} type
 * @param {string} date - formato YYYY-MM-DD
 * @param {string[]} conceptNames
 * @returns {Promise<string|null>} ID da sessão criada, ou null em caso de erro
 */
export async function createSession(title, type, date, conceptNames) {
    const { data, error } = await supabase
        .from('study_sessions')
        .insert({ title, type, scheduled_date: date })
        .select('id')
        .single();
    if (error) { console.error('createSession:', error); return null; }

    if (conceptNames.length > 0) {
        const links = conceptNames.map(name => ({ session_id: data.id, conceito_name: name }));
        const { error: lErr } = await supabase.from('session_concepts').insert(links);
        if (lErr) console.error('createSession links:', lErr);
    }

    return data.id;
}

/**
 * Marca ou desmarca uma sessão como concluída.
 * @param {string} sessionId
 * @param {boolean} completed
 */
export async function setSessionCompleted(sessionId, completed) {
    const { error } = await supabase
        .from('study_sessions')
        .update({ completed_at: completed ? new Date().toISOString() : null })
        .eq('id', sessionId);
    if (error) console.error('setSessionCompleted:', error);
}

/**
 * Deleta uma sessão (CASCADE apaga session_concepts automaticamente).
 * @param {string} sessionId
 */
export async function deleteSessionById(sessionId) {
    const { error } = await supabase
        .from('study_sessions')
        .delete()
        .eq('id', sessionId);
    if (error) console.error('deleteSessionById:', error);
}

/**
 * Verifica se já existe algum progresso no Supabase.
 * Usado por migrateIfNeeded() para detectar se a migração já foi feita.
 * @returns {Promise<boolean>}
 */
export async function hasAnyProgress() {
    const { count, error } = await supabase
        .from('user_concept_progress')
        .select('*', { count: 'exact', head: true });
    if (error) return false;
    return (count || 0) > 0;
}
```

- [ ] **Step 3.2: Verificar no browser**

Com o servidor rodando em `localhost:5500`, abrir DevTools → Console e executar:

```js
// Importar e verificar se getAllProgress() funciona
const { getAllProgress } = await import('./js/dataService.js');
const result = await getAllProgress();
console.log('getAllProgress result:', result); // Deve retornar [] (tabela vazia)
```

Resultado esperado: array vazio `[]` sem erros de console.

- [ ] **Step 3.3: Commit**

```bash
git add js/dataService.js
git commit -m "feat: expand dataService with CRUD for all v3 tables"
```

---

### Task 4: js/engine.js — Migração de Dados + Persistência Supabase

**Files:**
- Modify: `js/engine.js` (substituição completa)

- [ ] **Step 4.1: Substituir js/engine.js**

```js
// js/engine.js
// Motor central: mescla dados do DB com progresso, expõe ações de negócio.
// v3: persistência migrada para Supabase. localStorage = cache de Edge Functions.
import { store } from './state.js';
import { loadConcepts, getAllProgress, getAllNotes, getAllEvaluations,
         getAllSessions, upsertProgress, addNote as dbAddNote,
         addEvaluation as dbAddEvaluation, upsertConceptDescription,
         createSession, setSessionCompleted, deleteSessionById,
         hasAnyProgress } from './dataService.js';
import { applySM2, calculateQuality, calculateMastery } from './sm2.js';
import { bustPlanCache } from './daily-plan.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function inferMacroCategory(category, subcategory) {
    const text = `${category} ${subcategory}`.toLowerCase();
    if (text.includes('matemática') || text.includes('probabilidade') || text.includes('risco') ||
        text.includes('alvo') || text.includes('equação') || text.includes('edge'))
        return 'Probabilidades';
    if (text.includes('regra') || text.includes('psicologia') || text.includes('comportamento') ||
        text.includes('gerenciamento') || text.includes('disciplina'))
        return 'Regras';
    if (text.includes('setup') || text.includes('entrada') || text.includes('sinal') ||
        text.includes('padrão') || text.includes('reversão') || text.includes('gatilho') ||
        text.includes('execução') || text.includes('ordem') || text.includes('estratégia'))
        return 'Operacional';
    return 'Fundamento';
}

// ─── Migração única do localStorage para Supabase ────────────────────────────

async function migrateIfNeeded() {
    // Se já há dados no Supabase, migração não é necessária
    if (await hasAnyProgress()) return;

    const raw = localStorage.getItem('brooks_progress_v4');
    if (!raw) return; // Nada a migrar

    console.log('[Migration] Iniciando migração do localStorage para Supabase...');
    const progressMap = JSON.parse(raw);

    for (const [name, data] of Object.entries(progressMap)) {
        // Migra o registro de progresso
        await upsertProgress(name, {
            abc_category:      data.abcCategory || 'C',
            macro_category:    data.macroCategory || 'Fundamento',
            importance:        data.importance || 'Média',
            mastery_percentage: data.masteryPercentage || 0,
            last_studied_at:   data.lastStudied || null,
            next_review_at:    data.nextReview || null,
        });

        // Migra notas (texto plano → HTML simples)
        if (data.notesList && data.notesList.length > 0) {
            for (const note of data.notesList) {
                const html = `<p>${note.text.replace(/\n/g, '</p><p>')}</p>`;
                await dbAddNote(name, note.type, html, note.text);
            }
        }

        // Migra avaliações (quizScore → self_score)
        if (data.evaluations && data.evaluations.length > 0) {
            for (const ev of data.evaluations) {
                const fs = ev.flashcardScore || 0;
                const ss = ev.quizScore || 0; // quizScore mapeado para self_score
                const quality = calculateQuality(fs, ss);
                await dbAddEvaluation(name, fs, ss, ev.explanation || '', ev.masteryPercentage || 0, quality);
            }
        }
    }

    // Migra sessões
    const rawSessions = localStorage.getItem('brooks_sessions_v1');
    if (rawSessions) {
        const sessions = JSON.parse(rawSessions);
        for (const s of sessions) {
            await createSession(s.title, s.type, s.date, s.conceptIds || []);
        }
    }

    localStorage.setItem('v3_migrated', 'true');
    console.log('[Migration] Concluída com sucesso.');
}

// ─── Inicialização ────────────────────────────────────────────────────────────

export async function initializeEngine() {
    // Migrar dados legados se necessário
    await migrateIfNeeded();

    // Carregar tudo do Supabase em paralelo
    const [loadedConcepts, progressData, allNotes, allEvals, sessions] = await Promise.all([
        loadConcepts(),
        getAllProgress(),
        getAllNotes(),
        getAllEvaluations(),
        getAllSessions()
    ]);

    // Indexar por nome para lookup O(1)
    const progressMap = Object.fromEntries(progressData.map(p => [p.conceito_name, p]));

    const notesMap = {};         // conceito_name → anotações avulsas[]
    const descriptionsMap = {};  // conceito_name → nota tipo 'Descrição'
    allNotes.forEach(note => {
        if (note.type === 'Descrição') {
            descriptionsMap[note.conceito_name] = note;
        } else {
            if (!notesMap[note.conceito_name]) notesMap[note.conceito_name] = [];
            notesMap[note.conceito_name].push(note);
        }
    });

    const evalsMap = {};         // conceito_name → avaliações[]
    allEvals.forEach(ev => {
        if (!evalsMap[ev.conceito_name]) evalsMap[ev.conceito_name] = [];
        evalsMap[ev.conceito_name].push(ev);
    });

    // Mesclar dados do DB com progresso salvo
    const finalConcepts = loadedConcepts.map(c => {
        const p = progressMap[c.name] || {};
        return {
            ...c,
            abcCategory:       p.abc_category || 'C',
            macroCategory:     p.macro_category || c.macroCategoryStr || inferMacroCategory(c.category, c.subcategory),
            importance:        p.importance || 'Média',
            masteryPercentage: p.mastery_percentage || 0,
            lastStudied:       p.last_studied_at || '',
            nextReview:        p.next_review_at || '',
            sm2EaseFactor:     p.sm2_ease_factor || 2.5,
            sm2Interval:       p.sm2_interval || 1,
            sm2Repetitions:    p.sm2_repetitions || 0,
            tags:              p.tags || [],
            notesList:         notesMap[c.name] || [],
            description:       descriptionsMap[c.name] || null,
            evaluations:       evalsMap[c.name] || [],
        };
    });

    store.setState({ concepts: finalConcepts, sessions, loading: false });
}

// ─── Ações sobre Conceitos ────────────────────────────────────────────────────

export async function addNote(conceptName, type, text) {
    const html = `<p>${text.replace(/\n/g, '</p><p>')}</p>`;
    await dbAddNote(conceptName, type, html, text);

    const { concepts } = store.getState();
    const newNote = {
        id: Date.now().toString(),
        conceito_name: conceptName,
        type,
        content_html: html,
        content_text: text,
        created_at: new Date().toISOString()
    };
    const updatedConcepts = concepts.map(c => {
        if (c.name !== conceptName) return c;
        return { ...c, notesList: [newNote, ...(c.notesList || [])], lastStudied: new Date().toISOString() };
    });
    store.setState({ concepts: updatedConcepts });

    // Atualiza last_studied_at no Supabase
    await upsertProgress(conceptName, { last_studied_at: new Date().toISOString() });
}

export async function addEvaluation(conceptName, flashcardScore, selfScore, explanation) {
    const { concepts } = store.getState();
    const concept = concepts.find(c => c.name === conceptName);
    if (!concept) return;

    const quality = calculateQuality(flashcardScore, selfScore);
    const mastery = calculateMastery(flashcardScore, selfScore);

    const sm2Result = applySM2({
        sm2_ease_factor: concept.sm2EaseFactor || 2.5,
        sm2_interval:    concept.sm2Interval || 1,
        sm2_repetitions: concept.sm2Repetitions || 0
    }, quality);

    const now = new Date().toISOString();

    // Persiste avaliação no Supabase
    await dbAddEvaluation(conceptName, flashcardScore, selfScore, explanation, mastery, quality);

    // Persiste progresso atualizado no Supabase
    await upsertProgress(conceptName, {
        mastery_percentage: mastery,
        last_studied_at:    now,
        next_review_at:     sm2Result.next_review_at.toISOString(),
        sm2_ease_factor:    sm2Result.sm2_ease_factor,
        sm2_interval:       sm2Result.sm2_interval,
        sm2_repetitions:    sm2Result.sm2_repetitions
    });

    // Invalida cache do plano diário (dados de progresso mudaram)
    bustPlanCache();

    const newEvaluation = {
        id: Date.now().toString(),
        conceito_name: conceptName,
        flashcard_score: flashcardScore,
        self_score: selfScore,
        explanation,
        mastery_at_time: mastery,
        sm2_quality: quality,
        created_at: now
    };

    const updatedConcepts = concepts.map(c => {
        if (c.name !== conceptName) return c;
        return {
            ...c,
            evaluations:       [newEvaluation, ...(c.evaluations || [])],
            masteryPercentage: mastery,
            lastStudied:       now,
            nextReview:        sm2Result.next_review_at.toISOString(),
            sm2EaseFactor:     sm2Result.sm2_ease_factor,
            sm2Interval:       sm2Result.sm2_interval,
            sm2Repetitions:    sm2Result.sm2_repetitions
        };
    });
    store.setState({ concepts: updatedConcepts });
}

export async function updateImportance(conceptName, importance) {
    await upsertProgress(conceptName, { importance });
    const { concepts } = store.getState();
    store.setState({ concepts: concepts.map(c => c.name === conceptName ? { ...c, importance } : c) });
}

export async function updateABC(conceptName, abcCategory) {
    await upsertProgress(conceptName, { abc_category: abcCategory });
    const { concepts } = store.getState();
    store.setState({ concepts: concepts.map(c => c.name === conceptName ? { ...c, abcCategory } : c) });
}

export async function updateMacroCategory(conceptName, macroCategory) {
    await upsertProgress(conceptName, { macro_category: macroCategory });
    const { concepts } = store.getState();
    store.setState({ concepts: concepts.map(c => c.name === conceptName ? { ...c, macroCategory } : c) });
}

export async function updateTags(conceptName, tags) {
    await upsertProgress(conceptName, { tags });
    const { concepts } = store.getState();
    store.setState({ concepts: concepts.map(c => c.name === conceptName ? { ...c, tags } : c) });
}

// ─── Ações sobre Sessões ──────────────────────────────────────────────────────

export async function addSessionAction(title, type, date, conceptNames) {
    const id = await createSession(title, type, date, conceptNames);
    if (!id) return;

    const newSession = { id, title, type, date, completed: false, completedAt: null, conceptIds: conceptNames };
    const { sessions } = store.getState();
    store.setState({ sessions: [newSession, ...sessions] });
}

export async function toggleSessionComplete(sessionId) {
    const { sessions } = store.getState();
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;

    const nowCompleted = !session.completed;
    await setSessionCompleted(sessionId, nowCompleted);
    if (nowCompleted) bustPlanCache();

    store.setState({
        sessions: sessions.map(s =>
            s.id === sessionId ? { ...s, completed: nowCompleted, completedAt: nowCompleted ? new Date().toISOString() : null } : s
        )
    });
}

export async function deleteSession(sessionId) {
    await deleteSessionById(sessionId);
    const { sessions } = store.getState();
    store.setState({ sessions: sessions.filter(s => s.id !== sessionId) });
}

// ─── Seletores (sem mudança) ──────────────────────────────────────────────────

export function getUnlockedConcepts() {
    const { concepts } = store.getState();
    return concepts.filter(c => {
        if (c.prerequisite === 'Nenhum' || !c.prerequisite) return true;
        const prereq = concepts.find(p => p.name === c.prerequisite);
        return prereq && ((prereq.masteryPercentage || 0) >= 50 || prereq.level >= 7);
    });
}

export function getCategoryProgress() {
    const { concepts } = store.getState();
    const categories = Array.from(new Set(concepts.map(c => c.category)));
    return categories.map(cat => {
        const catConcepts = concepts.filter(c => c.category === cat);
        const totalMastery = catConcepts.reduce((sum, c) => sum + (c.masteryPercentage || 0), 0);
        const maxMastery = catConcepts.length * 100;
        return {
            category: cat,
            progress: maxMastery > 0 ? (totalMastery / maxMastery) * 100 : 0,
            completed: catConcepts.filter(c => (c.masteryPercentage || 0) >= 85).length,
            total: catConcepts.length
        };
    });
}
```

- [ ] **Step 4.2: Criar js/daily-plan.js (stub mínimo — necessário para engine.js importar)**

O engine.js importa `bustPlanCache` de `daily-plan.js`. Criar o módulo agora com a implementação completa do cache:

```js
// js/daily-plan.js
// Cache local e fetch das Edge Functions de inteligência.

const CACHE_KEYS = {
    gaps:    'mb_cache_gaps',
    plan:    'mb_cache_plan',
    tsGaps:  'mb_cache_ts_gaps',
    tsPlan:  'mb_cache_ts_plan',
};

const SUPABASE_URL = 'https://jebbklacmrxrhbajweug.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImplYmJrbGFjbXJ4cmhiYWp3ZXVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyMzgwOTcsImV4cCI6MjA4ODgxNDA5N30.-41Xg5zhF2hHiTJ3BUoT3TiL5LYwkhwzKfUUhTTUJks';
const TTL_MS = 60 * 60 * 1000; // 1 hora

/**
 * Verifica se o cache ainda é válido.
 * @param {string} tsKey - chave do timestamp no localStorage
 * @returns {boolean}
 */
export function isCacheValid(tsKey) {
    const ts = localStorage.getItem(tsKey);
    if (!ts) return false;
    return (Date.now() - new Date(ts).getTime()) < TTL_MS;
}

/**
 * Invalida o cache do plano diário e do gap analysis.
 * Deve ser chamado sempre que o progresso do usuário mudar.
 */
export function bustPlanCache() {
    Object.values(CACHE_KEYS).forEach(k => localStorage.removeItem(k));
}

/**
 * Busca o gap analysis da Edge Function (com cache de 1h).
 * @returns {Promise<Object|null>}
 */
export async function fetchGapAnalysis() {
    if (isCacheValid(CACHE_KEYS.tsGaps)) {
        const cached = localStorage.getItem(CACHE_KEYS.gaps);
        if (cached) return JSON.parse(cached);
    }

    try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/analyze-gaps`, {
            headers: { Authorization: `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' }
        });
        if (!res.ok) throw new Error(`analyze-gaps: ${res.status}`);
        const data = await res.json();
        localStorage.setItem(CACHE_KEYS.gaps, JSON.stringify(data));
        localStorage.setItem(CACHE_KEYS.tsGaps, new Date().toISOString());
        return data;
    } catch (err) {
        console.error('fetchGapAnalysis failed:', err);
        return null;
    }
}

/**
 * Busca o plano diário da Edge Function (com cache de 1h).
 * @returns {Promise<Object|null>}
 */
export async function fetchDailyPlan() {
    if (isCacheValid(CACHE_KEYS.tsPlan)) {
        const cached = localStorage.getItem(CACHE_KEYS.plan);
        if (cached) return JSON.parse(cached);
    }

    try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/generate-daily-plan`, {
            headers: { Authorization: `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' }
        });
        if (!res.ok) throw new Error(`generate-daily-plan: ${res.status}`);
        const data = await res.json();
        localStorage.setItem(CACHE_KEYS.plan, JSON.stringify(data));
        localStorage.setItem(CACHE_KEYS.tsPlan, new Date().toISOString());
        return data;
    } catch (err) {
        console.error('fetchDailyPlan failed:', err);
        return null;
    }
}
```

- [ ] **Step 4.3: Verificar no browser — app deve carregar sem erros**

Abrir `localhost:5500`. Verificar no console:
- Não deve aparecer erros de importação
- Deve aparecer `[Migration] Iniciando migração...` (se havia dados no localStorage) ou nenhuma mensagem de migração (se tabela já tinha dados)
- O app deve carregar normalmente

- [ ] **Step 4.4: Verificar dados no Supabase após migração**

No console do browser:
```js
const { getAllProgress } = await import('./js/dataService.js');
const p = await getAllProgress();
console.log(`Progresso migrado: ${p.length} conceitos`);
```

Resultado esperado: número maior que 0 se havia localStorage, 0 se era instância limpa.

- [ ] **Step 4.5: Commit**

```bash
git add js/engine.js js/daily-plan.js
git commit -m "feat: migrate engine to supabase persistence + SM-2 integration"
```

---

## Chunk 2: Tags + Editor Rico (Tiptap)

---

### Task 5: js/tags.js + concept-detail.js — Sistema de Tags

**Files:**
- Create: `js/tags.js`
- Modify: `js/concept-detail.js` (adicionar pills de tags + atualizar form de avaliação)

- [ ] **Step 5.1: Criar js/tags.js**

```js
// js/tags.js
// Sistema de tags para conceitos: definições, renderização e toggle.
import { updateTags } from './engine.js';

/** Definição canônica das tags disponíveis. */
export const AVAILABLE_TAGS = [
    {
        id: 'knowledge_only',
        label: 'Só Conhecimento',
        icon: '📖',
        activeClasses: 'bg-zinc-200 text-zinc-700 border-zinc-400',
        inactiveClasses: 'border-dashed border-zinc-300 text-zinc-400 hover:border-zinc-400'
    },
    {
        id: 'needs_review',
        label: 'Revisar Urgente',
        icon: '🚩',
        activeClasses: 'bg-red-600/10 text-red-700 border-red-500',
        inactiveClasses: 'border-dashed border-zinc-300 text-zinc-400 hover:border-red-300'
    },
    {
        id: 'priority_high',
        label: 'Alta Prioridade',
        icon: '🔥',
        activeClasses: 'bg-orange-100 text-orange-700 border-orange-400',
        inactiveClasses: 'border-dashed border-zinc-300 text-zinc-400 hover:border-orange-300'
    },
    {
        id: 'favorite',
        label: 'Favorito',
        icon: '⭐',
        activeClasses: 'bg-amber-100 text-amber-700 border-amber-400',
        inactiveClasses: 'border-dashed border-zinc-300 text-zinc-400 hover:border-amber-300'
    }
];

/**
 * Renderiza as pills de tags para um conceito.
 * @param {string[]} activeTags - array de IDs de tags ativas no conceito
 * @returns {string} HTML das pills
 */
export function renderTagPills(activeTags = []) {
    return AVAILABLE_TAGS.map(tag => {
        const isActive = activeTags.includes(tag.id);
        const classes = isActive ? tag.activeClasses : tag.inactiveClasses;
        return `
            <button
                class="tag-pill flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${classes}"
                data-tag-id="${tag.id}"
                title="${isActive ? 'Remover tag' : 'Adicionar tag'}"
            >
                ${tag.icon} ${tag.label}
            </button>
        `;
    }).join('');
}

/**
 * Registra os event listeners das pills de tags num container.
 * @param {HTMLElement} container - elemento contendo as pills
 * @param {string} conceptName
 * @param {string[]} currentTags
 */
export function attachTagListeners(container, conceptName, currentTags) {
    container.querySelectorAll('.tag-pill').forEach(btn => {
        btn.addEventListener('click', async () => {
            const tagId = btn.getAttribute('data-tag-id');
            const newTags = currentTags.includes(tagId)
                ? currentTags.filter(t => t !== tagId)
                : [...currentTags, tagId];
            await updateTags(conceptName, newTags);
        });
    });
}
```

- [ ] **Step 5.2: Atualizar js/concept-detail.js — adicionar tags + renomear quizScore → selfScore**

Localizar e substituir o bloco dos três `<select>` no header do conceito (lines contendo `macroSelect`, `importanceSelect`, `abcSelect`). Adicionar o bloco de tags logo abaixo:

Encontrar esta seção no HTML gerado (dentro da string de template em `renderConceptDetail`):

```js
          <div class="flex flex-wrap items-center gap-3 w-full md:w-auto">
```

E substituir o bloco completo da `<div class="flex flex-wrap items-center gap-3 ...">` até o fechamento que inclui os três selects, adicionando o bloco de tags:

```js
          <div class="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <div class="flex-1 md:flex-none flex items-center gap-2 bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2">
              <i data-lucide="layers" class="w-4 h-4 text-zinc-500 shrink-0"></i>
              <select id="macroSelect" class="bg-transparent text-sm text-zinc-700 focus:outline-none cursor-pointer w-full">
                <option value="Fundamento" ${concept.macroCategory === 'Fundamento' ? 'selected' : ''}>Classe: Fundamento</option>
                <option value="Operacional" ${concept.macroCategory === 'Operacional' ? 'selected' : ''}>Classe: Operacional</option>
                <option value="Regras" ${concept.macroCategory === 'Regras' ? 'selected' : ''}>Classe: Regras</option>
                <option value="Probabilidades" ${concept.macroCategory === 'Probabilidades' ? 'selected' : ''}>Classe: Probabilidades</option>
                <option value="Outros" ${concept.macroCategory === 'Outros' ? 'selected' : ''}>Classe: Outros</option>
              </select>
            </div>

            <div class="flex-1 md:flex-none flex items-center gap-2 bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2">
              <i data-lucide="tag" class="w-4 h-4 text-zinc-500 shrink-0"></i>
              <select id="importanceSelect" class="bg-transparent text-sm text-zinc-700 focus:outline-none cursor-pointer w-full">
                <option value="Baixa" ${concept.importance === 'Baixa' ? 'selected' : ''}>Importância: Baixa</option>
                <option value="Média" ${concept.importance === 'Média' ? 'selected' : ''}>Importância: Média</option>
                <option value="Alta" ${concept.importance === 'Alta' ? 'selected' : ''}>Importância: Alta</option>
              </select>
            </div>

            <div class="flex-1 md:flex-none flex items-center gap-2 bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2">
              <div class="w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold shrink-0 bg-white border border-zinc-200 ${categoryColor}">
                ${category}
              </div>
              <select id="abcSelect" class="bg-transparent text-sm text-zinc-700 focus:outline-none cursor-pointer w-full">
                <option value="A" ${category === 'A' ? 'selected' : ''}>Categoria ABC: A</option>
                <option value="B" ${category === 'B' ? 'selected' : ''}>Categoria ABC: B</option>
                <option value="C" ${category === 'C' ? 'selected' : ''}>Categoria ABC: C</option>
              </select>
            </div>
          </div>
```

Logo abaixo do fechamento `</div>` da coluna de selects e ANTES do fechamento do `<div class="flex flex-col md:flex-row ...">`, adicionar:

```js
        <div class="w-full mt-4 flex flex-wrap items-center gap-2" id="tag-pills-container">
          <span class="text-xs font-semibold text-zinc-500 uppercase tracking-wider mr-1">Tags:</span>
          ${renderTagPills(concept.tags || [])}
        </div>
```

- [ ] **Step 5.3: Adicionar import de tags no topo de concept-detail.js**

No topo do arquivo `js/concept-detail.js`, adicionar:

```js
import { renderTagPills, attachTagListeners } from './tags.js';
import { updateTags } from './engine.js';
```

- [ ] **Step 5.4: Adicionar listener de tags após os outros listeners no final de renderConceptDetail**

Após a linha `document.getElementById('abcSelect')?.addEventListener(...)`, adicionar:

```js
    // Tags
    const tagPillsContainer = document.getElementById('tag-pills-container');
    if (tagPillsContainer) {
        attachTagListeners(tagPillsContainer, concept.name, concept.tags || []);
    }
```

- [ ] **Step 5.5: Atualizar form de avaliação — renomear quizScore para selfScore**

No `renderEvalTab()`, alterar:

```js
// ANTES:
          <label class="block text-sm font-medium text-zinc-700 mb-2">Acertos no Questionário (%)</label>
          <input
            id="quizScore"
// ...
// DEPOIS:
          <label class="block text-sm font-medium text-zinc-700 mb-2">Autoavaliação — Técnica de Feynman (%)</label>
          <p class="text-xs text-zinc-400 mb-2">0 = não conseguiu explicar | 100 = explicou com total clareza e sem hesitação</p>
          <input
            id="selfScore"
```

E nos event listeners do form de avaliação, substituir todas as referências `quizScore` por `selfScore`:

```js
// ANTES:
        const qsEl = document.getElementById('quizScore');
// DEPOIS:
        const qsEl = document.getElementById('selfScore');
```

E na chamada de `addEvaluation`:
```js
// ANTES:
                addEvaluation(concept.name, fs, qs, expl);
// DEPOIS:
                addEvaluation(concept.name, fs, qs, expl); // qs agora é selfScore
```

- [ ] **Step 5.6: Verificar no browser**

1. Abrir `localhost:5500`
2. Clicar em qualquer conceito → verificar pills de tags abaixo dos selects
3. Clicar em "📖 Só Conhecimento" → deve ficar colorida
4. Recarregar a página → abrir o mesmo conceito → a tag deve persistir (vinda do Supabase)
5. Na aba "Autoavaliação", verificar que o label mudou para "Técnica de Feynman"

- [ ] **Step 5.7: Commit**

```bash
git add js/tags.js js/concept-detail.js
git commit -m "feat: add concept tags system (knowledge_only, needs_review, etc.)"
```

---

### Task 6: Editor Rico Tiptap — Descrição do Conceito

**Files:**
- Modify: `index.html` (adicionar CDN scripts)
- Create: `js/rich-editor.js`
- Modify: `js/concept-detail.js` (adicionar BLOCO A)
- Modify: `css/markdown-styles.css` (adicionar estilos do editor)

- [ ] **Step 6.1: Adicionar scripts Tiptap no index.html**

Dentro do `<head>`, antes do `<link rel="stylesheet" href="./css/style.css" />`, adicionar:

```html
  <!-- Tiptap Rich Text Editor — versões fixadas -->
  <script src="https://cdn.jsdelivr.net/npm/@tiptap/core@2.11.5/dist/tiptap-core.umd.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/@tiptap/starter-kit@2.11.5/dist/tiptap-starter-kit.umd.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/@tiptap/extension-highlight@2.3.2/dist/tiptap-extension-highlight.umd.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/@tiptap/extension-placeholder@2.11.5/dist/tiptap-extension-placeholder.umd.min.js"></script>
```

- [ ] **Step 6.2: Criar js/rich-editor.js**

```js
// js/rich-editor.js
// Wrapper do editor Tiptap para uso no concept-detail.
// Requer que os scripts CDN do Tiptap estejam carregados no index.html.

/**
 * Inicializa um editor Tiptap num elemento DOM.
 * @param {string} containerId - ID do elemento container
 * @param {string} initialHtml - conteúdo HTML inicial
 * @param {function} onUpdate - callback(html, text) chamado com debounce de 1500ms
 * @returns {Object} instância do editor Tiptap
 */
export function createRichEditor(containerId, initialHtml, onUpdate) {
    const el = document.getElementById(containerId);
    if (!el) { console.error(`rich-editor: elemento #${containerId} não encontrado`); return null; }

    const { Editor, StarterKit, Highlight, Placeholder } = getExtensions();
    if (!Editor) {
        el.innerHTML = `<p class="text-red-500 text-sm">Editor não carregado. Verifique os scripts CDN do Tiptap.</p>`;
        return null;
    }

    let saveTimeout;

    const editor = new Editor({
        element: el,
        extensions: [
            StarterKit,
            Highlight.configure({ multicolor: false }),
            Placeholder.configure({
                placeholder: 'Escreva sua análise, regras e observações sobre este conceito...'
            })
        ],
        content: initialHtml || '',
        editorProps: {
            attributes: { class: 'tiptap-editor focus:outline-none min-h-[150px] prose prose-sm max-w-none p-4' }
        },
        onUpdate({ editor }) {
            clearTimeout(saveTimeout);
            saveTimeout = setTimeout(() => {
                const html = editor.getHTML();
                const text = editor.getText();
                onUpdate(html, text);
            }, 1500);
        }
    });

    return editor;
}

/**
 * Renderiza o toolbar flutuante ao selecionar texto.
 * @param {Object} editor - instância Tiptap
 * @param {HTMLElement} toolbarEl - elemento da toolbar
 */
export function attachFloatingToolbar(editor, toolbarEl) {
    editor.on('selectionUpdate', ({ editor: ed }) => {
        const { from, to } = ed.state.selection;
        if (from === to) {
            toolbarEl.style.display = 'none';
            return;
        }

        // Posicionar toolbar acima da seleção
        const view = ed.view;
        const start = view.coordsAtPos(from);
        const containerRect = toolbarEl.parentElement.getBoundingClientRect();

        toolbarEl.style.display = 'flex';
        toolbarEl.style.position = 'absolute';
        toolbarEl.style.top = `${start.top - containerRect.top - 44}px`;
        toolbarEl.style.left = `${start.left - containerRect.left}px`;
        toolbarEl.style.zIndex = '100';
    });

    editor.on('blur', () => { setTimeout(() => { toolbarEl.style.display = 'none'; }, 150); });
}

function getExtensions() {
    return {
        Editor: window.tiptapCore?.Editor,
        StarterKit: window.tiptapStarterKit?.StarterKit,
        Highlight: window.tiptapExtensionHighlight?.Highlight,
        Placeholder: window.tiptapExtensionPlaceholder?.Placeholder
    };
}
```

- [ ] **Step 6.3: Adicionar estilos do editor em css/markdown-styles.css**

Adicionar ao final do arquivo `css/markdown-styles.css`:

```css
/* ── Tiptap Rich Editor ────────────────────────────────────────── */
.tiptap-editor {
  outline: none;
  line-height: 1.7;
}

.tiptap-editor p { margin-bottom: 0.5rem; }
.tiptap-editor h1 { font-size: 1.5rem; font-weight: 700; margin-bottom: 0.75rem; }
.tiptap-editor h2 { font-size: 1.25rem; font-weight: 600; margin-bottom: 0.5rem; }
.tiptap-editor ul { list-style: disc; padding-left: 1.5rem; margin-bottom: 0.5rem; }
.tiptap-editor ol { list-style: decimal; padding-left: 1.5rem; margin-bottom: 0.5rem; }
.tiptap-editor strong { font-weight: 700; }
.tiptap-editor em { font-style: italic; }
.tiptap-editor s { text-decoration: line-through; }
.tiptap-editor mark { background-color: #fef08a; padding: 0.1em 0.2em; border-radius: 3px; }
.tiptap-editor blockquote { border-left: 3px solid #d1d5db; padding-left: 1rem; color: #6b7280; margin: 0.5rem 0; }

/* Placeholder */
.tiptap-editor p.is-editor-empty:first-child::before {
  color: #9ca3af;
  content: attr(data-placeholder);
  float: left;
  height: 0;
  pointer-events: none;
}

/* Toolbar flutuante */
.rich-toolbar {
  display: none;
  align-items: center;
  gap: 2px;
  background: #18181b;
  border-radius: 8px;
  padding: 4px 6px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.25);
}

.rich-toolbar button {
  color: #f4f4f5;
  background: transparent;
  border: none;
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}

.rich-toolbar button:hover { background: #3f3f46; }
.rich-toolbar button.is-active { background: #10b981; color: white; }
.rich-toolbar .toolbar-sep { width: 1px; height: 16px; background: #3f3f46; margin: 0 2px; }
```

- [ ] **Step 6.4: Atualizar concept-detail.js — adicionar BLOCO A (editor rico)**

No topo do arquivo, adicionar import:

```js
import { createRichEditor, attachFloatingToolbar } from './rich-editor.js';
import { upsertConceptDescription } from './engine.js';
```

No início da função `renderConceptDetail`, antes do `container.innerHTML = ...`, guardar o estado do editor se necessário. Depois do `container.innerHTML = ...`, adicionar o BLOCO A logo antes da aba de anotações.

Substituir o div `<div class="min-h-[400px]" id="tab-content-area">` para incluir o BLOCO A sempre visível acima das abas:

Antes do bloco das abas (identificado por `<div class="flex gap-6 mb-8 border-b ...`), adicionar:

```js
      <!-- BLOCO A: Descrição Rico (sempre visível) -->
      <div class="bg-white border border-zinc-200 rounded-3xl mb-8 overflow-hidden shadow-sm">
        <div class="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
          <h3 class="text-base font-semibold text-zinc-800 flex items-center gap-2">
            <i data-lucide="file-text" class="w-4 h-4 text-emerald-500"></i>
            Descrição do Conceito
          </h3>
          <span id="save-indicator" class="text-xs text-emerald-500 font-medium opacity-0 transition-opacity duration-300">Salvo ✓</span>
        </div>
        <!-- Toolbar flutuante do editor -->
        <div class="relative">
          <div class="rich-toolbar" id="rich-toolbar">
            <button data-action="bold" title="Negrito"><b>B</b></button>
            <button data-action="italic" title="Itálico"><i>I</i></button>
            <button data-action="strike" title="Tachado"><s>S</s></button>
            <div class="toolbar-sep"></div>
            <button data-action="h1" title="Título 1">H1</button>
            <button data-action="h2" title="Título 2">H2</button>
            <div class="toolbar-sep"></div>
            <button data-action="highlight" title="Destaque">==</button>
            <button data-action="bulletList" title="Lista">•</button>
            <button data-action="orderedList" title="Lista numerada">1.</button>
          </div>
          <div id="rich-editor-container" class="min-h-[160px]"></div>
        </div>
      </div>
```

- [ ] **Step 6.5: Inicializar o editor após renderização**

No bloco de inicialização do `renderConceptDetail` (após o `if (window.lucide) window.lucide.createIcons();`), adicionar:

```js
    // ── BLOCO A: Editor Rico ──────────────────────────────────────────────────
    const editorContainer = document.getElementById('rich-editor-container');
    if (editorContainer && window.tiptapCore) {
        const initialHtml = concept.description?.content_html || '';
        const toolbarEl = document.getElementById('rich-toolbar');
        let saveTimeout;

        const editor = createRichEditor('rich-editor-container', initialHtml, async (html, text) => {
            await upsertConceptDescription(concept.name, html, text);
            const indicator = document.getElementById('save-indicator');
            if (indicator) {
                indicator.style.opacity = '1';
                setTimeout(() => { indicator.style.opacity = '0'; }, 2000);
            }
        });

        if (editor && toolbarEl) {
            attachFloatingToolbar(editor, toolbarEl);

            // Botões da toolbar
            toolbarEl.querySelectorAll('button[data-action]').forEach(btn => {
                btn.addEventListener('mousedown', (e) => {
                    e.preventDefault(); // evita perda de foco no editor
                    const action = btn.getAttribute('data-action');
                    switch (action) {
                        case 'bold':        editor.chain().focus().toggleBold().run(); break;
                        case 'italic':      editor.chain().focus().toggleItalic().run(); break;
                        case 'strike':      editor.chain().focus().toggleStrike().run(); break;
                        case 'h1':          editor.chain().focus().toggleHeading({ level: 1 }).run(); break;
                        case 'h2':          editor.chain().focus().toggleHeading({ level: 2 }).run(); break;
                        case 'highlight':   editor.chain().focus().toggleHighlight().run(); break;
                        case 'bulletList':  editor.chain().focus().toggleBulletList().run(); break;
                        case 'orderedList': editor.chain().focus().toggleOrderedList().run(); break;
                    }
                });
            });
        }
    }
```

- [ ] **Step 6.6: Verificar no browser**

1. Abrir `localhost:5500` → clicar em qualquer conceito
2. Verificar que o bloco "Descrição do Conceito" aparece acima das abas
3. Digitar algo no editor → aguardar 1.5s → verificar "Salvo ✓" aparece
4. Selecionar texto → verificar toolbar flutuante aparece
5. Clicar em **B** → texto deve ficar em negrito
6. Clicar em `==` → texto deve ficar destacado em amarelo
7. Recarregar e reabrir o conceito → conteúdo deve persistir (vindo do Supabase)

- [ ] **Step 6.7: Commit**

```bash
git add index.html js/rich-editor.js js/concept-detail.js css/markdown-styles.css
git commit -m "feat: add rich text editor (Tiptap) for concept descriptions"
```

---

## Chunk 3: Intelligence Engine — Edge Functions + Dashboard

---

### Task 7: Edge Function analyze-gaps

**Files:**
- Create: `supabase/functions/analyze-gaps/index.ts`

- [ ] **Step 7.1: Criar arquivo da Edge Function**

Criar `supabase/functions/analyze-gaps/index.ts`:

```typescript
// supabase/functions/analyze-gaps/index.ts
// Analisa o progresso do usuário e retorna gaps críticos de aprendizado.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'authorization, content-type',
            }
        });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. weakCategories: macro-categorias com média de domínio abaixo de 60%
    const { data: allProgress } = await supabase
        .from('user_concept_progress')
        .select('macro_category, mastery_percentage, tags, conceito_name, last_studied_at');

    const activeProgress = (allProgress || []).filter(p => !p.tags?.includes('knowledge_only'));

    // Agrupar por macro_category
    const macroMap: Record<string, number[]> = {};
    activeProgress.forEach(p => {
        const macro = p.macro_category || 'Fundamento';
        if (!macroMap[macro]) macroMap[macro] = [];
        macroMap[macro].push(p.mastery_percentage || 0);
    });

    const weakCategories = Object.entries(macroMap)
        .map(([name, masteries]) => ({
            name,
            healthScore: Math.round(masteries.reduce((a, b) => a + b, 0) / masteries.length),
            conceptsBelow50: masteries.filter(m => m < 50).length
        }))
        .filter(c => c.healthScore < 60)
        .sort((a, b) => a.healthScore - b.healthScore)
        .slice(0, 3);

    // 2. neglectedConcepts: estudados há mais de 30 dias sem domínio completo
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const neglectedConcepts = activeProgress
        .filter(p => {
            if ((p.mastery_percentage || 0) >= 85) return false;
            if (!p.last_studied_at) return true;
            return new Date(p.last_studied_at) < thirtyDaysAgo;
        })
        .sort((a, b) => {
            if (!a.last_studied_at) return -1;
            if (!b.last_studied_at) return 1;
            return new Date(a.last_studied_at).getTime() - new Date(b.last_studied_at).getTime();
        })
        .slice(0, 5)
        .map(p => ({
            name: p.conceito_name,
            lastStudied: p.last_studied_at,
            daysSince: p.last_studied_at
                ? Math.floor((Date.now() - new Date(p.last_studied_at).getTime()) / 86400000)
                : null
        }));

    // 3. prerequisiteGaps: conceitos cujo pré-requisito não foi dominado
    const { data: conceitos } = await supabase
        .from('conceitos')
        .select('conceito, prerequisito')
        .not('prerequisito', 'is', null)
        .neq('prerequisito', 'Nenhum');

    const progressByName: Record<string, number> = {};
    activeProgress.forEach(p => { progressByName[p.conceito_name] = p.mastery_percentage || 0; });

    const prerequisiteGaps = (conceitos || [])
        .filter(c => {
            const prereqMastery = progressByName[c.prerequisito] ?? 0;
            const selfMastery = progressByName[c.conceito] ?? 0;
            return prereqMastery < 50 && selfMastery < 85;
        })
        .slice(0, 5)
        .map(c => ({
            concept: c.conceito,
            prerequisite: c.prerequisito,
            prereqMastery: progressByName[c.prerequisito] ?? 0
        }));

    // 4. overallHealth: média geral de domínio (%)
    const overallHealth = activeProgress.length > 0
        ? Math.round(activeProgress.reduce((sum, p) => sum + (p.mastery_percentage || 0), 0) / activeProgress.length)
        : 0;

    const result = { weakCategories, neglectedConcepts, prerequisiteGaps, overallHealth };

    return new Response(JSON.stringify(result), {
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        }
    });
});
```

- [ ] **Step 7.2: Deployar a Edge Function via Supabase MCP**

Usar a ferramenta MCP `deploy_edge_function` com:
- `project_id`: `jebbklacmrxrhbajweug`
- `name`: `analyze-gaps`
- `verify_jwt`: `false` (single-user, sem auth)
- `files`: o arquivo acima

- [ ] **Step 7.3: Testar a Edge Function no browser**

No console do browser (`localhost:5500`):

```js
const res = await fetch('https://jebbklacmrxrhbajweug.supabase.co/functions/v1/analyze-gaps', {
    headers: { Authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImplYmJrbGFjbXJ4cmhiYWp3ZXVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyMzgwOTcsImV4cCI6MjA4ODgxNDA5N30.-41Xg5zhF2hHiTJ3BUoT3TiL5LYwkhwzKfUUhTTUJks' }
});
const data = await res.json();
console.log('Gap analysis:', JSON.stringify(data, null, 2));
```

Resultado esperado: objeto JSON com `weakCategories`, `neglectedConcepts`, `prerequisiteGaps`, `overallHealth`.

- [ ] **Step 7.4: Commit**

```bash
git add supabase/functions/analyze-gaps/index.ts
git commit -m "feat: add analyze-gaps edge function for intelligent study recommendations"
```

---

### Task 8: Edge Function generate-daily-plan

**Files:**
- Create: `supabase/functions/generate-daily-plan/index.ts`

- [ ] **Step 8.1: Criar arquivo da Edge Function**

Criar `supabase/functions/generate-daily-plan/index.ts`:

```typescript
// supabase/functions/generate-daily-plan/index.ts
// Gera o plano de estudo diário inteligente com até 8 conceitos priorizados.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function estimateMinutes(mastery: number): number {
    if (mastery >= 70) return 5;
    if (mastery >= 40) return 10;
    return 20;
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'authorization, content-type',
            }
        });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: allProgress } = await supabase
        .from('user_concept_progress')
        .select('conceito_name, mastery_percentage, next_review_at, tags, last_studied_at');

    const active = (allProgress || []).filter(p => !p.tags?.includes('knowledge_only'));
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    const plan: Array<{
        conceito_name: string;
        reason: string;
        mastery: number;
        estimatedMinutes: number;
    }> = [];
    const added = new Set<string>();

    // SLOT 0: Conceitos com tag needs_review (máx. 2)
    const needsReview = active
        .filter(p => p.tags?.includes('needs_review'))
        .sort((a, b) => (a.mastery_percentage || 0) - (b.mastery_percentage || 0))
        .slice(0, 2);

    needsReview.forEach(p => {
        plan.push({ conceito_name: p.conceito_name, reason: 'needs_review_tag', mastery: p.mastery_percentage || 0, estimatedMinutes: estimateMinutes(p.mastery_percentage || 0) });
        added.add(p.conceito_name);
    });

    // SLOT 1: Revisões SM-2 devidas (máx. 5 - count(slot0))
    const slot1Limit = 5 - plan.length;
    const sm2Due = active
        .filter(p => !added.has(p.conceito_name) && p.next_review_at && p.next_review_at.split('T')[0] <= today)
        .sort((a, b) => {
            const dateA = a.next_review_at || '9999';
            const dateB = b.next_review_at || '9999';
            if (dateA !== dateB) return dateA.localeCompare(dateB);
            return (a.mastery_percentage || 0) - (b.mastery_percentage || 0);
        })
        .slice(0, slot1Limit);

    sm2Due.forEach(p => {
        plan.push({ conceito_name: p.conceito_name, reason: 'sm2_due', mastery: p.mastery_percentage || 0, estimatedMinutes: estimateMinutes(p.mastery_percentage || 0) });
        added.add(p.conceito_name);
    });

    // SLOT 2: Gaps críticos (máx. 2 total, de prerequisiteGaps + weakCategories)
    if (plan.length < 7) {
        // Conceitos com mastery baixa que ainda não estão no plano
        const gapCandidates = active
            .filter(p => !added.has(p.conceito_name) && (p.mastery_percentage || 0) < 50)
            .sort((a, b) => (a.mastery_percentage || 0) - (b.mastery_percentage || 0))
            .slice(0, 2);

        gapCandidates.forEach(p => {
            if (plan.length < 7) {
                plan.push({ conceito_name: p.conceito_name, reason: 'gap_critical', mastery: p.mastery_percentage || 0, estimatedMinutes: estimateMinutes(p.mastery_percentage || 0) });
                added.add(p.conceito_name);
            }
        });
    }

    // SLOT 3: Conceito novo (1 vaga, se total < 8)
    if (plan.length < 8) {
        const { data: conceitos } = await supabase
            .from('conceitos')
            .select('conceito, prerequisito')
            .order('id', { ascending: true });

        const masteryByName: Record<string, number> = {};
        active.forEach(p => { masteryByName[p.conceito_name] = p.mastery_percentage || 0; });

        const newConcept = (conceitos || []).find(c => {
            if (added.has(c.conceito)) return false;
            if ((masteryByName[c.conceito] || 0) > 0) return false;
            if (!c.prerequisito || c.prerequisito === 'Nenhum') return true;
            return (masteryByName[c.prerequisito] || 0) >= 50;
        });

        if (newConcept) {
            plan.push({ conceito_name: newConcept.conceito, reason: 'new_concept', mastery: 0, estimatedMinutes: 20 });
        }
    }

    const totalEstimatedMinutes = plan.reduce((sum, p) => sum + p.estimatedMinutes, 0);

    return new Response(JSON.stringify({ plan, totalEstimatedMinutes, generatedAt: new Date().toISOString() }), {
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        }
    });
});
```

- [ ] **Step 8.2: Deployar a Edge Function via Supabase MCP**

Usar a ferramenta MCP `deploy_edge_function` com:
- `project_id`: `jebbklacmrxrhbajweug`
- `name`: `generate-daily-plan`
- `verify_jwt`: `false`
- `files`: o arquivo acima

- [ ] **Step 8.3: Testar a Edge Function no browser**

```js
const res = await fetch('https://jebbklacmrxrhbajweug.supabase.co/functions/v1/generate-daily-plan', {
    headers: { Authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImplYmJrbGFjbXJ4cmhiYWp3ZXVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyMzgwOTcsImV4cCI6MjA4ODgxNDA5N30.-41Xg5zhF2hHiTJ3BUoT3TiL5LYwkhwzKfUUhTTUJks' }
});
const data = await res.json();
console.log('Daily plan:', JSON.stringify(data, null, 2));
```

Resultado esperado: `{ plan: [...], totalEstimatedMinutes: N, generatedAt: "..." }` com pelo menos 1 item no plano.

- [ ] **Step 8.4: Commit**

```bash
git add supabase/functions/generate-daily-plan/index.ts
git commit -m "feat: add generate-daily-plan edge function with SM-2 and gap logic"
```

---

### Task 9: dashboard.js — Plano Diário + Prontidão Operacional

**Files:**
- Modify: `js/dashboard.js`

- [ ] **Step 9.1: Atualizar js/dashboard.js**

Adicionar import no topo:
```js
import { fetchDailyPlan, fetchGapAnalysis } from './daily-plan.js';
```

Substituir a função `renderDashboard` para torná-la async e adicionar os dois novos blocos. As mudanças principais:

**1. Tornar a função async e buscar o plano diário:**

```js
export async function renderDashboard(container, state) {
    // ... (código existente dos filtros e stats)

    // Buscar plano diário (com cache)
    const dailyPlan = await fetchDailyPlan();
    const gapAnalysis = await fetchGapAnalysis();

    // ... renderizar HTML com os novos blocos
}
```

**2. Substituir o bloco "Sessão Recomendada" pelo Plano Diário Inteligente:**

Remover o bloco `${todaysSession.length > 0 ? ...}` e substituir por:

```js
      ${dailyPlan && dailyPlan.plan && dailyPlan.plan.length > 0 ? `
        <div class="relative overflow-hidden bg-white border border-emerald-600/20 p-8 md:p-10 rounded-3xl shadow-lg">
          <div class="absolute top-0 right-0 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>
          <div class="absolute bottom-0 left-0 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/3 pointer-events-none"></div>

          <div class="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div>
              <h2 class="text-2xl font-bold text-emerald-600 flex items-center gap-3">
                <i data-lucide="brain-circuit" class="w-7 h-7"></i>
                Plano de Hoje — Motor Inteligente
              </h2>
              <p class="text-emerald-500/70 mt-2 font-medium">
                ~${dailyPlan.totalEstimatedMinutes} min estimados · ${dailyPlan.plan.length} conceitos
              </p>
            </div>
          </div>

          <div class="relative z-10 space-y-3">
            ${dailyPlan.plan.map((item, idx) => {
              const concept = concepts.find(c => c.name === item.conceito_name);
              const reasonLabels = {
                sm2_due: { label: 'Revisão SM-2', color: 'bg-blue-600/10 text-blue-600 border-blue-600/20' },
                gap_critical: { label: 'Gap Crítico', color: 'bg-red-600/10 text-red-600 border-red-600/20' },
                new_concept: { label: 'Conceito Novo', color: 'bg-purple-600/10 text-purple-600 border-purple-600/20' },
                needs_review_tag: { label: '🚩 Revisar Urgente', color: 'bg-red-600/10 text-red-700 border-red-500' }
              };
              const reasonInfo = reasonLabels[item.reason] || { label: item.reason, color: 'bg-zinc-100 text-zinc-600 border-zinc-300' };
              return `
                <button
                  class="concept-card w-full text-left bg-zinc-50/80 border border-emerald-600/20 hover:border-emerald-500/50 hover:bg-zinc-50 px-5 py-4 rounded-2xl transition-all group flex items-center gap-4 backdrop-blur-md shadow-sm"
                  data-id="${concept?.id || item.conceito_name}"
                >
                  <div class="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm shrink-0">${idx + 1}</div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 flex-wrap mb-1">
                      <span class="text-xs font-bold px-2 py-0.5 rounded-md border ${reasonInfo.color}">${reasonInfo.label}</span>
                    </div>
                    <div class="font-semibold text-zinc-800 group-hover:text-emerald-600 transition-colors truncate">${item.conceito_name}</div>
                  </div>
                  <div class="text-right shrink-0">
                    <div class="text-sm font-bold text-zinc-700">${item.mastery}%</div>
                    <div class="text-xs text-zinc-400">~${item.estimatedMinutes}min</div>
                  </div>
                  <i data-lucide="chevron-right" class="w-5 h-5 text-zinc-300 group-hover:text-emerald-500 transition-colors shrink-0"></i>
                </button>
              `;
            }).join('')}
          </div>
        </div>
      ` : ''}
```

**3. Adicionar Painel de Prontidão Operacional após os stats cards:**

Após o bloco dos 4 cards de estatísticas e antes do Plano Diário:

```js
      ${gapAnalysis ? `
        <div class="bg-white border border-zinc-200 rounded-3xl p-6 shadow-sm">
          <h2 class="text-lg font-bold text-zinc-800 mb-4 flex items-center gap-2">
            <i data-lucide="activity" class="w-5 h-5 text-emerald-500"></i>
            Saúde do Aprendizado
          </h2>
          <div class="flex items-center gap-4 mb-6">
            <div class="text-4xl font-black ${gapAnalysis.overallHealth >= 70 ? 'text-emerald-600' : gapAnalysis.overallHealth >= 40 ? 'text-amber-600' : 'text-red-600'}">${gapAnalysis.overallHealth}%</div>
            <div class="text-sm text-zinc-500 leading-snug">domínio médio geral<br>(excluindo conceitos "Só Conhecimento")</div>
          </div>
          ${gapAnalysis.weakCategories && gapAnalysis.weakCategories.length > 0 ? `
            <div class="space-y-3">
              <div class="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Categorias Críticas (abaixo de 60%)</div>
              ${gapAnalysis.weakCategories.map(cat => `
                <div class="flex items-center gap-3">
                  <div class="text-sm font-medium text-zinc-700 w-32 truncate shrink-0">${cat.name}</div>
                  <div class="flex-1 h-2 bg-zinc-100 rounded-full overflow-hidden">
                    <div class="h-full ${cat.healthScore >= 50 ? 'bg-amber-500' : 'bg-red-500'} rounded-full" style="width: ${cat.healthScore}%"></div>
                  </div>
                  <div class="text-sm font-bold ${cat.healthScore >= 50 ? 'text-amber-600' : 'text-red-600'} w-10 text-right shrink-0">${cat.healthScore}%</div>
                </div>
              `).join('')}
            </div>
          ` : '<p class="text-sm text-emerald-600 font-medium">✅ Nenhuma categoria crítica — bom trabalho!</p>'}
        </div>
      ` : ''}
```

- [ ] **Step 9.2: Atualizar app.js — renderDashboard agora é async**

Em `js/app.js`, na função `renderApp`, alterar a chamada do dashboard:

```js
// ANTES:
            case 'dashboard':
                renderDashboard(viewContainer, state);
                break;
// DEPOIS:
            case 'dashboard':
                renderDashboard(viewContainer, state); // async — sem await intencional (renderiza progressivamente)
                break;
```

Nenhuma mudança necessária — a função async resolve naturalmente sem bloquear. O conteúdo renderiza em dois passos: HTML estático imediato, depois dados da Edge Function.

- [ ] **Step 9.3: Verificar no browser**

1. Abrir `localhost:5500` → Dashboard
2. Verificar que o bloco "Plano de Hoje — Motor Inteligente" aparece (pode demorar 1-2s para Edge Function responder na primeira vez)
3. Verificar bloco "Saúde do Aprendizado" com percentual e barras de categorias
4. Clicar em um conceito do plano → deve navegar para concept-detail
5. Abrir DevTools → verificar que as Edge Functions retornam 200 (Network tab)

- [ ] **Step 9.4: Commit**

```bash
git add js/dashboard.js js/app.js
git commit -m "feat: update dashboard with intelligent daily plan and health analysis"
```

---

## Chunk 4: Decision Tree Heatmap + Concept List Filter

---

### Task 10: decision_tree.json — Adicionar concept_links nos Nós

**Files:**
- Modify: `data/decision_tree.json`

- [ ] **Step 10.1: Adicionar concept_links nos nós principais**

Editar `data/decision_tree.json` e adicionar o campo `concept_links` nos nós relevantes. Abrir o arquivo completo e adicionar conforme abaixo (apenas os nós com conceitos claramente identificáveis):

Para cada nó, adicionar após o campo `"id"`:

```json
"nivel_0_inicio": {
  "concept_links": ["Análise Pré-Mercado", "Rotina do Trader"],
  ...
}

"mtf_analysis": {
  "concept_links": ["Análise Multi-Timeframe", "Contexto de Mercado"],
  ...
}

"htf_analysis": {
  "concept_links": ["Tendência de Alta", "Tendência de Baixa", "Trading Range"],
  ...
}

"momento_dia": {
  "concept_links": ["Abertura de Mercado", "Meio do Dia", "Final do Dia"],
  ...
}
```

**IMPORTANTE:** Os valores em `concept_links` devem ser nomes EXATOS de conceitos existentes na tabela `conceitos` do Supabase. Para verificar nomes exatos, executar no browser:

```js
const { store } = await import('./js/state.js');
const names = store.getState().concepts.map(c => c.name);
console.log(names.join('\n'));
```

Usar apenas nomes que aparecerem nessa lista. Se um conceito linkado não existir, o heatmap mostrará o badge laranja `⚠️ Link?` (tratamento de erro previsto no spec).

- [ ] **Step 10.2: Commit**

```bash
git add data/decision_tree.json
git commit -m "feat: add concept_links to decision tree nodes for heatmap integration"
```

---

### Task 11: decision-tree.js — Heatmap de Domínio

**Files:**
- Modify: `js/decision-tree.js`

- [ ] **Step 11.1: Adicionar funções de heatmap ao decision-tree.js**

Logo antes da função `renderDecisionTree`, adicionar:

```js
// ─── Heatmap de Domínio ────────────────────────────────────────────────────

/**
 * Calcula o domínio médio dos conceitos linkados a um nó.
 * Retorna:
 *   null → nó não tem concept_links
 *   -1   → pelo menos um concept_link não existe no progressMap (link quebrado)
 *   0-100 → média de domínio dos conceitos linkados
 */
function getNodeMastery(node, progressMap) {
    if (!node.concept_links || node.concept_links.length === 0) return null;

    let hasUnknown = false;
    const masteries = node.concept_links.map(name => {
        const entry = progressMap[name];
        if (entry === undefined) {
            hasUnknown = true;
            console.warn(`[decision-tree] concept_link "${name}" não encontrado no progressMap`);
            return 0;
        }
        return entry.masteryPercentage || 0;
    });

    if (hasUnknown) return -1;
    return Math.round(masteries.reduce((a, b) => a + b, 0) / masteries.length);
}

/**
 * Retorna a cor Tailwind correspondente ao nível de domínio.
 */
function getMasteryColor(mastery) {
    if (mastery === null) return null;
    if (mastery === -1) return 'orange'; // link quebrado
    if (mastery >= 85) return 'emerald'; // dominado
    if (mastery >= 50) return 'amber';   // em progresso
    if (mastery > 0)   return 'red';     // fraco
    return 'zinc';                        // nunca estudado
}

/**
 * Gera o HTML do badge de domínio para o header de um nó.
 */
function renderMasteryBadge(mastery) {
    if (mastery === null) return '';
    const colorMap = {
        orange:  'bg-orange-100 text-orange-700 border-orange-300',
        emerald: 'bg-emerald-100 text-emerald-700 border-emerald-300',
        amber:   'bg-amber-100 text-amber-700 border-amber-300',
        red:     'bg-red-100 text-red-700 border-red-300',
        zinc:    'bg-zinc-100 text-zinc-500 border-zinc-300'
    };
    const color = getMasteryColor(mastery);
    const label = mastery === -1 ? '⚠️ Link?' : `${mastery}%`;
    const classes = colorMap[color] || colorMap.zinc;
    return `<span class="text-xs font-bold px-2 py-1 rounded-lg border ${classes}">${label}</span>`;
}

/**
 * Gera o CTA de "Estudar conceito mais fraco" se o domínio do nó for baixo.
 */
function renderWeakNodeCTA(node, progressMap, concepts) {
    if (!node.concept_links || node.concept_links.length === 0) return '';
    const mastery = getNodeMastery(node, progressMap);
    if (mastery === null || mastery === -1 || mastery >= 70) return '';

    // Encontrar o conceito mais fraco do nó
    let weakestName = null;
    let weakestMastery = Infinity;
    node.concept_links.forEach(name => {
        const m = progressMap[name]?.masteryPercentage ?? 0;
        if (m < weakestMastery) { weakestMastery = m; weakestName = name; }
    });
    if (!weakestName) return '';

    const concept = concepts.find(c => c.name === weakestName);
    if (!concept) return '';

    return `
        <div class="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-4">
            <div class="flex items-start gap-3">
                <i data-lucide="alert-triangle" class="w-5 h-5 text-amber-500 shrink-0 mt-0.5"></i>
                <p class="text-sm text-amber-800 font-medium">
                    Você está fraco neste nó. Conceito mais crítico: <strong>${weakestName}</strong> (${weakestMastery}%)
                </p>
            </div>
            <button class="study-weak-btn shrink-0 flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors" data-concept-id="${concept.id}">
                <i data-lucide="book-open" class="w-4 h-4"></i> Estudar
            </button>
        </div>
    `;
}
```

- [ ] **Step 11.2: Integrar heatmap na renderização do nó**

Na função `renderDecisionTree`, após obter `currentNode`, criar o `progressMap` a partir do estado:

```js
    // Criar progressMap para o heatmap
    const { concepts } = store.getState();
    const progressMap = Object.fromEntries(concepts.map(c => [c.name, c]));
    const nodeMastery = getNodeMastery(currentNode, progressMap);
```

Na seção do header do nó (logo após o badge de tipo), adicionar o badge de mastery e o CTA:

Localizar:
```js
                        <h1 class="text-3xl md:text-4xl font-bold text-zinc-900 leading-tight mb-4 tracking-tight">
                            ${title}
                        </h1>
```

Substituir por:
```js
                        <div class="flex items-start justify-between gap-4 mb-4">
                            <h1 class="text-3xl md:text-4xl font-bold text-zinc-900 leading-tight tracking-tight">
                                ${title}
                            </h1>
                            ${renderMasteryBadge(nodeMastery)}
                        </div>
                        ${renderWeakNodeCTA(currentNode, progressMap, concepts)}
```

- [ ] **Step 11.3: Registrar listener do botão "Estudar"**

Após os event listeners existentes, adicionar:

```js
    // CTA de conceito mais fraco
    container.querySelectorAll('.study-weak-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const conceptId = btn.getAttribute('data-concept-id');
            store.setState({ selectedConceptId: conceptId });
        });
    });
```

- [ ] **Step 11.4: Verificar no browser**

1. Abrir `localhost:5500` → Árvore de Decisão
2. Navegar para qualquer nó que tenha `concept_links` no JSON
3. Verificar que o badge de domínio aparece no título (ex: `[🟡 45%]`)
4. Se domínio < 70%, verificar CTA "Estudar" aparece
5. Clicar em "Estudar" → deve navegar para o concept-detail

- [ ] **Step 11.5: Commit**

```bash
git add js/decision-tree.js
git commit -m "feat: add mastery heatmap to decision tree nodes"
```

---

### Task 12: concept-list.js — Filtro por Tags

**Files:**
- Modify: `js/concept-list.js`

- [ ] **Step 12.1: Atualizar js/concept-list.js — adicionar filtro de tags**

Adicionar import no topo:

```js
import { AVAILABLE_TAGS } from './tags.js';
```

No início de `renderConceptList`, adicionar state do filtro de tags:

```js
    let filterTag = store.getState().conceptFilterTag || 'Todos';
```

Na lógica de filtragem, adicionar condição de tag:

```js
    const filteredConcepts = concepts.filter(c => {
        const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.category.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesMacro = filterMacro === 'Todos' || c.macroCategory === filterMacro;
        const matchesABC = filterABC === 'Todos' || (c.abcCategory || 'C') === filterABC;
        const matchesTag = (() => {
            if (filterTag === 'Todos') return true;
            if (filterTag === 'exclude_knowledge') return !c.tags?.includes('knowledge_only');
            if (filterTag === 'only_knowledge') return c.tags?.includes('knowledge_only');
            return c.tags?.includes(filterTag);
        })();
        return matchesSearch && matchesMacro && matchesABC && matchesTag;
    });
```

Adicionar o `<select>` de tags na barra de filtros (ao lado dos existentes):

```js
            <div class="relative">
              <select
                id="tag-filter"
                class="appearance-none bg-white border border-zinc-200 text-zinc-700 text-sm rounded-xl pl-4 pr-10 py-3 focus:outline-none focus:border-emerald-500 cursor-pointer shadow-sm transition-colors"
              >
                <option value="Todos" ${filterTag === 'Todos' ? 'selected' : ''}>Todas as Tags</option>
                <option value="exclude_knowledge" ${filterTag === 'exclude_knowledge' ? 'selected' : ''}>Excluir Só Conhecimento</option>
                <option value="only_knowledge" ${filterTag === 'only_knowledge' ? 'selected' : ''}>Apenas Só Conhecimento</option>
                ${AVAILABLE_TAGS.filter(t => t.id !== 'knowledge_only').map(t => `
                  <option value="${t.id}" ${filterTag === t.id ? 'selected' : ''}>${t.icon} ${t.label}</option>
                `).join('')}
              </select>
              <i data-lucide="filter" class="w-4 h-4 text-zinc-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"></i>
            </div>
```

Adicionar listener do filtro de tag:

```js
    const tagSelect = document.getElementById('tag-filter');
    tagSelect?.addEventListener('change', (e) => {
        store.setState({ conceptFilterTag: e.target.value });
    });
```

- [ ] **Step 12.2: Verificar no browser**

1. Abrir `localhost:5500` → Gestão de Conceitos
2. Verificar novo select "Tags" na barra de filtros
3. Selecionar "Excluir Só Conhecimento" → conceitos com essa tag devem desaparecer
4. Selecionar "🚩 Revisar Urgente" → deve mostrar apenas conceitos com essa tag
5. Voltar para "Todas as Tags" → todos os conceitos reaparecem

- [ ] **Step 12.3: Commit final**

```bash
git add js/concept-list.js
git commit -m "feat: add tag filter to concept list view"
```

---

## Checklist Final

Antes de declarar implementação concluída, verificar:

- [ ] Todas as 5 tabelas Supabase existem e têm RLS desabilitado
- [ ] Dados do localStorage foram migrados para o Supabase (verificar `getAllProgress().then(d => console.log(d.length))`)
- [ ] SM-2 funciona: fazer uma avaliação → verificar `next_review_at` muda no Supabase
- [ ] Editor rico salva e carrega conteúdo ao reabrir um conceito
- [ ] Tags persistem após reload da página
- [ ] Dashboard mostra Plano Diário com dados da Edge Function
- [ ] Árvore de Decisão mostra badges de domínio nos nós com `concept_links`
- [ ] Filtro de tags funciona na Gestão de Conceitos
- [ ] Nenhum erro de console (exceto avisos esperados de `⚠️ Link?` no heatmap)
