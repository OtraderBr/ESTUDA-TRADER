# Motor Brooks v3 — Design Spec

**Data:** 2026-03-13
**Status:** Aprovado para implementação
**Escopo:** Evolução inteligente do Motor Brooks — backend-first, sem troca de stack
**Revisão:** v2 — corrigidos 9 issues identificados na spec review

---

## 1. Contexto e Objetivo

O Motor Brooks é um sistema pessoal de estudos da metodologia Price Action de Al Brooks. A stack atual é HTML + Vanilla JS (ES Modules) + Tailwind CSS (CDN) + Supabase (conceitos) + localStorage (progresso).

**Dor central:** O sistema é passivo — não pensa, não prioriza, não se adapta. O usuário precisa decidir manualmente o que estudar, quando revisar, e quais são seus pontos fracos.

**Objetivo da v3:** Transformar o Supabase no cérebro do sistema. Toda inteligência vive no banco + Edge Functions. O frontend vanilla JS é mantido; apenas a camada de dados e lógica evolui.

**Fora do escopo:**
- Quiz (removido do roadmap)
- Multi-usuário / autenticação
- Migração de framework (sem React/Svelte)
- Redesign visual completo

---

## 2. Arquitetura Geral

```
┌─────────────────────────────────────────────────────┐
│                  FRONTEND (Vanilla JS)               │
│                                                      │
│  app.js → store (state.js) → views (dashboard, etc) │
│  dataService.js ──────────────────────────────────► │
│                                                      │
│  localStorage = cache de sessão (leitura rápida)     │
└──────────────────────────┬──────────────────────────┘
                           │ HTTPS
┌──────────────────────────▼──────────────────────────┐
│                     SUPABASE                         │
│                                                      │
│  Tabelas:                  Edge Functions:           │
│  ├── conceitos (existente) ├── generate-daily-plan   │
│  ├── user_concept_progress └── analyze-gaps          │
│  ├── concept_notes                                   │
│  ├── concept_evaluations                             │
│  ├── study_sessions                                  │
│  └── session_concepts                                │
└─────────────────────────────────────────────────────┘
```

**Princípio de cache:** Ao inicializar, o app carrega do localStorage (resposta imediata) e simultaneamente faz fetch do Supabase. Quando o fetch completa, atualiza o estado — sem re-render visível se os dados forem iguais.

### 2.1 Política de RLS

O projeto é single-user e não possui autenticação. **RLS deve ser desabilitado** em todas as tabelas novas via Supabase Dashboard, e o acesso é feito exclusivamente via `anon key`. Sem isso, todas as queries retornarão resultado vazio silenciosamente.

```sql
-- Executar para cada tabela nova após criação:
ALTER TABLE user_concept_progress DISABLE ROW LEVEL SECURITY;
ALTER TABLE concept_notes DISABLE ROW LEVEL SECURITY;
ALTER TABLE concept_evaluations DISABLE ROW LEVEL SECURITY;
ALTER TABLE study_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE session_concepts DISABLE ROW LEVEL SECURITY;
```

---

## 3. Data Layer — Tabelas Supabase

### 3.0 Tabela existente: `conceitos` (referência)

A tabela `conceitos` já existe no Supabase e **não é modificada**. Schema relevante para as queries desta spec:

```sql
-- conceitos (existente, somente leitura nesta spec)
conceitos
  ├── id           BIGINT (serial)
  ├── conceito     TEXT  -- nome do conceito (chave de negócio)
  ├── categoria    TEXT
  ├── subcategoria TEXT
  ├── prerequisito TEXT  -- nome do conceito pré-requisito, ou 'Nenhum'
  ├── macro_categoria TEXT
  └── ... (outros campos)
```

O campo `prerequisito` contém o **nome** (não o ID) do conceito pré-requisito, igual ao campo `conceito_name` usado em `user_concept_progress`. Isso permite joins por nome.

### 3.1 `user_concept_progress`

Substitui `localStorage['brooks_progress_v4']`.

```sql
CREATE TABLE user_concept_progress (
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
  -- SM-2 fields
  sm2_ease_factor    FLOAT NOT NULL DEFAULT 2.5,
  sm2_interval       INT NOT NULL DEFAULT 1,
  sm2_repetitions    INT NOT NULL DEFAULT 0,
  -- Tags
  tags               TEXT[] NOT NULL DEFAULT '{}',
  -- Timestamps
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ucp_next_review ON user_concept_progress(next_review_at);
CREATE INDEX idx_ucp_tags ON user_concept_progress USING gin(tags);
```

**Campo `tags`:** array de strings extensível. Tags com lógica de negócio:
- `knowledge_only` → exclui do SM-2, do Plano Diário e das métricas
- `needs_review` → entra no SLOT 0 do Plano Diário (máx. 2 por dia)
- `priority_high` → sobe na ordenação dentro do seu slot
- `favorite` → filtrável visualmente, sem impacto na lógica

### 3.2 `concept_notes`

Substitui `notesList` dentro do localStorage.

O tipo `'Descrição'` representa o conteúdo principal do conceito no editor rico — existe no máximo **um** registro deste tipo por conceito. Os demais tipos são anotações avulsas e podem ter múltiplas entradas.

```sql
CREATE TABLE concept_notes (
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

-- Garante unicidade da 'Descrição' por conceito (upsert seguro)
CREATE UNIQUE INDEX idx_notes_descricao_unique
  ON concept_notes(conceito_name)
  WHERE type = 'Descrição';

CREATE INDEX idx_notes_conceito ON concept_notes(conceito_name);
CREATE INDEX idx_notes_fts ON concept_notes
  USING gin(to_tsvector('portuguese', content_text));
```

### 3.3 `concept_evaluations`

Substitui `evaluations` dentro do localStorage.

O quiz foi removido do escopo. A avaliação agora tem dois scores distintos: `flashcard_score` (resultado de ferramenta externa de flashcards) e `self_score` (autoavaliação numérica de 0–100 que o usuário informa ao explicar o conceito pela Técnica de Feynman). Ambos contribuem para o cálculo do SM-2.

```sql
CREATE TABLE concept_evaluations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conceito_name    TEXT NOT NULL,
  flashcard_score  INT NOT NULL CHECK (flashcard_score BETWEEN 0 AND 100),
  self_score       INT NOT NULL CHECK (self_score BETWEEN 0 AND 100),
  -- Nota: self_score substitui o antigo quiz_score.
  -- Representa a autoavaliação numérica do usuário após explicar
  -- o conceito pela Técnica de Feynman (0 = não conseguiu explicar,
  -- 100 = explicou com total clareza e sem hesitação).
  explanation      TEXT NOT NULL,
  mastery_at_time  INT NOT NULL,
  sm2_quality      INT NOT NULL CHECK (sm2_quality BETWEEN 0 AND 5),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_evals_conceito ON concept_evaluations(conceito_name);
CREATE INDEX idx_evals_date ON concept_evaluations(created_at DESC);
```

**Migração de dados legados:** registros do localStorage que possuem `quizScore` são mapeados para `self_score` durante a migração de dados (seção 4).

### 3.4 `study_sessions`

Substitui `localStorage['brooks_sessions_v1']`.

```sql
CREATE TABLE study_sessions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title          TEXT NOT NULL,
  type           TEXT NOT NULL DEFAULT 'Estudo'
                   CHECK (type IN ('Estudo','Revisão','Prática')),
  scheduled_date DATE NOT NULL,
  completed_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE session_concepts (
  session_id    UUID NOT NULL REFERENCES study_sessions(id) ON DELETE CASCADE,
  conceito_name TEXT NOT NULL,
  PRIMARY KEY (session_id, conceito_name)
);
```

---

## 4. Migração de Dados

Ao inicializar o app, `engine.js` executa `migrateIfNeeded()`:

```
1. Verificar se `user_concept_progress` tem linhas no Supabase
2. Se SIM → dados já migrados, apenas sincronizar cache local
3. Se NÃO → ler `localStorage['brooks_progress_v4']`
         → para cada entrada, fazer upsert em `user_concept_progress`
            (campos: abc_category, macro_category, importance,
             mastery_percentage, last_studied_at, next_review_at)
         → ler notesList de cada entrada → inserir em concept_notes
            (type = tipo original, content_html = text escapado em <p>,
             content_text = text original)
         → ler evaluations de cada entrada → inserir em concept_evaluations
            (flashcard_score = flashcardScore,
             self_score = quizScore,  ← mapeamento explícito do legado
             sm2_quality calculado em tempo de migração)
         → ler `brooks_sessions_v1` → inserir em study_sessions + session_concepts
         → marcar flag `localStorage['v3_migrated'] = true`
4. Após migração → localStorage vira cache read-only de sessão
```

A migração é idempotente — usa `upsert` com `ON CONFLICT (conceito_name)` em `user_concept_progress` e verifica existência antes de inserir nas demais tabelas.

---

## 5. Algoritmo SM-2

### 5.1 Cálculo da qualidade

O quiz foi removido. A avaliação usa `flashcard_score` e `self_score`:

```js
// js/sm2.js (novo módulo)
// flashcardScore: resultado % de ferramenta externa (Anki, etc.)
// selfScore: autoavaliação 0-100 do usuário (Técnica de Feynman)
export function calculateQuality(flashcardScore, selfScore) {
  const avg = (flashcardScore + selfScore) / 2;
  if (avg >= 90) return 5; // perfeito, sem hesitação
  if (avg >= 75) return 4; // correto após leve hesitação
  if (avg >= 60) return 3; // correto mas com dificuldade
  if (avg >= 40) return 2; // errado, mas resposta era recuperável
  if (avg >= 20) return 1; // errado, resposta muito difícil
  return 0;                // blackout
}
```

### 5.2 Atualização do intervalo

```js
export function applySM2(progress, quality) {
  let { sm2_ease_factor, sm2_interval, sm2_repetitions } = progress;

  if (quality < 3) {
    // Resposta insuficiente — reinicia a sequência.
    // next_review_at = amanhã (intervalo de 1 dia).
    sm2_repetitions = 0;
    sm2_interval = 1;
  } else {
    // Resposta correta — avança a sequência.
    if (sm2_repetitions === 0) sm2_interval = 1;       // 1ª vez certa: revisar amanhã
    else if (sm2_repetitions === 1) sm2_interval = 6;  // 2ª vez certa: revisar em 6 dias
    else sm2_interval = Math.round(sm2_interval * sm2_ease_factor); // seguintes: intervalo × fator
    sm2_repetitions += 1;
  }

  // Atualiza fator de facilidade (aplica-se em AMBOS os caminhos correto/incorreto)
  sm2_ease_factor = Math.max(
    1.3, // mínimo absoluto do algoritmo SM-2
    sm2_ease_factor + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)
  );

  // Próxima revisão = hoje + sm2_interval dias (sempre no futuro, mínimo amanhã)
  const next_review_at = new Date();
  next_review_at.setDate(next_review_at.getDate() + sm2_interval);

  return { sm2_ease_factor, sm2_interval, sm2_repetitions, next_review_at };
}
```

### 5.3 Mastery percentage

```js
export function calculateMastery(flashcardScore, selfScore) {
  return Math.round((flashcardScore + selfScore) / 2);
}
```

**Conceitos `knowledge_only`:** `applySM2` nunca é chamada para eles. `next_review_at` permanece `null`. `mastery_percentage` pode ser atualizado manualmente mas não entra nas métricas globais.

---

## 6. Estratégia de Cache

O cache no localStorage evita chamadas repetidas às Edge Functions e garante resposta imediata no carregamento.

### 6.1 Chaves de cache e TTL

| Chave localStorage | Conteúdo | TTL | Invalidado quando |
|---|---|---|---|
| `mb_cache_gaps` | JSON do resultado de `analyze-gaps` | 1h (wall-clock) | Usuário salva uma avaliação |
| `mb_cache_plan` | JSON do resultado de `generate-daily-plan` | 1h (wall-clock) | Usuário salva uma avaliação OU completa um conceito do plano |
| `mb_cache_ts_gaps` | Timestamp ISO da última geração | — | Nunca expira sozinho |
| `mb_cache_ts_plan` | Timestamp ISO da última geração | — | Nunca expira sozinho |

### 6.2 Lógica de invalidação

```js
// js/daily-plan.js
export function isCacheValid(cacheKey, tsKey, ttlMs = 3600_000) {
  const ts = localStorage.getItem(tsKey);
  if (!ts) return false;
  return (Date.now() - new Date(ts).getTime()) < ttlMs;
}

export function bustPlanCache() {
  localStorage.removeItem('mb_cache_gaps');
  localStorage.removeItem('mb_cache_plan');
  localStorage.removeItem('mb_cache_ts_gaps');
  localStorage.removeItem('mb_cache_ts_plan');
}
```

`bustPlanCache()` é chamada no `engine.js` sempre que:
- `addEvaluation()` é invocada (novo resultado de estudo)
- `toggleSessionComplete()` marca uma sessão como concluída

---

## 7. Edge Functions Supabase

### 7.1 `analyze-gaps`

**Trigger:** chamada pelo Dashboard ao carregar, somente se o cache estiver expirado.

**Input:** nenhum (opera sobre todos os dados do banco).

**Lógica SQL (dentro da Edge Function — Deno):**

```sql
-- weakCategories: categorias com média de domínio abaixo de 60%
SELECT
  macro_category AS name,
  ROUND(AVG(mastery_percentage))::INT AS health_score,
  COUNT(*) FILTER (WHERE mastery_percentage < 50) AS concepts_below_50
FROM user_concept_progress
WHERE NOT ('knowledge_only' = ANY(tags))
GROUP BY macro_category
HAVING AVG(mastery_percentage) < 60
ORDER BY AVG(mastery_percentage) ASC
LIMIT 3;

-- neglectedConcepts: estudados há mais de 30 dias sem domínio completo
SELECT
  conceito_name AS name,
  last_studied_at,
  EXTRACT(DAY FROM NOW() - last_studied_at)::INT AS days_since
FROM user_concept_progress
WHERE last_studied_at < NOW() - INTERVAL '30 days'
  AND mastery_percentage < 85
  AND NOT ('knowledge_only' = ANY(tags))
ORDER BY last_studied_at ASC NULLS FIRST
LIMIT 5;

-- prerequisiteGaps: conceitos cujo pré-requisito não foi dominado
SELECT
  ucp.conceito_name AS concept,
  c.prerequisito AS prerequisite,
  prereq_ucp.mastery_percentage AS prereq_mastery
FROM user_concept_progress ucp
JOIN conceitos c ON c.conceito = ucp.conceito_name
JOIN user_concept_progress prereq_ucp ON prereq_ucp.conceito_name = c.prerequisito
WHERE c.prerequisito IS NOT NULL
  AND c.prerequisito <> 'Nenhum'
  AND prereq_ucp.mastery_percentage < 50
  AND ucp.mastery_percentage < 85
  AND NOT ('knowledge_only' = ANY(ucp.tags))
LIMIT 5;

-- overallHealth: média geral de domínio (%), excluindo knowledge_only
SELECT ROUND(AVG(mastery_percentage))::INT AS overall_health
FROM user_concept_progress
WHERE NOT ('knowledge_only' = ANY(tags));
```

**Output:**
```json
{
  "weakCategories": [
    { "name": "string", "healthScore": 45, "conceptsBelow50": 8 }
  ],
  "neglectedConcepts": [
    { "name": "string", "lastStudied": "2025-11-20T00:00:00Z", "daysSince": 113 }
  ],
  "prerequisiteGaps": [
    { "concept": "string", "prerequisite": "string", "prereqMastery": 35 }
  ],
  "overallHealth": 54
}
```

`overallHealth` é um inteiro de 0 a 100 representando a **porcentagem média de domínio** sobre todos os conceitos ativos (excluindo `knowledge_only`).

### 7.2 `generate-daily-plan`

**Trigger:** chamada pelo Dashboard após `analyze-gaps`, somente se o cache estiver expirado.

**Lógica de geração — cap total de 8 conceitos:**

```
SLOT 0 — Tag "needs_review" (prioridade máxima, até 2 por plano):
  WHERE 'needs_review' = ANY(tags)
    AND NOT 'knowledge_only' = ANY(tags)
  ORDER BY mastery_percentage ASC
  LIMIT 2

SLOT 1 — Revisões SM-2 devidas (até preencher 5 vagas restantes após SLOT 0):
  WHERE next_review_at <= CURRENT_DATE
    AND NOT 'knowledge_only' = ANY(tags)
    AND NOT 'needs_review' = ANY(tags)  -- já entrou no SLOT 0
  ORDER BY next_review_at ASC, mastery_percentage ASC
  LIMIT (5 - count_slot_0)

SLOT 2 — Gaps críticos (até 2 vagas, se SLOT 0 + SLOT 1 < 7):
  Seleciona até 2 conceitos NO TOTAL, combinando:
    1º) top conceitos de prerequisiteGaps (mastery mais baixa primeiro)
    2º) top conceitos de weakCategories (mastery mais baixa primeiro)
  Deduplicado — cada conceito aparece no máximo uma vez.
  LIMIT 2

SLOT 3 — Conceito novo (1 vaga, somente se total ainda < 8):
  WHERE mastery_percentage = 0
    AND NOT 'knowledge_only' = ANY(tags)
    AND (prerequisito = 'Nenhum'
         OR prerequisito IS NULL
         OR prereq.mastery_percentage >= 50)
  ORDER BY conceitos.id ASC
  LIMIT 1
```

**Output:**
```json
{
  "plan": [
    {
      "conceito_name": "string",
      "reason": "needs_review_tag" | "sm2_due" | "gap_critical" | "new_concept",
      "mastery": 0,
      "estimatedMinutes": 5
    }
  ],
  "totalEstimatedMinutes": 45,
  "generatedAt": "2026-03-13T10:00:00Z"
}
```

`estimatedMinutes` por conceito: 5 min se `mastery >= 70`, 10 min se `mastery >= 40`, 20 min se novo ou `mastery < 40`.

---

## 8. Editor Rico (Tiptap)

### 8.1 Dependências — versões fixadas (CDN, sem build step)

Adicionadas ao `index.html`. **Versões pinadas** para evitar quebra silenciosa:

```html
<!-- Tiptap Core + Extensions — versões fixadas -->
<script src="https://cdn.jsdelivr.net/npm/@tiptap/core@2.11.5/dist/tiptap-core.umd.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@tiptap/starter-kit@2.11.5/dist/tiptap-starter-kit.umd.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@tiptap/extension-highlight@2.3.2/dist/tiptap-extension-highlight.umd.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@tiptap/extension-text-color@2.11.5/dist/tiptap-extension-text-color.umd.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@tiptap/extension-placeholder@2.11.5/dist/tiptap-extension-placeholder.umd.min.js"></script>
```

### 8.2 Novo módulo `js/rich-editor.js`

```js
// Exporta função que inicializa o editor num container DOM
export function createRichEditor(containerId, initialHtml, onUpdate) {
  const editor = new window.Editor({
    element: document.getElementById(containerId),
    extensions: [
      window.StarterKit,
      window.Highlight,
      window.TextColor,
      window.Placeholder.configure({
        placeholder: 'Escreva sua análise, regras e observações sobre este conceito...'
      })
    ],
    content: initialHtml || '',
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      const text = editor.getText();
      onUpdate(html, text); // chamado pelo caller com debounce de 1500ms
    }
  });
  return editor;
}
```

### 8.3 Toolbar flutuante

Aparece ao selecionar texto. Implementada como um `<div>` posicionado absolutamente que escuta `selectionUpdate` do editor.

**Botões da toolbar:**
- **B** `Bold`
- *I* `Italic`
- ~~S~~ `Strike`
- H1 / H2 `Heading`
- `==` `Highlight` (amarelo — para revisão rápida)
- `🔴` custom class `alert-block` (fundo vermelho suave — para armadilhas)
- `🟢` custom class `setup-block` (fundo verde suave — para condições de entrada)
- `•` `BulletList`
- `1.` `OrderedList`

### 8.4 Estrutura na `concept-detail.js`

A aba "Anotações" é reorganizada em três blocos distintos:

```
[BLOCO A] DESCRIÇÃO DO CONCEITO
  → Editor Tiptap, sempre visível, auto-save 1.5s
  → Salva via upsertConceptDescription() em concept_notes
     com type = 'Descrição' (único por conceito — ver índice unique em 3.2)

[BLOCO B] NOVA ANOTAÇÃO RÁPIDA
  → Select de tipo (Anotação / Dúvida / Pergunta / Questionamento / Observação de Tela)
  → Textarea menor + botão Salvar
  → Comportamento atual mantido; insere nova linha em concept_notes

[BLOCO C] HISTÓRICO DE ANOTAÇÕES
  → Lista todas as notas exceto type = 'Descrição', ordenadas por created_at DESC
  → Renderiza content_html (não mais text puro)
```

### 8.5 Auto-save

```js
// Debounce de 1500ms — só persiste após o usuário parar de digitar
let saveTimeout;
editor.on('update', () => {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(async () => {
    const html = editor.getHTML();
    const text = editor.getText();
    await upsertConceptDescription(conceptName, html, text);
    showSaveIndicator('Salvo ✓'); // ícone verde discreto por 2s
  }, 1500);
});

// upsertConceptDescription usa ON CONFLICT DO UPDATE graças ao índice partial unique.
// IMPORTANTE: use a forma de inferência de índice (não ON CONFLICT ON CONSTRAINT),
// pois o índice foi criado via CREATE UNIQUE INDEX, não como CONSTRAINT nomeada:
//
// INSERT INTO concept_notes (conceito_name, type, content_html, content_text, updated_at)
// VALUES ($1, 'Descrição', $2, $3, NOW())
// ON CONFLICT (conceito_name) WHERE type = 'Descrição'
// DO UPDATE SET content_html = EXCLUDED.content_html,
//              content_text = EXCLUDED.content_text,
//              updated_at = NOW();
```

---

## 9. Sistema de Tags

### 9.1 Tags disponíveis

| Tag | Efeito na lógica | Visual |
|-----|-----------------|--------|
| `knowledge_only` | Exclui de SM-2, Plano Diário e métricas | Badge `📖 Só Conhecimento` cinza |
| `needs_review` | Entra no SLOT 0 do Plano Diário (máx. 2/dia) | Badge `🚩 Revisar Urgente` vermelho |
| `priority_high` | Sobe na ordenação dentro do seu slot | Badge `🔥 Alta Prioridade` laranja |
| `favorite` | Apenas visual, filtrável | Badge `⭐ Favorito` âmbar |

### 9.2 UX — Pills clicáveis

Na `concept-detail.js`, abaixo dos selects de Classe / Importância / ABC:

```
Tags:
  [📖 Só Conhecimento]  [🚩 Revisar Urgente]  [🔥 Alta Prioridade]  [⭐ Favorito]
```

Cada pill tem dois estados: **inativa** (borda pontilhada, texto cinza) e **ativa** (preenchida, colorida). Um clique faz toggle e persiste no Supabase imediatamente via update no array `tags`.

### 9.3 Impacto nas métricas

```
Dashboard — cards de progresso:
  "Dominados (Cat. A)"   → apenas conceitos sem tag knowledge_only
  "Em Progresso (Cat. B)" → idem
  "Foco Atual (Cat. C)"  → idem

Radar de saúde por categoria:
  denominador = total_conceitos_categoria - knowledge_only_nessa_categoria

Plano Diário:
  conceitos knowledge_only nunca aparecem
  conceitos needs_review → SLOT 0 (máx. 2)
```

### 9.4 Filtro na Gestão de Conceitos

Nova dropdown na barra de filtros:

```
[Buscar...]  [Todas as Classes ▼]  [Todos ABC ▼]  [Tags ▼]
```

Opções do filtro Tags:
- Todos
- Excluir "Só Conhecimento" ← default recomendado
- Apenas "Só Conhecimento"
- Com "Revisar Urgente"
- Favoritos

---

## 10. Árvore de Decisão — Heatmap de Domínio

### 10.1 Mapeamento nó → conceitos

Campo `concept_links` adicionado nos nós do `decision_tree.json`:

```json
{
  "id": "canal_estreito_alta",
  "title": "Canal Estreito de Alta",
  "concept_links": ["Canal Estreito", "Tendência de Alta", "Momentum"],
  "type": "decision"
}
```

O campo é **opcional** — nós sem `concept_links` são renderizados normalmente sem heatmap.

### 10.2 Cálculo client-side

`getNodeMastery` diferencia explicitamente três estados: nó sem links, conceito não encontrado no progressMap (possível typo no JSON), e conceito com mastery = 0 (estudado, sem domínio).

```js
// js/decision-tree.js

// Retorna:
//   null  → nó não tem concept_links definido
//   -1    → pelo menos um concept_link não existe no progressMap (link quebrado)
//   0–100 → média de domínio dos conceitos linkados
function getNodeMastery(node, progressMap) {
  if (!node.concept_links || node.concept_links.length === 0) return null;

  let hasUnknown = false;
  const masteries = node.concept_links.map(name => {
    const entry = progressMap[name];
    if (entry === undefined) { hasUnknown = true; return 0; }
    return entry.mastery_percentage;
  });

  if (hasUnknown) return -1; // link quebrado — logar no console para debug

  return Math.round(masteries.reduce((a, b) => a + b, 0) / masteries.length);
}

function getMasteryColor(mastery) {
  if (mastery === null) return null;      // sem links → sem heatmap
  if (mastery === -1)   return 'orange';  // link quebrado → badge de alerta para debug
  if (mastery >= 85)    return 'emerald'; // dominado
  if (mastery >= 50)    return 'amber';   // em progresso
  if (mastery > 0)      return 'red';     // fraco
  return 'zinc';                          // nunca estudado (mastery = 0)
}
```

Quando `mastery === -1`, o badge exibe `⚠️ Link?` em laranja — sinaliza ao desenvolvedor que um `concept_link` no JSON não encontrou correspondência em `progressMap`.

### 10.3 Impacto visual no header do nó

```
[tipo: Decisão]
Canal Estreito de Alta                           [🟡 62%]

⚠️ Você está fraco neste nó. Reforce os conceitos linkados.
[📚 Estudar conceito mais fraco]
```

O botão "Estudar" navega para o `concept-detail` do conceito com menor `mastery_percentage` dentro de `concept_links` do nó atual.

### 10.4 Painel "Prontidão Operacional" no Dashboard

Calculado client-side pela média dos `mastery_percentage` dos conceitos linkados às sub-árvores raiz do `decision_tree.json`. As sub-árvores são os filhos diretos do `rootNode`.

```
🌳 PRONTIDÃO OPERACIONAL

Pré-Análise (Nível 0)      ████████░░  80%  🟢
Multi-Timeframe             █████░░░░░  52%  🟡
Canais e Tendências         ███░░░░░░░  34%  🔴
Reversões                   ██████████  91%  🟢
Gestão de Posição           ██░░░░░░░░  22%  🔴
```

Clicando em qualquer linha, navega para a Árvore de Decisão no nó correspondente.

---

## 11. Novos Módulos JS

| Arquivo | Responsabilidade |
|---------|-----------------|
| `js/sm2.js` | `calculateQuality()`, `applySM2()`, `calculateMastery()` |
| `js/rich-editor.js` | `createRichEditor()`, toolbar flutuante |
| `js/tags.js` | `renderTagPills()`, `toggleTag()`, constante `AVAILABLE_TAGS` |
| `js/daily-plan.js` | Fetch + cache das Edge Functions, `bustPlanCache()`, `isCacheValid()` |

### Modificados

| Arquivo | Mudanças |
|---------|----------|
| `js/dataService.js` | + funções CRUD para todas as novas tabelas |
| `js/engine.js` | `saveToStorage()` → `saveToSupabase()` async; + `migrateIfNeeded()`; chama `bustPlanCache()` em avaliações |
| `js/dashboard.js` | + Bloco Plano Diário inteligente; + Painel Prontidão Operacional |
| `js/concept-detail.js` | + Editor Tiptap (BLOCO A); + pills de tags; `self_score` substitui `quizScore` no form |
| `js/concept-list.js` | + filtro por tags |
| `js/decision-tree.js` | + `getNodeMastery()`; + heatmap visual |
| `index.html` | + CDN scripts do Tiptap (versões fixadas) |

---

## 12. Ordem de Implementação

```
1. Tabelas Supabase + RLS desabilitado (migrations SQL)
2. js/sm2.js  ← sem dependências, fundação do engine
3. js/dataService.js expandido (CRUD das novas tabelas)
4. js/engine.js — migrateIfNeeded() + saveToSupabase()
   (usa sm2.js já disponível do passo 2)
5. js/tags.js + concept-detail.js — pills de tags
6. js/rich-editor.js + integração no concept-detail.js
7. Edge Functions — analyze-gaps + generate-daily-plan
8. js/daily-plan.js (cache + fetch das Edge Functions)
9. dashboard.js — Plano Diário + Prontidão Operacional
10. decision_tree.json — concept_links nos nós relevantes
11. decision-tree.js — getNodeMastery() + heatmap visual
12. concept-list.js — filtro por tags
```

**Nota passo 4:** `engine.js` deve ser implementado após `sm2.js` (passo 2) para que `saveToSupabase()` possa chamar `applySM2()` diretamente, sem stub.

---

## 13. Decisões de Design Explícitas

| Decisão | Escolha | Motivo |
|---------|---------|--------|
| Score de avaliação | `flashcard_score` + `self_score` | Quiz removido; `self_score` representa Técnica de Feynman (0–100) |
| Editor rich text | Tiptap 2.11.5 (UMD CDN, versão fixada) | Sem build step, funciona com vanilla JS, mesmo motor do Notion |
| Algoritmo de revisão | SM-2 | Padrão acadêmico comprovado, simples, transparente |
| Persistência | Supabase como fonte da verdade | Durabilidade, backup automático |
| Cache | localStorage com TTL + invalidação por evento | Resposta imediata sem spinner; consistente após ações do usuário |
| Tags | Array `TEXT[]` no Postgres | Flexível, sem tabela extra, filtrável com `@>` |
| Heatmap | Client-side, sem Edge Function | Dados já em memória no store |
| Busca full-text | GIN index no Postgres | Busca dentro do conteúdo das anotações sem custo extra |
| RLS | Desabilitado | Projeto single-user, sem auth |
| Link quebrado no heatmap | Retorna `-1`, exibe badge laranja | Distingue "nunca estudado" de "link inválido no JSON" |
