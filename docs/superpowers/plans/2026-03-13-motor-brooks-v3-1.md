# Motor Brooks v3.1 — Módulos, Notas Livres e Grafo de Conhecimento

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar 3 features ao Motor Brooks: (1) mapeamento módulo/aula do curso Al Brooks em cada conceito, (2) sistema de notas livres estilo Notion com hierarquia e editor full-page, (3) grafo de conhecimento visual (D3) + navegação em cascata.

**Architecture:** Opção 2 — novas rotas `/notes` e `/graph` adicionadas ao roteador de `app.js`. Notas livres armazenadas em nova tabela Supabase `free_notes`. Grafo derivado de dados existentes (pré-requisitos + categoria) + D3.js force-directed. Mapeamento módulo/aula feito via arquivo JSON estático + script de upsert one-shot.

**Tech Stack:** Vanilla JS (ES modules), Tailwind CSS CDN, Supabase, Tiptap (já carregado), D3.js v7 (CDN), Marked.js (já carregado).

---

## Chunk 1: Mapeamento Módulo/Aula do Curso

### Contexto
O campo `modulo_curso` já existe na tabela `conceitos` (mapeado em `dataService.js` como `moduloCurso`), mas está vazio. O arquivo `MATERIAL AL BROOKS/Curso Online Al brooks.txt` tem a estrutura completa de módulos e aulas. Precisamos:
1. Criar um JSON de mapeamento `conceito_name → {modulo, aula}`
2. Script one-shot que faz upsert desse mapeamento no Supabase
3. UI elegante no `concept-detail.js` mostrando módulo/aula com navegação

### Arquivos
- **Criar:** `data/course-mapping.json` — mapeamento estático conceito → módulo/aula
- **Criar:** `js/course-mapper.js` — script one-shot que lê o JSON e faz upsert no Supabase
- **Modificar:** `js/concept-detail.js` — UI do badge módulo/aula expandida
- **Modificar:** `js/dataService.js` — adicionar campo `aula_curso` no `loadConcepts()`
- **Modificar:** `supabase/migrations/` — ADD COLUMN `aula_curso` em `conceitos`

---

### Task 1.1: Migration SQL — adicionar coluna `aula_curso`

**Files:**
- Create: `supabase/migrations/002_add_aula_curso.sql`

- [x] **Step 1: Criar o arquivo de migration**

```sql
-- supabase/migrations/002_add_aula_curso.sql
-- Adiciona coluna aula_curso à tabela conceitos para armazenar
-- a referência precisa da aula do curso Al Brooks (ex: "12A - Ciclo de Mercado")

ALTER TABLE conceitos ADD COLUMN IF NOT EXISTS aula_curso TEXT DEFAULT '';
```

- [ ] **Step 2: Executar a migration no Supabase**

Abrir o Supabase Dashboard → SQL Editor → colar e executar o conteúdo acima.

Verificar: ir em Table Editor → `conceitos` → confirmar que coluna `aula_curso` aparece.

- [x] **Step 3: Atualizar `dataService.js` para incluir o campo novo**

Em `js/dataService.js`, na função `loadConcepts()`, adicionar após `moduloCurso`:

```js
moduloCurso: row.modulo_curso || '',
aulaCurso: row.aula_curso || '',
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/002_add_aula_curso.sql js/dataService.js
git commit -m "feat: add aula_curso column to conceitos + load in dataService"
```

---

### Task 1.2: Criar `data/course-mapping.json`

Este arquivo mapeia nomes de conceitos (exatamente como estão no banco) para módulo e aula do curso. É a fonte da verdade para o enriquecimento de dados.

**Files:**
- Create: `data/course-mapping.json`

- [x] **Step 1: Criar o arquivo JSON de mapeamento**

O formato é:
```json
{
  "Tipos de Gráficos": {
    "modulo": "Fundamentos de Price Action — Começando (01-07)",
    "aula": "07A - Começando"
  },
  "Tempos Gráficos": {
    "modulo": "Fundamentos de Price Action — Começando (01-07)",
    "aula": "07A - Começando"
  }
}
```

Criar o arquivo completo em `data/course-mapping.json` com o mapeamento abaixo.
O mapeamento foi derivado dos arquivos `MATERIAL AL BROOKS/Curso Online Al brooks.txt`
e `MATERIAL AL BROOKS/Análise de curso Price Action_.txt`.

```json
{
  "Tipos de Gráficos": { "modulo": "Fundamentos — Começando (01-07)", "aula": "07A - Começando" },
  "Tempos Gráficos": { "modulo": "Fundamentos — Começando (01-07)", "aula": "07A - Começando" },
  "Como Mercados Funcionam": { "modulo": "Fundamentos — Começando (01-07)", "aula": "02A - O Básico de Gráficos e Price Action" },
  "Definição Price Action": { "modulo": "Fundamentos — Começando (01-07)", "aula": "02C - O Básico de Gráficos e Price Action" },
  "Pain Trade": { "modulo": "Fundamentos — Começando (01-07)", "aula": "02C - O Básico de Gráficos e Price Action" },
  "Média Móvel (MA)": { "modulo": "Fundamentos — Começando (01-07)", "aula": "02D - O Básico de Gráficos e Price Action" },
  "Corpo da Barra": { "modulo": "Fundamentos — Análise de Gráficos (08-11)", "aula": "08A - Candle Setups e Barras de Sinal" },
  "Sombra da Barra": { "modulo": "Fundamentos — Análise de Gráficos (08-11)", "aula": "08A - Candle Setups e Barras de Sinal" },
  "Máxima e Mínima": { "modulo": "Fundamentos — Análise de Gráficos (08-11)", "aula": "08A - Candle Setups e Barras de Sinal" },
  "Barra de Tendência de Alta": { "modulo": "Fundamentos — Análise de Gráficos (08-11)", "aula": "08A - Candle Setups e Barras de Sinal" },
  "Barra de Tendência de Baixa": { "modulo": "Fundamentos — Análise de Gráficos (08-11)", "aula": "08A - Candle Setups e Barras de Sinal" },
  "Barra Doji": { "modulo": "Fundamentos — Análise de Gráficos (08-11)", "aula": "08A - Candle Setups e Barras de Sinal" },
  "Barra de Sinal": { "modulo": "Fundamentos — Análise de Gráficos (08-11)", "aula": "08A - Candle Setups e Barras de Sinal" },
  "Barra de Entrada": { "modulo": "Fundamentos — Análise de Gráficos (08-11)", "aula": "08A - Candle Setups e Barras de Sinal" },
  "Barra de Reversão": { "modulo": "Fundamentos — Análise de Gráficos (08-11)", "aula": "08B - Candle Setups e Barras de Sinal" },
  "Barra Interna": { "modulo": "Fundamentos — Análise de Gráficos (08-11)", "aula": "08B - Candle Setups e Barras de Sinal" },
  "Barra Externa": { "modulo": "Fundamentos — Análise de Gráficos (08-11)", "aula": "08B - Candle Setups e Barras de Sinal" },
  "Padrão ii": { "modulo": "Fundamentos — Análise de Gráficos (08-11)", "aula": "08C - Candle Setups e Barras de Sinal" },
  "Modo Rompimento (BOM)": { "modulo": "Fundamentos — Análise de Gráficos (08-11)", "aula": "08C - Candle Setups e Barras de Sinal" },
  "Setup": { "modulo": "Fundamentos — Análise de Gráficos (08-11)", "aula": "08D - Candle Setups e Barras de Sinal" },
  "Correção": { "modulo": "Fundamentos — Análise de Gráficos (08-11)", "aula": "09A - Correções e Contagem de Barras" },
  "Contagem de Barras": { "modulo": "Fundamentos — Análise de Gráficos (08-11)", "aula": "09A - Correções e Contagem de Barras" },
  "H1, H2, L1, L2": { "modulo": "Fundamentos — Análise de Gráficos (08-11)", "aula": "09B - Correções e Contagem de Barras" },
  "H4 e L4 Consecutivos": { "modulo": "Fundamentos — Análise de Gráficos (08-11)", "aula": "09B - Correções e Contagem de Barras" },
  "Pressão de Compra e Venda": { "modulo": "Fundamentos — Análise de Gráficos (08-11)", "aula": "10A - Pressão de Compra e de Venda" },
  "Gap": { "modulo": "Fundamentos — Análise de Gráficos (08-11)", "aula": "11A - Gaps" },
  "Barra de Gap de Média Móvel (MAG)": { "modulo": "Fundamentos — Análise de Gráficos (08-11)", "aula": "11B - Gaps" },
  "Gap de Exaustão": { "modulo": "Fundamentos — Análise de Gráficos (08-11)", "aula": "11B - Gaps" },
  "Gap de Projeção": { "modulo": "Fundamentos — Análise de Gráficos (08-11)", "aula": "29C - Clímaxes" },
  "Micro Gap": { "modulo": "Fundamentos — Análise de Gráficos (08-11)", "aula": "11C - Gaps" },
  "Ciclo de Mercado": { "modulo": "Fundamentos — Ciclo de Mercado (12-18)", "aula": "12A - Ciclo de Mercado" },
  "Regra dos 80%": { "modulo": "Fundamentos — Ciclo de Mercado (12-18)", "aula": "12B - Ciclo de Mercado" },
  "Inércia do Mercado": { "modulo": "Fundamentos — Ciclo de Mercado (12-18)", "aula": "12B - Ciclo de Mercado" },
  "Modo Sempre Posicionado": { "modulo": "Fundamentos — Ciclo de Mercado (12-18)", "aula": "13A - Modo Sempre Posicionado" },
  "Modo Sempre Comprado": { "modulo": "Fundamentos — Ciclo de Mercado (12-18)", "aula": "13B - Modo Sempre Posicionado" },
  "Modo Sempre Vendido": { "modulo": "Fundamentos — Ciclo de Mercado (12-18)", "aula": "13B - Modo Sempre Posicionado" },
  "Tendência de Alta": { "modulo": "Fundamentos — Ciclo de Mercado (12-18)", "aula": "14A - Tendências" },
  "Tendência de Baixa": { "modulo": "Fundamentos — Ciclo de Mercado (12-18)", "aula": "14A - Tendências" },
  "Mínimas Mais Altas (HL)": { "modulo": "Fundamentos — Ciclo de Mercado (12-18)", "aula": "14A - Tendências" },
  "Máximas Mais Baixas (LH)": { "modulo": "Fundamentos — Ciclo de Mercado (12-18)", "aula": "14A - Tendências" },
  "Tendência a Partir da Abertura": { "modulo": "Fundamentos — Ciclo de Mercado (12-18)", "aula": "14D - Tendências" },
  "Canal Estreito de Alta": { "modulo": "Fundamentos — Ciclo de Mercado (12-18)", "aula": "14E - Tendências" },
  "Canal Estreito de Baixa": { "modulo": "Fundamentos — Ciclo de Mercado (12-18)", "aula": "14E - Tendências" },
  "Tendência de Correção Rasa": { "modulo": "Fundamentos — Ciclo de Mercado (12-18)", "aula": "14E - Tendências" },
  "Rompimento": { "modulo": "Fundamentos — Ciclo de Mercado (12-18)", "aula": "15A - Rompimentos" },
  "Falha de Rompimento": { "modulo": "Fundamentos — Ciclo de Mercado (12-18)", "aula": "15F - Rompimentos" },
  "Teste de Rompimento": { "modulo": "Fundamentos — Ciclo de Mercado (12-18)", "aula": "15E - Rompimentos" },
  "Armadilha de Segunda Perna": { "modulo": "Fundamentos — Ciclo de Mercado (12-18)", "aula": "15D - Rompimentos" },
  "Barra de Desistência": { "modulo": "Fundamentos — Ciclo de Mercado (12-18)", "aula": "15H - Rompimentos" },
  "Canal": { "modulo": "Fundamentos — Ciclo de Mercado (12-18)", "aula": "16A - Canais e Como Traçar Linhas" },
  "Canal de Alta": { "modulo": "Fundamentos — Ciclo de Mercado (12-18)", "aula": "16D - Canais e Como Traçar Linhas" },
  "Canal de Baixa": { "modulo": "Fundamentos — Ciclo de Mercado (12-18)", "aula": "16D - Canais e Como Traçar Linhas" },
  "Canal Amplo de Alta": { "modulo": "Fundamentos — Ciclo de Mercado (12-18)", "aula": "16D - Canais e Como Traçar Linhas" },
  "Canal Amplo de Baixa": { "modulo": "Fundamentos — Ciclo de Mercado (12-18)", "aula": "16D - Canais e Como Traçar Linhas" },
  "Micro Canal": { "modulo": "Fundamentos — Ciclo de Mercado (12-18)", "aula": "17A - Canais Estreitos e Micro Canais" },
  "Lateralidade (TR)": { "modulo": "Fundamentos — Ciclo de Mercado (12-18)", "aula": "18A - Lateralidades" },
  "Lateralidade Estreita (TTR)": { "modulo": "Fundamentos — Ciclo de Mercado (12-18)", "aula": "18D - Lateralidades" },
  "Efeito Vácuo": { "modulo": "Fundamentos — Ciclo de Mercado (12-18)", "aula": "18E - Lateralidades" },
  "Suporte e Resistência": { "modulo": "Fundamentos — Suporte, Resistência e Padrões (19-29)", "aula": "19A - Suporte e Resistência" },
  "Números Redondos": { "modulo": "Fundamentos — Suporte, Resistência e Padrões (19-29)", "aula": "19C - Suporte e Resistência" },
  "Correção de 50%": { "modulo": "Fundamentos — Suporte, Resistência e Padrões (19-29)", "aula": "19E - Suporte e Resistência" },
  "Movimento Projetado (MP)": { "modulo": "Fundamentos — Suporte, Resistência e Padrões (19-29)", "aula": "20A - Movimentos Projetados" },
  "Perna 1 = Perna 2": { "modulo": "Fundamentos — Suporte, Resistência e Padrões (19-29)", "aula": "20A - Movimentos Projetados" },
  "Reversão": { "modulo": "Fundamentos — Suporte, Resistência e Padrões (19-29)", "aula": "21A - Reversões" },
  "Reversão Majoritária de Tendência (MTR)": { "modulo": "Fundamentos — Suporte, Resistência e Padrões (19-29)", "aula": "22A - Reversões Majoritárias de Tendência (MTR)" },
  "Reversão Minoritária de Tendência": { "modulo": "Fundamentos — Suporte, Resistência e Padrões (19-29)", "aula": "21A - Reversões" },
  "Dez Barras, Duas Pernas (TBTL)": { "modulo": "Fundamentos — Suporte, Resistência e Padrões (19-29)", "aula": "21D - Reversões" },
  "Topo Duplo": { "modulo": "Fundamentos — Suporte, Resistência e Padrões (19-29)", "aula": "25A - Topos e Fundos Duplos" },
  "Fundo Duplo": { "modulo": "Fundamentos — Suporte, Resistência e Padrões (19-29)", "aula": "25A - Topos e Fundos Duplos" },
  "Bandeira Final": { "modulo": "Fundamentos — Suporte, Resistência e Padrões (19-29)", "aula": "23A - Bandeiras Finais" },
  "Cunha": { "modulo": "Fundamentos — Suporte, Resistência e Padrões (19-29)", "aula": "24A - Cunhas" },
  "Cunha Parabólica": { "modulo": "Fundamentos — Suporte, Resistência e Padrões (19-29)", "aula": "24D - Cunhas" },
  "Triângulo": { "modulo": "Fundamentos — Suporte, Resistência e Padrões (19-29)", "aula": "26A - Triângulos" },
  "Triângulo Expandido": { "modulo": "Fundamentos — Suporte, Resistência e Padrões (19-29)", "aula": "26B - Triângulos" },
  "Ombro-Cabeça-Ombro (OCO)": { "modulo": "Fundamentos — Suporte, Resistência e Padrões (19-29)", "aula": "27A - Ombro Cabeça Ombro" },
  "Topo Arredondado": { "modulo": "Fundamentos — Suporte, Resistência e Padrões (19-29)", "aula": "28 - Topos e Fundos Arredondados" },
  "Fundo Arredondado": { "modulo": "Fundamentos — Suporte, Resistência e Padrões (19-29)", "aula": "28 - Topos e Fundos Arredondados" },
  "Clímax de Compra": { "modulo": "Fundamentos — Suporte, Resistência e Padrões (19-29)", "aula": "29A - Clímaxes" },
  "Clímax de Venda": { "modulo": "Fundamentos — Suporte, Resistência e Padrões (19-29)", "aula": "29A - Clímaxes" },
  "Reversão Climática": { "modulo": "Fundamentos — Suporte, Resistência e Padrões (19-29)", "aula": "29C - Clímaxes" },
  "Equação do Trader": { "modulo": "Fundamentos — Pré-Requisitos de Como Operar (30-36)", "aula": "30A - Equação do Trader e Probabilidade" },
  "Probabilidade": { "modulo": "Fundamentos — Pré-Requisitos de Como Operar (30-36)", "aula": "30A - Equação do Trader e Probabilidade" },
  "Operação de Swing": { "modulo": "Fundamentos — Pré-Requisitos de Como Operar (30-36)", "aula": "31A - Operações de Swing e Scalp" },
  "Operação de Scalp": { "modulo": "Fundamentos — Pré-Requisitos de Como Operar (30-36)", "aula": "31A - Operações de Swing e Scalp" },
  "Ordem Stop": { "modulo": "Fundamentos — Pré-Requisitos de Como Operar (30-36)", "aula": "32A - Ordens" },
  "Ordem Limitada": { "modulo": "Fundamentos — Pré-Requisitos de Como Operar (30-36)", "aula": "32A - Ordens" },
  "Stop de Proteção": { "modulo": "Fundamentos — Pré-Requisitos de Como Operar (30-36)", "aula": "33A - Stop de Proteção" },
  "Stop Móvel": { "modulo": "Fundamentos — Pré-Requisitos de Como Operar (30-36)", "aula": "33C - Stop de Proteção" },
  "Risco Efetivo": { "modulo": "Fundamentos — Pré-Requisitos de Como Operar (30-36)", "aula": "34A - Risco Efetivo" },
  "Fracionamento de Entrada": { "modulo": "Fundamentos — Pré-Requisitos de Como Operar (30-36)", "aula": "35A - Fracionando a Entrada" },
  "Realização de Lucro": { "modulo": "Fundamentos — Pré-Requisitos de Como Operar (30-36)", "aula": "36B - Gerenciamento de Operação e Realização de Lucro" },
  "Operando MTR (Topo)": { "modulo": "Como Operar — Operando Padrões (37-42)", "aula": "38A - Operando Topos em Forma de MTR" },
  "Operando MTR (Fundo)": { "modulo": "Como Operar — Operando Padrões (37-42)", "aula": "39A - Operando Fundos em Forma de MTR" },
  "Entrando Tarde em Tendências": { "modulo": "Como Operar — Operando Padrões (37-42)", "aula": "40A - Entrando Tarde em Tendências" },
  "FOMO": { "modulo": "Como Operar — Operando Padrões (37-42)", "aula": "40A - Entrando Tarde em Tendências" },
  "Operando Rompimentos": { "modulo": "Como Operar — Operando Padrões (37-42)", "aula": "41A - Operando Rompimentos" },
  "Operando Reversões Climáticas": { "modulo": "Como Operar — Operando Padrões (37-42)", "aula": "42A - Operando Reversões Climáticas" },
  "Operando Canal Estreito de Alta": { "modulo": "Como Operar — Operando Canais e Lateralidades (43-47)", "aula": "43A - Operando Canais Estreitos de Alta" },
  "Operando Canal Estreito de Baixa": { "modulo": "Como Operar — Operando Canais e Lateralidades (43-47)", "aula": "44A - Operando Canais Estreitos de Baixa" },
  "Operando Canal Amplo de Alta": { "modulo": "Como Operar — Operando Canais e Lateralidades (43-47)", "aula": "45A - Operando Canais Amplos de Alta" },
  "Operando Canal Amplo de Baixa": { "modulo": "Como Operar — Operando Canais e Lateralidades (43-47)", "aula": "46A - Operando Canais Amplos de Baixa" },
  "Operando em Lateralidades": { "modulo": "Como Operar — Operando Canais e Lateralidades (43-47)", "aula": "47A - Operando em Lateralidades" },
  "Operando na Abertura": { "modulo": "Como Operar — Operando em Diferentes Momentos do Dia (48)", "aula": "48A - Operando na Abertura" },
  "Operando no Meio do Dia": { "modulo": "Como Operar — Operando em Diferentes Momentos do Dia (48)", "aula": "48G - Operando no Meio do Dia" },
  "Operando ao Final do Dia": { "modulo": "Como Operar — Operando em Diferentes Momentos do Dia (48)", "aula": "48I - Operando ao Final do Dia" },
  "Compra em Fechamento (BTC)": { "modulo": "Como Operar — Operando em Diferentes Momentos do Dia (48)", "aula": "48J - Operando ao Final do Dia" },
  "Venda em Fechamento (STC)": { "modulo": "Como Operar — Operando em Diferentes Momentos do Dia (48)", "aula": "48J - Operando ao Final do Dia" },
  "Gerenciando Perdas": { "modulo": "Como Operar — Gerenciando Perdas (51-52)", "aula": "51A - Perdendo por Causa de Erros" },
  "Psicologia do Trader": { "modulo": "Fundamentos — Começando (01-07)", "aula": "06 - Traços de Personalidade de Traders de Sucesso" }
}
```

- [x] **Step 2: Verificar**

Abrir `data/course-mapping.json` e confirmar que o JSON é válido (sem erros de sintaxe).

- [ ] **Step 3: Commit**

```bash
git add data/course-mapping.json
git commit -m "feat: add course mapping JSON (concept → module/lesson)"
```

---

### Task 1.3: Script de enriquecimento `js/course-mapper.js`

Este script roda uma vez (one-shot) no console do browser. Lê o JSON local e faz upsert no Supabase.

**Files:**
- Create: `js/course-mapper.js`

- [x] **Step 1: Criar o módulo**

```js
// js/course-mapper.js
// Script one-shot: enriquece a tabela `conceitos` com modulo_curso e aula_curso
// Uso: importar no console do browser ou chamar runCourseMapper() uma vez.

import { supabase } from './supabaseClient.js';

export async function runCourseMapper() {
    // Carregar o JSON de mapeamento
    const res = await fetch('./data/course-mapping.json');
    const mapping = await res.json();

    const entries = Object.entries(mapping);
    let updated = 0;
    let notFound = 0;
    const notFoundList = [];

    for (const [conceito, { modulo, aula }] of entries) {
        const { data, error } = await supabase
            .from('conceitos')
            .update({ modulo_curso: modulo, aula_curso: aula })
            .eq('conceito', conceito)
            .select('id');

        if (error) {
            console.error(`Erro ao atualizar "${conceito}":`, error.message);
        } else if (!data || data.length === 0) {
            notFoundList.push(conceito);
            notFound++;
        } else {
            updated++;
        }
    }

    console.log(`✅ Mapeamento concluído: ${updated} conceitos atualizados.`);
    if (notFound > 0) {
        console.warn(`⚠️ ${notFound} conceitos não encontrados no banco:`, notFoundList);
    }

    return { updated, notFound, notFoundList };
}
```

- [x] **Step 2: Expor no `window` para uso no console**

No `js/app.js`, adicionar após os imports:

```js
// Expõe o mapper para uso pontual via console do browser (apenas dev)
import { runCourseMapper } from './course-mapper.js';
window.__runCourseMapper = runCourseMapper;
```

- [ ] **Step 3: Executar o mapper**

Abrir o app no browser → abrir o DevTools (F12) → Console → digitar:

```js
await window.__runCourseMapper()
```

Verificar output. Confirmar que `updated` > 0. Anotar os `notFoundList` para ajuste manual.

- [ ] **Step 4: Verificar no Supabase**

No Supabase Dashboard → Table Editor → `conceitos` → confirmar que `modulo_curso` e `aula_curso` estão preenchidos em vários registros.

- [ ] **Step 5: Commit**

```bash
git add js/course-mapper.js js/app.js
git commit -m "feat: add course-mapper one-shot enrichment script"
```

---

### Task 1.4: UI elegante do módulo/aula no `concept-detail.js`

Substituir o badge simples atual por um componente rico que mostra módulo + aula + link de navegação para a lista filtrada por módulo.

**Files:**
- Modify: `js/concept-detail.js`

- [x] **Step 1: Localizar o trecho atual do módulo no concept-detail**

No arquivo `js/concept-detail.js`, encontrar o trecho (linhas ~289-295):

```js
${concept.moduloCurso ? `
  <div class="w-px h-4 bg-zinc-200"></div>
  <div class="flex items-center gap-1.5 text-xs">
    <span class="text-zinc-400 font-medium">Módulos:</span>
    <span class="font-semibold text-zinc-800">${concept.moduloCurso}</span>
  </div>
` : ''}
```

- [x] **Step 2: Substituir pelo novo componente**

Substituir o trecho acima por:

```js
${(concept.moduloCurso || concept.aulaCurso) ? `
  <div class="w-px h-4 bg-zinc-200"></div>
  <button
    id="course-badge-btn"
    class="flex items-center gap-1.5 text-xs group hover:opacity-80 transition-opacity"
    title="Ver todos os conceitos deste módulo"
  >
    <i data-lucide="book-open" class="w-3 h-3 text-indigo-400 shrink-0"></i>
    <span class="text-zinc-400 font-medium">Módulo:</span>
    <span class="font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded text-[10px] group-hover:bg-indigo-100 transition-colors truncate max-w-[180px]"
      title="${concept.aulaCurso || concept.moduloCurso}">
      ${concept.aulaCurso || concept.moduloCurso}
    </span>
  </button>
` : ''}
```

- [x] **Step 3: Adicionar listener no `course-badge-btn`**

No bloco de event listeners do `renderConceptDetail` (após os listeners de tabs), adicionar:

```js
// Badge módulo/aula → filtra lista de conceitos pelo mesmo módulo
document.getElementById('course-badge-btn')?.addEventListener('click', () => {
    // Importa store e navega para a lista de conceitos com filtro de módulo
    import('./state.js').then(({ store }) => {
        store.setState({
            selectedConceptId: null,
            currentPage: 'concepts',
            conceptSearchTerm: concept.moduloCurso || ''
        });
    });
});
```

- [ ] **Step 4: Verificar visualmente**

Abrir um conceito que tem `moduloCurso` preenchido → confirmar badge indigo aparece → clicar → confirmar navega para lista filtrada pelo módulo.

- [ ] **Step 5: Commit**

```bash
git add js/concept-detail.js
git commit -m "feat: elegant module/aula badge in concept-detail with navigation"
```

---

## Chunk 2: Sistema de Notas Livres (`/notes`)

### Contexto
Uma nova área de notas livres estilo Notion: hierarquia de páginas, editor Tiptap full-page, suporte a .md via paste (já funciona no rich-editor), linkar conceitos por `[[nome]]`. Existe ao lado do fluxo de conceitos — o usuário pode criar notas de qualquer assunto, organizar em sub-páginas, e referenciar conceitos do banco.

O editor Tiptap já está carregado globalmente via `tiptap-loader.js`. Reutilizamos `createRichEditor` de `rich-editor.js`.

### Arquivos
- **Criar:** `js/notes.js` — view principal `/notes` com sidebar de hierarquia + editor
- **Criar:** `js/notes-editor.js` — wrapper do editor de nota individual (modo foco + full-page)
- **Modificar:** `js/sidebar.js` — adicionar item "Notas" no nav
- **Modificar:** `js/app.js` — adicionar rota `/notes` + `/notes/:id`
- **Modificar:** `js/dataService.js` — CRUD para `free_notes`
- **Criar:** `supabase/migrations/003_free_notes.sql`

---

### Task 2.1: Migration SQL — tabela `free_notes`

**Files:**
- Create: `supabase/migrations/003_free_notes.sql`

- [x] **Step 1: Criar o arquivo de migration**

```sql
-- supabase/migrations/003_free_notes.sql
-- Tabela de notas livres estilo Notion: hierárquica, suporta conteúdo Tiptap HTML

CREATE TABLE free_notes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title        TEXT NOT NULL DEFAULT 'Sem título',
  emoji        TEXT DEFAULT '',
  content_html TEXT NOT NULL DEFAULT '',
  content_text TEXT NOT NULL DEFAULT '',
  parent_id    UUID REFERENCES free_notes(id) ON DELETE CASCADE,
  sort_order   INT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índice para buscar filhos de um pai (montagem da árvore)
CREATE INDEX idx_free_notes_parent ON free_notes(parent_id);

-- Índice full-text para busca dentro das notas
CREATE INDEX idx_free_notes_fts ON free_notes
  USING gin(to_tsvector('portuguese', content_text));

-- RLS desabilitado (projeto single-user, sem auth)
ALTER TABLE free_notes DISABLE ROW LEVEL SECURITY;
```

- [ ] **Step 2: Executar no Supabase**

Supabase Dashboard → SQL Editor → executar o SQL acima.

Verificar: Table Editor → `free_notes` aparece com as colunas corretas.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/003_free_notes.sql
git commit -m "feat: add free_notes table migration"
```

---

### Task 2.2: CRUD de notas livres em `dataService.js`

**Files:**
- Modify: `js/dataService.js`

- [x] **Step 1: Adicionar as funções CRUD no final de `dataService.js`**

```js
// ─── FREE_NOTES ───────────────────────────────────────────────────────────────

/**
 * Busca toda a árvore de notas (sem content_html para performance na sidebar).
 * @returns {Promise<Array>}
 */
export async function getAllNotes() {
    const { data, error } = await supabase
        .from('free_notes')
        .select('id, title, emoji, parent_id, sort_order, created_at, updated_at')
        .order('sort_order', { ascending: true });
    if (error) { console.error('getAllNotes:', error); return []; }
    return data;
}

/**
 * Busca uma nota individual com conteúdo completo.
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
export async function getNoteById(id) {
    const { data, error } = await supabase
        .from('free_notes')
        .select('*')
        .eq('id', id)
        .single();
    if (error) { console.error('getNoteById:', error); return null; }
    return data;
}

/**
 * Cria uma nova nota.
 * @param {Object} fields - { title, emoji, parent_id, sort_order }
 * @returns {Promise<Object|null>}
 */
export async function createNote(fields = {}) {
    const { data, error } = await supabase
        .from('free_notes')
        .insert({
            title: fields.title || 'Sem título',
            emoji: fields.emoji || '',
            parent_id: fields.parent_id || null,
            sort_order: fields.sort_order || 0,
            content_html: '',
            content_text: ''
        })
        .select()
        .single();
    if (error) { console.error('createNote:', error); return null; }
    return data;
}

/**
 * Atualiza título/emoji de uma nota (usado pelo inline rename).
 * @param {string} id
 * @param {Object} fields - { title?, emoji? }
 */
export async function updateNoteMetadata(id, fields) {
    const { error } = await supabase
        .from('free_notes')
        .update({ ...fields, updated_at: new Date().toISOString() })
        .eq('id', id);
    if (error) console.error('updateNoteMetadata:', error);
}

/**
 * Salva o conteúdo (auto-save do editor).
 * @param {string} id
 * @param {string} content_html
 * @param {string} content_text
 */
export async function saveNoteContent(id, content_html, content_text) {
    const { error } = await supabase
        .from('free_notes')
        .update({ content_html, content_text, updated_at: new Date().toISOString() })
        .eq('id', id);
    if (error) console.error('saveNoteContent:', error);
}

/**
 * Deleta uma nota (CASCADE apaga sub-páginas automaticamente).
 * @param {string} id
 */
export async function deleteNote(id) {
    const { error } = await supabase
        .from('free_notes')
        .delete()
        .eq('id', id);
    if (error) console.error('deleteNote:', error);
}
```

- [ ] **Step 2: Verificar**

No browser DevTools Console, importar o módulo e testar:
```js
const ds = await import('./js/dataService.js');
const n = await ds.createNote({ title: 'Teste' });
console.log(n); // deve retornar objeto com id UUID
await ds.deleteNote(n.id);
```

- [ ] **Step 3: Commit**

```bash
git add js/dataService.js
git commit -m "feat: add CRUD functions for free_notes in dataService"
```

---

### Task 2.3: View principal de notas `js/notes.js`

Layout: painel esquerdo = árvore de páginas, painel direito = editor. Em mobile, a árvore colapsa.

**Files:**
- Create: `js/notes.js`

- [x] **Step 1: Criar o módulo `js/notes.js`**

```js
// js/notes.js
// View principal /notes: sidebar de hierarquia + editor Tiptap full-page

import { store } from './state.js';
import {
    getAllNotes, getNoteById, createNote,
    updateNoteMetadata, saveNoteContent, deleteNote
} from './dataService.js';
import { createRichEditor } from './rich-editor.js';

// ─── Estado local ──────────────────────────────────────────────────────────────
let notesTree = [];          // array flat de notas (sem content)
let activeNoteId = null;     // id da nota aberta no editor
let activeEditor = null;     // instância Tiptap ativa
let saveTimeout = null;

// ─── Ponto de entrada ─────────────────────────────────────────────────────────

export async function renderNotes(container) {
    container.innerHTML = `
      <div class="flex h-full" id="notes-root">
        <!-- Sidebar de notas -->
        <aside id="notes-sidebar"
          class="w-56 shrink-0 border-r border-zinc-200 bg-white flex flex-col h-full overflow-y-auto hidden md:flex">
          <div class="flex items-center justify-between px-4 py-3 border-b border-zinc-100">
            <span class="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Notas</span>
            <button id="new-root-note-btn"
              title="Nova nota"
              class="p-1 rounded hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 transition-colors">
              <i data-lucide="plus" class="w-4 h-4"></i>
            </button>
          </div>
          <div id="notes-tree" class="flex-1 overflow-y-auto py-2 px-2"></div>
        </aside>

        <!-- Editor area -->
        <main id="notes-editor-area" class="flex-1 flex flex-col h-full overflow-hidden">
          <div id="notes-editor-placeholder"
            class="flex-1 flex flex-col items-center justify-center text-zinc-400 select-none gap-3">
            <i data-lucide="file-text" class="w-10 h-10 opacity-30"></i>
            <p class="text-sm">Selecione uma nota ou crie uma nova</p>
            <button id="new-note-from-placeholder-btn"
              class="mt-1 px-4 py-2 bg-zinc-900 text-white text-xs font-medium rounded-lg hover:bg-zinc-800 transition-colors">
              Nova Nota
            </button>
          </div>
          <div id="notes-editor-wrapper" class="flex-1 flex flex-col h-full overflow-hidden hidden">
            <!-- Header da nota -->
            <div id="notes-editor-header"
              class="flex items-center gap-3 px-8 py-4 border-b border-zinc-100 bg-white shrink-0">
              <button id="notes-emoji-btn"
                class="text-2xl hover:opacity-70 transition-opacity leading-none" title="Mudar emoji">
                📄
              </button>
              <input id="notes-title-input" type="text"
                placeholder="Sem título"
                class="flex-1 text-xl font-bold text-zinc-900 bg-transparent border-none outline-none placeholder:text-zinc-300"
              />
              <div class="flex items-center gap-2 shrink-0">
                <span id="notes-save-indicator"
                  class="text-[10px] text-emerald-600 font-medium opacity-0 transition-opacity duration-300">
                  Salvo
                </span>
                <button id="notes-focus-btn"
                  title="Modo foco (tela cheia)"
                  class="p-1.5 rounded hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 transition-colors">
                  <i data-lucide="maximize-2" class="w-4 h-4"></i>
                </button>
                <button id="notes-delete-btn"
                  title="Deletar nota"
                  class="p-1.5 rounded hover:bg-red-50 text-zinc-400 hover:text-red-500 transition-colors">
                  <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
              </div>
            </div>

            <!-- Toolbar Tiptap -->
            <div class="rich-toolbar" id="notes-rich-toolbar" style="display:none;"></div>

            <!-- Editor Tiptap -->
            <div class="flex-1 overflow-y-auto">
              <div id="notes-rich-editor"
                class="min-h-full max-w-3xl mx-auto px-8 py-6">
              </div>
            </div>
          </div>
        </main>
      </div>
    `;

    if (window.lucide) window.lucide.createIcons();

    // Carregar a árvore de notas
    await loadAndRenderTree();

    // Listeners
    document.getElementById('new-root-note-btn')?.addEventListener('click', () => createAndOpenNote(null));
    document.getElementById('new-note-from-placeholder-btn')?.addEventListener('click', () => createAndOpenNote(null));
    document.getElementById('notes-focus-btn')?.addEventListener('click', toggleFocusMode);
    document.getElementById('notes-delete-btn')?.addEventListener('click', handleDeleteNote);
}

// ─── Árvore de notas ──────────────────────────────────────────────────────────

async function loadAndRenderTree() {
    notesTree = await getAllNotes();
    renderTree();
}

function buildTree(nodes, parentId = null) {
    return nodes
        .filter(n => (n.parent_id || null) === parentId)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map(n => ({ ...n, children: buildTree(nodes, n.id) }));
}

function renderTree() {
    const container = document.getElementById('notes-tree');
    if (!container) return;
    const tree = buildTree(notesTree);
    container.innerHTML = tree.length > 0
        ? tree.map(n => renderTreeNode(n, 0)).join('')
        : `<p class="text-xs text-zinc-400 px-2 py-1">Nenhuma nota ainda</p>`;
    if (window.lucide) window.lucide.createIcons();

    // Listeners dos nós
    container.querySelectorAll('[data-note-id]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.getAttribute('data-note-id');
            if (id) openNote(id);
        });
    });

    // Botões de sub-nota
    container.querySelectorAll('[data-new-child-id]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const parentId = e.currentTarget.getAttribute('data-new-child-id');
            createAndOpenNote(parentId);
        });
    });
}

function renderTreeNode(node, depth) {
    const indent = depth * 12;
    const isActive = node.id === activeNoteId;
    const activeClass = isActive ? 'bg-zinc-100 text-zinc-900' : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900';
    const emoji = node.emoji || '📄';

    const childrenHtml = node.children && node.children.length > 0
        ? node.children.map(c => renderTreeNode(c, depth + 1)).join('')
        : '';

    return `
      <div>
        <button data-note-id="${node.id}"
          class="w-full flex items-center gap-1.5 py-1 px-2 rounded-md text-[13px] transition-colors group ${activeClass}"
          style="padding-left: ${indent + 8}px">
          <span class="shrink-0 text-sm leading-none">${emoji}</span>
          <span class="flex-1 truncate text-left">${node.title || 'Sem título'}</span>
          <button data-new-child-id="${node.id}"
            class="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-zinc-200 transition-all shrink-0"
            title="Nova sub-nota">
            <i data-lucide="plus" class="w-3 h-3"></i>
          </button>
        </button>
        ${childrenHtml}
      </div>
    `;
}

// ─── Abrir / criar nota ───────────────────────────────────────────────────────

async function openNote(id) {
    if (activeNoteId === id) return;
    activeNoteId = id;

    // Highlight na sidebar
    renderTree();

    // Mostrar wrapper, esconder placeholder
    document.getElementById('notes-editor-placeholder')?.classList.add('hidden');
    const wrapper = document.getElementById('notes-editor-wrapper');
    wrapper?.classList.remove('hidden');

    // Buscar nota completa (com content)
    const note = await getNoteById(id);
    if (!note) return;

    // Preencher título e emoji
    const titleInput = document.getElementById('notes-title-input');
    const emojiBtn = document.getElementById('notes-emoji-btn');
    if (titleInput) titleInput.value = note.title || '';
    if (emojiBtn) emojiBtn.textContent = note.emoji || '📄';

    // Listener de rename com debounce
    titleInput?.addEventListener('input', debounceTitle(note.id));

    // Inicializar editor Tiptap
    if (activeEditor) {
        activeEditor.destroy();
        activeEditor = null;
    }
    const editorEl = document.getElementById('notes-rich-editor');
    if (editorEl) editorEl.innerHTML = ''; // limpar para nova instância

    // Toolbar buttons para o editor de notas
    const toolbar = document.getElementById('notes-rich-toolbar');
    if (toolbar) {
        toolbar.innerHTML = `
          <button data-action="bold" title="Negrito"><i data-lucide="bold" class="w-3.5 h-3.5"></i></button>
          <button data-action="italic" title="Itálico"><i data-lucide="italic" class="w-3.5 h-3.5"></i></button>
          <button data-action="strike" title="Tachado"><i data-lucide="strikethrough" class="w-3.5 h-3.5"></i></button>
          <div class="toolbar-sep"></div>
          <button data-action="h1" title="Título 1"><i data-lucide="heading-1" class="w-4 h-4"></i></button>
          <button data-action="h2" title="Título 2"><i data-lucide="heading-2" class="w-4 h-4"></i></button>
          <button data-action="h3" title="Título 3"><i data-lucide="heading-3" class="w-4 h-4"></i></button>
          <div class="toolbar-sep"></div>
          <button data-action="highlight" title="Destaque"><i data-lucide="highlighter" class="w-3.5 h-3.5"></i></button>
          <button data-action="bulletList" title="Lista"><i data-lucide="list" class="w-3.5 h-3.5"></i></button>
          <button data-action="orderedList" title="Lista numerada"><i data-lucide="list-ordered" class="w-3.5 h-3.5"></i></button>
          <button data-action="taskList" title="Checklist"><i data-lucide="check-square" class="w-3.5 h-3.5"></i></button>
          <div class="toolbar-sep"></div>
          <button data-action="blockquote" title="Citação"><i data-lucide="quote" class="w-3.5 h-3.5"></i></button>
          <button data-action="codeBlock" title="Bloco de código"><i data-lucide="code" class="w-3.5 h-3.5"></i></button>
          <button data-action="horizontalRule" title="Divisor"><i data-lucide="minus" class="w-3.5 h-3.5"></i></button>
        `;
        if (window.lucide) window.lucide.createIcons({ nodes: toolbar.querySelectorAll('[data-lucide]') });
    }

    const { attachFloatingToolbar } = await import('./rich-editor.js');
    activeEditor = await createRichEditor('notes-rich-editor', note.content_html || '', async (html, text) => {
        await saveNoteContent(id, html, text);
        const indicator = document.getElementById('notes-save-indicator');
        if (indicator) {
            indicator.style.opacity = '1';
            setTimeout(() => { indicator.style.opacity = '0'; }, 2000);
        }
        // Atualizar cache local da árvore (sem conteúdo)
        const idx = notesTree.findIndex(n => n.id === id);
        if (idx >= 0) notesTree[idx].updated_at = new Date().toISOString();
    });

    if (activeEditor && toolbar) {
        attachFloatingToolbar(activeEditor, toolbar);
        toolbar.querySelectorAll('button[data-action]').forEach(btn => {
            btn.addEventListener('mousedown', (e) => {
                e.preventDefault();
                const action = btn.getAttribute('data-action');
                switch (action) {
                    case 'bold':          activeEditor.chain().focus().toggleBold().run(); break;
                    case 'italic':        activeEditor.chain().focus().toggleItalic().run(); break;
                    case 'strike':        activeEditor.chain().focus().toggleStrike().run(); break;
                    case 'h1':            activeEditor.chain().focus().toggleHeading({ level: 1 }).run(); break;
                    case 'h2':            activeEditor.chain().focus().toggleHeading({ level: 2 }).run(); break;
                    case 'h3':            activeEditor.chain().focus().toggleHeading({ level: 3 }).run(); break;
                    case 'highlight':     activeEditor.chain().focus().toggleHighlight().run(); break;
                    case 'bulletList':    activeEditor.chain().focus().toggleBulletList().run(); break;
                    case 'orderedList':   activeEditor.chain().focus().toggleOrderedList().run(); break;
                    case 'taskList':      activeEditor.chain().focus().toggleTaskList().run(); break;
                    case 'blockquote':    activeEditor.chain().focus().toggleBlockquote().run(); break;
                    case 'codeBlock':     activeEditor.chain().focus().toggleCodeBlock().run(); break;
                    case 'horizontalRule': activeEditor.chain().focus().setHorizontalRule().run(); break;
                }
            });
        });
    }
}

async function createAndOpenNote(parentId) {
    const note = await createNote({ parent_id: parentId, sort_order: notesTree.length });
    if (!note) return;
    notesTree.push({ id: note.id, title: note.title, emoji: note.emoji, parent_id: note.parent_id, sort_order: note.sort_order });
    await openNote(note.id);
    // Focar no título para renomear imediatamente
    setTimeout(() => document.getElementById('notes-title-input')?.focus(), 100);
}

async function handleDeleteNote() {
    if (!activeNoteId) return;
    const confirmed = confirm('Deletar esta nota e todas as sub-páginas?');
    if (!confirmed) return;
    await deleteNote(activeNoteId);
    notesTree = notesTree.filter(n => n.id !== activeNoteId);
    activeNoteId = null;
    if (activeEditor) { activeEditor.destroy(); activeEditor = null; }
    document.getElementById('notes-editor-wrapper')?.classList.add('hidden');
    document.getElementById('notes-editor-placeholder')?.classList.remove('hidden');
    renderTree();
}

// ─── Modo Foco (full-screen) ──────────────────────────────────────────────────

function toggleFocusMode() {
    const root = document.getElementById('notes-root');
    const sidebar = document.getElementById('notes-sidebar');
    const focusBtn = document.getElementById('notes-focus-btn');
    if (!root) return;

    const isFocus = root.classList.toggle('notes-focus-mode');
    if (isFocus) {
        sidebar?.classList.add('hidden');
        focusBtn?.setAttribute('title', 'Sair do modo foco');
        if (window.lucide) {
            focusBtn?.querySelector('[data-lucide]')?.setAttribute('data-lucide', 'minimize-2');
            window.lucide.createIcons({ nodes: focusBtn?.querySelectorAll('[data-lucide]') });
        }
    } else {
        sidebar?.classList.remove('hidden');
        sidebar?.classList.add('md:flex');
        focusBtn?.setAttribute('title', 'Modo foco (tela cheia)');
        if (window.lucide) {
            focusBtn?.querySelector('[data-lucide]')?.setAttribute('data-lucide', 'maximize-2');
            window.lucide.createIcons({ nodes: focusBtn?.querySelectorAll('[data-lucide]') });
        }
    }
}

// ─── Utilitários ──────────────────────────────────────────────────────────────

function debounceTitle(noteId) {
    let t;
    return (e) => {
        clearTimeout(t);
        t = setTimeout(async () => {
            const title = e.target.value.trim() || 'Sem título';
            await updateNoteMetadata(noteId, { title });
            const idx = notesTree.findIndex(n => n.id === noteId);
            if (idx >= 0) notesTree[idx].title = title;
            renderTree();
        }, 800);
    };
}
```

- [ ] **Step 2: Verificar**

Abrir o browser. No console:
```js
await window.location.reload(); // reload para carregar o módulo
```
Por enquanto o módulo existe mas não está conectado às rotas. Verificar ausência de erros de sintaxe no console.

- [ ] **Step 3: Commit**

```bash
git add js/notes.js
git commit -m "feat: add notes.js view with hierarchy tree + Tiptap editor"
```

---

### Task 2.4: Adicionar rota `/notes` no roteador

**Files:**
- Modify: `js/app.js`
- Modify: `js/sidebar.js`

- [x] **Step 1: Adicionar import e case no `app.js`**

Em `js/app.js`, adicionar o import junto aos outros:

```js
import { renderNotes } from './notes.js';
```

No `switch (state.currentPage)` adicionar o case:

```js
case 'notes':
    if (currentViewType !== 'notes') {
        renderNotes(viewContainer);
    }
    break;
```

- [x] **Step 2: Adicionar item na sidebar**

Em `js/sidebar.js`, na constante `navItems`:

```js
const navItems = [
  { id: 'dashboard',     label: 'Dashboard',        icon: 'layout-dashboard' },
  { id: 'roadmap',       label: 'Trilha de Estudo',  icon: 'target' },
  { id: 'concepts',      label: 'Conceitos',         icon: 'library' },
  { id: 'notes',         label: 'Notas',             icon: 'notebook-pen' },   // ← novo
  { id: 'decision-tree', label: 'Árvore de Decisão', icon: 'git-merge' },
  { id: 'sessions',      label: 'Sessões',           icon: 'calendar-days' },
];
```

- [x] **Step 3: Adicionar estilos de modo foco em `css/style.css`**

No final de `css/style.css` adicionar:

```css
/* Modo foco: notas ocupam tela inteira */
#notes-root.notes-focus-mode #notes-editor-wrapper {
  position: fixed;
  inset: 0;
  z-index: 50;
  background: white;
  display: flex;
  flex-direction: column;
}

#notes-root.notes-focus-mode #notes-editor-header {
  max-width: 100%;
}

#notes-root.notes-focus-mode #notes-rich-editor {
  max-width: 720px;
}
```

- [ ] **Step 4: Verificar**

Abrir o app → clicar em "Notas" na sidebar → deve renderizar a view. Criar uma nota, digitar no editor, confirmar que o título renomeia e aparece na árvore. Testar modo foco.

- [ ] **Step 5: Commit**

```bash
git add js/app.js js/sidebar.js css/style.css
git commit -m "feat: add /notes route to router and sidebar navigation"
```

---

### Task 2.5: Modo foco no concept-detail (editor expand)

O concept-detail também ganha o botão de "modo foco" para expandir o editor Tiptap da aba Descrição para full-screen.

**Files:**
- Modify: `js/concept-detail.js`

- [x] **Step 1: Adicionar botão de modo foco no header da aba Descrição**

Na função `renderDescTab()` em `concept-detail.js`, no `<div class="flex items-center justify-between mb-3">`, adicionar o botão após o save-indicator:

```js
<button id="desc-focus-btn"
  title="Modo foco"
  class="p-1 rounded hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 transition-colors">
  <i data-lucide="maximize-2" class="w-3.5 h-3.5"></i>
</button>
```

- [x] **Step 2: Adicionar listener de modo foco**

No bloco de inicialização do editor (após `attachFloatingToolbar`), adicionar:

```js
document.getElementById('desc-focus-btn')?.addEventListener('click', () => {
    const editorContainer = document.getElementById('rich-editor-container');
    const detailContent = document.getElementById('concept-detail-content');
    const isFocus = editorContainer?.classList.toggle('desc-focus-mode');
    if (isFocus) {
        editorContainer.style.cssText = `
          position: fixed; inset: 0; z-index: 50;
          background: white; padding: 2rem;
          overflow-y: auto; max-width: 100%;
          border-radius: 0; border: none;
          box-shadow: none;
        `;
        document.getElementById('desc-focus-btn')
            ?.querySelector('[data-lucide]')?.setAttribute('data-lucide', 'minimize-2');
    } else {
        editorContainer.style.cssText = '';
        document.getElementById('desc-focus-btn')
            ?.querySelector('[data-lucide]')?.setAttribute('data-lucide', 'maximize-2');
    }
    if (window.lucide) window.lucide.createIcons({
        nodes: document.getElementById('desc-focus-btn')?.querySelectorAll('[data-lucide]')
    });
    editor?.commands.focus();
});
```

- [ ] **Step 3: Verificar**

Abrir um conceito → aba Descrição → clicar no botão de expandir → editor ocupa a tela toda. Clicar novamente → volta ao normal.

- [ ] **Step 4: Commit**

```bash
git add js/concept-detail.js
git commit -m "feat: add focus mode button to concept description editor"
```

---

## Chunk 3: Grafo de Conhecimento (`/graph`)

### Contexto
O grafo de conhecimento tem dois modos:
1. **Grafo visual** (D3 force-directed): nós = conceitos, arestas = pré-requisitos + mesma subcategoria. Clicar num nó navega para o conceito.
2. **Busca em cascata**: campo de busca → resultados em cards expansíveis → cada card mostra os conceitos conectados.

As arestas são derivadas dos dados existentes — não precisamos de uma tabela nova. Fonte das arestas:
- `prerequisito` (já existe em `conceitos`) → aresta direcional "requer"
- Mesma `subcategoria` → aresta implícita "relacionado"

### Arquivos
- **Criar:** `js/graph.js` — view `/graph` completa (D3 + busca)
- **Modificar:** `js/app.js` — rota `/graph`
- **Modificar:** `js/sidebar.js` — item "Grafo" no nav
- **Modificar:** `index.html` — CDN do D3.js

---

### Task 3.1: Adicionar D3.js ao `index.html`

**Files:**
- Modify: `index.html`

- [x] **Step 1: Adicionar script D3 no `<head>`**

Em `index.html`, após a linha do Lucide Icons, adicionar:

```html
<!-- D3.js v7 — grafo de conhecimento -->
<script src="https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js"></script>
```

- [ ] **Step 2: Verificar**

Após recarregar o app no browser: `typeof d3` no console → deve retornar `"object"`.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: add D3.js v7 CDN for knowledge graph"
```

---

### Task 3.2: Criar `js/graph.js`

**Files:**
- Create: `js/graph.js`

- [x] **Step 1: Criar o módulo**

```js
// js/graph.js
// View /graph: grafo de conhecimento (D3 force-directed) + busca em cascata

import { store } from './state.js';

// ─── Ponto de entrada ─────────────────────────────────────────────────────────

export function renderGraph(container) {
    container.innerHTML = `
      <div class="flex flex-col h-full" id="graph-root">

        <!-- Header / controles -->
        <div class="flex items-center gap-3 px-6 py-3 border-b border-zinc-200 bg-white shrink-0 flex-wrap">
          <h2 class="text-sm font-semibold text-zinc-900 shrink-0">Grafo de Conhecimento</h2>
          <div class="relative flex-1 min-w-[200px] max-w-sm">
            <i data-lucide="search" class="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2"></i>
            <input id="graph-search" type="text" placeholder="Pesquisar conceito..."
              class="w-full bg-white border border-zinc-200 text-zinc-800 text-xs rounded-lg pl-8 pr-3 py-2 focus:outline-none focus:border-zinc-400 transition-colors"
            />
          </div>
          <div class="flex items-center gap-2 ml-auto">
            <button id="graph-view-visual"
              class="px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-900 text-white transition-colors"
              title="Visão de grafo">
              <i data-lucide="git-network" class="w-3.5 h-3.5 inline-block mr-1"></i>Grafo
            </button>
            <button id="graph-view-cascade"
              class="px-3 py-1.5 text-xs font-medium rounded-lg bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-50 transition-colors"
              title="Navegação em cascata">
              <i data-lucide="list-tree" class="w-3.5 h-3.5 inline-block mr-1"></i>Cascata
            </button>
          </div>
        </div>

        <!-- Área principal -->
        <div class="flex-1 relative overflow-hidden">
          <!-- Grafo visual D3 -->
          <div id="graph-visual" class="absolute inset-0">
            <svg id="graph-svg" width="100%" height="100%"></svg>
            <!-- Tooltip -->
            <div id="graph-tooltip"
              class="absolute hidden bg-zinc-900 text-white text-xs rounded-lg px-3 py-2 pointer-events-none max-w-[200px] shadow-lg z-10">
            </div>
          </div>

          <!-- Busca em cascata -->
          <div id="graph-cascade" class="absolute inset-0 overflow-y-auto p-6 hidden">
            <div id="graph-cascade-results" class="max-w-2xl mx-auto space-y-3"></div>
          </div>
        </div>
      </div>
    `;

    if (window.lucide) window.lucide.createIcons();

    // Dados do store
    const state = store.getState();
    const { graphNodes, graphEdges } = buildGraphData(state.concepts || []);

    // Inicializar D3 visual
    initD3Graph(graphNodes, graphEdges, state);

    // Event listeners
    const searchInput = document.getElementById('graph-search');
    searchInput?.addEventListener('input', (e) => {
        const term = e.target.value.trim();
        if (term.length < 2) {
            clearCascadeResults();
        } else {
            showCascadeResults(term, graphNodes, graphEdges, state);
            setViewMode('cascade');
        }
    });

    document.getElementById('graph-view-visual')?.addEventListener('click', () => setViewMode('visual'));
    document.getElementById('graph-view-cascade')?.addEventListener('click', () => {
        const term = searchInput?.value.trim() || '';
        if (term.length >= 2) showCascadeResults(term, graphNodes, graphEdges, state);
        setViewMode('cascade');
    });
}

// ─── Construção dos dados do grafo ────────────────────────────────────────────

function buildGraphData(concepts) {
    const nodes = concepts.map(c => ({
        id: c.id,
        name: c.name,
        category: c.category,
        macroCategory: c.macroCategory || 'Fundamento',
        mastery: c.masteryPercentage || 0,
        abcCategory: c.abcCategory || 'C'
    }));

    const edges = [];
    const nodeIds = new Set(nodes.map(n => n.id));

    concepts.forEach(c => {
        // Aresta de pré-requisito
        if (c.prerequisite && c.prerequisite !== 'Nenhum' && nodeIds.has(c.prerequisite)) {
            edges.push({ source: c.prerequisite, target: c.id, type: 'prerequisite' });
        }
    });

    // Arestas de mesma subcategoria (limitar a 3 por nó para não poluir)
    const bySubcat = {};
    concepts.forEach(c => {
        if (!c.subcategory) return;
        if (!bySubcat[c.subcategory]) bySubcat[c.subcategory] = [];
        bySubcat[c.subcategory].push(c.id);
    });
    Object.values(bySubcat).forEach(group => {
        if (group.length < 2 || group.length > 12) return; // evitar clusters gigantes
        for (let i = 0; i < group.length - 1; i++) {
            edges.push({ source: group[i], target: group[i + 1], type: 'related' });
        }
    });

    return { graphNodes: nodes, graphEdges: edges };
}

// ─── D3 Force Graph ───────────────────────────────────────────────────────────

function initD3Graph(nodes, edges, state) {
    const svg = d3.select('#graph-svg');
    const container = document.getElementById('graph-visual');
    if (!container || !window.d3) return;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    svg.attr('viewBox', [0, 0, width, height]);

    // Cor por mastery
    const masteryColor = (mastery) => {
        if (mastery >= 85) return '#10b981'; // emerald
        if (mastery >= 50) return '#f59e0b'; // amber
        if (mastery > 0)   return '#ef4444'; // red
        return '#94a3b8';                    // slate (nunca estudado)
    };

    // Raio pelo macroCategory
    const macroRadius = { 'Fundamento': 5, 'Operacional': 6, 'Regras': 5, 'Probabilidades': 5 };

    // Simulação de forças
    const simulation = d3.forceSimulation(nodes)
        .force('link', d3.forceLink(edges).id(d => d.id).distance(60).strength(0.4))
        .force('charge', d3.forceManyBody().strength(-120))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collision', d3.forceCollide(12));

    // Zoom e pan
    const g = svg.append('g');
    svg.call(d3.zoom()
        .scaleExtent([0.2, 3])
        .on('zoom', (event) => g.attr('transform', event.transform)));

    // Arestas
    const link = g.append('g')
        .selectAll('line')
        .data(edges)
        .join('line')
        .attr('stroke', d => d.type === 'prerequisite' ? '#6366f1' : '#e2e8f0')
        .attr('stroke-opacity', d => d.type === 'prerequisite' ? 0.6 : 0.3)
        .attr('stroke-width', d => d.type === 'prerequisite' ? 1.5 : 1);

    // Nós
    const node = g.append('g')
        .selectAll('circle')
        .data(nodes)
        .join('circle')
        .attr('r', d => macroRadius[d.macroCategory] || 5)
        .attr('fill', d => masteryColor(d.mastery))
        .attr('stroke', '#fff')
        .attr('stroke-width', 1.5)
        .style('cursor', 'pointer')
        .call(d3.drag()
            .on('start', dragstarted)
            .on('drag', dragged)
            .on('end', dragended));

    // Labels (apenas nós com mastery > 0 ou em hover)
    const label = g.append('g')
        .selectAll('text')
        .data(nodes.filter(n => n.mastery >= 50))
        .join('text')
        .text(d => d.name.length > 20 ? d.name.slice(0, 18) + '…' : d.name)
        .attr('font-size', '9px')
        .attr('fill', '#52525b')
        .attr('text-anchor', 'middle')
        .attr('dy', -8)
        .style('pointer-events', 'none')
        .style('user-select', 'none');

    // Tooltip
    const tooltip = document.getElementById('graph-tooltip');
    node.on('mouseover', (event, d) => {
        if (!tooltip) return;
        tooltip.classList.remove('hidden');
        tooltip.innerHTML = `
          <div class="font-semibold mb-0.5">${d.name}</div>
          <div class="text-zinc-400 text-[10px]">${d.category}</div>
          <div class="mt-1 text-[10px]">Retenção: <span class="font-bold">${d.mastery}%</span></div>
        `;
        tooltip.style.left = (event.offsetX + 12) + 'px';
        tooltip.style.top = (event.offsetY - 10) + 'px';
    }).on('mousemove', (event) => {
        if (!tooltip) return;
        tooltip.style.left = (event.offsetX + 12) + 'px';
        tooltip.style.top = (event.offsetY - 10) + 'px';
    }).on('mouseout', () => {
        tooltip?.classList.add('hidden');
    }).on('click', (event, d) => {
        // Navegar para o conceito clicado
        store.setState({ currentPage: 'concepts', selectedConceptId: d.id });
    });

    // Tick
    simulation.on('tick', () => {
        link
            .attr('x1', d => d.source.x).attr('y1', d => d.source.y)
            .attr('x2', d => d.target.x).attr('y2', d => d.target.y);
        node.attr('cx', d => d.x).attr('cy', d => d.y);
        label.attr('x', d => d.x).attr('y', d => d.y);
    });

    function dragstarted(event, d) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x; d.fy = d.y;
    }
    function dragged(event, d) { d.fx = event.x; d.fy = event.y; }
    function dragended(event, d) {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null; d.fy = null;
    }

    // Legenda
    const legendData = [
        { color: '#10b981', label: 'Dominado (≥85%)' },
        { color: '#f59e0b', label: 'Em progresso (≥50%)' },
        { color: '#ef4444', label: 'Fraco (<50%)' },
        { color: '#94a3b8', label: 'Não estudado' },
    ];
    const legend = svg.append('g').attr('transform', 'translate(16, 16)');
    legendData.forEach((item, i) => {
        const row = legend.append('g').attr('transform', `translate(0, ${i * 18})`);
        row.append('circle').attr('r', 5).attr('fill', item.color).attr('cy', 0);
        row.append('text').text(item.label)
            .attr('x', 12).attr('dy', '0.35em')
            .attr('font-size', '10px').attr('fill', '#71717a');
    });

    // Linha separadora na legenda para tipo de aresta
    const edgeLegend = svg.append('g').attr('transform', `translate(16, ${16 + legendData.length * 18 + 8})`);
    [
        { color: '#6366f1', label: 'Pré-requisito', opacity: 0.6 },
        { color: '#e2e8f0', label: 'Relacionado', opacity: 1 },
    ].forEach((item, i) => {
        const row = edgeLegend.append('g').attr('transform', `translate(0, ${i * 16})`);
        row.append('line').attr('x1', 0).attr('x2', 18).attr('y1', 0).attr('y2', 0)
            .attr('stroke', item.color).attr('stroke-width', 1.5).attr('stroke-opacity', item.opacity);
        row.append('text').text(item.label)
            .attr('x', 24).attr('dy', '0.35em')
            .attr('font-size', '10px').attr('fill', '#71717a');
    });
}

// ─── Busca em cascata ─────────────────────────────────────────────────────────

function showCascadeResults(term, graphNodes, graphEdges, state) {
    const results = document.getElementById('graph-cascade-results');
    if (!results) return;

    const lower = term.toLowerCase();
    // Nós que batem na busca
    const matching = graphNodes.filter(n =>
        n.name.toLowerCase().includes(lower) ||
        n.category.toLowerCase().includes(lower) ||
        n.macroCategory.toLowerCase().includes(lower)
    );

    if (matching.length === 0) {
        results.innerHTML = `<p class="text-sm text-zinc-400 text-center py-8">Nenhum conceito encontrado para "${term}"</p>`;
        return;
    }

    results.innerHTML = matching.slice(0, 20).map(node => {
        const connected = getConnectedNodes(node.id, graphNodes, graphEdges);
        const masteryColor = node.mastery >= 85 ? 'text-emerald-600' : node.mastery >= 50 ? 'text-amber-600' : 'text-red-500';

        return `
          <div class="bg-white border border-zinc-200 rounded-xl overflow-hidden">
            <button data-cascade-node="${node.id}"
              class="w-full flex items-start gap-3 px-5 py-4 text-left hover:bg-zinc-50 transition-colors">
              <div class="flex-1 min-w-0">
                <div class="text-[10px] text-zinc-400 font-medium uppercase tracking-wider mb-0.5">
                  ${node.macroCategory} / ${node.category}
                </div>
                <h3 class="text-sm font-semibold text-zinc-900">${node.name}</h3>
              </div>
              <div class="flex items-center gap-2 shrink-0 mt-1">
                <span class="text-xs font-bold ${masteryColor}">${node.mastery}%</span>
                <i data-lucide="chevron-down" class="w-4 h-4 text-zinc-400 cascade-chevron transition-transform"></i>
              </div>
            </button>

            <div class="cascade-connections hidden px-5 pb-4 border-t border-zinc-100">
              ${connected.prerequisites.length > 0 ? `
                <div class="mt-3">
                  <p class="text-[10px] font-semibold text-indigo-500 uppercase tracking-wider mb-2">
                    <i data-lucide="arrow-up" class="w-3 h-3 inline-block"></i> Pré-requisitos
                  </p>
                  <div class="flex flex-wrap gap-2">
                    ${connected.prerequisites.map(n => renderNodePill(n)).join('')}
                  </div>
                </div>
              ` : ''}
              ${connected.dependents.length > 0 ? `
                <div class="mt-3">
                  <p class="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider mb-2">
                    <i data-lucide="arrow-down" class="w-3 h-3 inline-block"></i> Usados por
                  </p>
                  <div class="flex flex-wrap gap-2">
                    ${connected.dependents.map(n => renderNodePill(n)).join('')}
                  </div>
                </div>
              ` : ''}
              ${connected.related.length > 0 ? `
                <div class="mt-3">
                  <p class="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                    <i data-lucide="link" class="w-3 h-3 inline-block"></i> Relacionados
                  </p>
                  <div class="flex flex-wrap gap-2">
                    ${connected.related.map(n => renderNodePill(n)).join('')}
                  </div>
                </div>
              ` : ''}
              ${connected.prerequisites.length === 0 && connected.dependents.length === 0 && connected.related.length === 0
                ? `<p class="text-xs text-zinc-400 mt-3">Nenhuma conexão mapeada ainda.</p>`
                : ''}
            </div>
          </div>
        `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();

    // Listeners: expandir card + navegação por pills
    results.querySelectorAll('[data-cascade-node]').forEach(btn => {
        btn.addEventListener('click', () => {
            const panel = btn.nextElementSibling;
            const chevron = btn.querySelector('.cascade-chevron');
            const isOpen = !panel?.classList.contains('hidden');
            panel?.classList.toggle('hidden', isOpen);
            chevron?.classList.toggle('rotate-180', !isOpen);
        });
    });

    results.querySelectorAll('[data-nav-concept]').forEach(pill => {
        pill.addEventListener('click', (e) => {
            e.stopPropagation();
            const conceptId = pill.getAttribute('data-nav-concept');
            store.setState({ currentPage: 'concepts', selectedConceptId: conceptId });
        });
    });
}

function renderNodePill(node) {
    const masteryBg = node.mastery >= 85
        ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
        : node.mastery >= 50
            ? 'bg-amber-50 border-amber-200 text-amber-700'
            : 'bg-red-50 border-red-200 text-red-700';

    return `
      <button data-nav-concept="${node.id}"
        class="flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-medium transition-all hover:shadow-sm ${masteryBg}">
        ${node.name}
        <span class="text-[9px] opacity-70">${node.mastery}%</span>
      </button>
    `;
}

function getConnectedNodes(nodeId, graphNodes, graphEdges) {
    const nodeMap = Object.fromEntries(graphNodes.map(n => [n.id, n]));

    const prerequisites = graphEdges
        .filter(e => e.target === nodeId && e.type === 'prerequisite')
        .map(e => nodeMap[typeof e.source === 'object' ? e.source.id : e.source])
        .filter(Boolean);

    const dependents = graphEdges
        .filter(e => e.source === nodeId && e.type === 'prerequisite')
        .map(e => nodeMap[typeof e.target === 'object' ? e.target.id : e.target])
        .filter(Boolean);

    const related = graphEdges
        .filter(e => e.type === 'related' && (e.source === nodeId || e.target === nodeId))
        .map(e => {
            const otherId = e.source === nodeId ? e.target : e.source;
            return nodeMap[typeof otherId === 'object' ? otherId.id : otherId];
        })
        .filter(Boolean);

    return { prerequisites, dependents, related };
}

function clearCascadeResults() {
    const results = document.getElementById('graph-cascade-results');
    if (results) results.innerHTML = '';
}

// ─── Alternância de modo de visualização ─────────────────────────────────────

function setViewMode(mode) {
    const visual = document.getElementById('graph-visual');
    const cascade = document.getElementById('graph-cascade');
    const btnVisual = document.getElementById('graph-view-visual');
    const btnCascade = document.getElementById('graph-view-cascade');

    if (mode === 'visual') {
        visual?.classList.remove('hidden');
        cascade?.classList.add('hidden');
        btnVisual?.classList.replace('bg-white', 'bg-zinc-900');
        btnVisual?.classList.replace('text-zinc-600', 'text-white');
        btnVisual?.classList.remove('border', 'border-zinc-200', 'hover:bg-zinc-50');
        btnCascade?.classList.replace('bg-zinc-900', 'bg-white');
        btnCascade?.classList.replace('text-white', 'text-zinc-600');
        btnCascade?.classList.add('border', 'border-zinc-200', 'hover:bg-zinc-50');
    } else {
        visual?.classList.add('hidden');
        cascade?.classList.remove('hidden');
        btnCascade?.classList.replace('bg-white', 'bg-zinc-900');
        btnCascade?.classList.replace('text-zinc-600', 'text-white');
        btnCascade?.classList.remove('border', 'border-zinc-200', 'hover:bg-zinc-50');
        btnVisual?.classList.replace('bg-zinc-900', 'bg-white');
        btnVisual?.classList.replace('text-white', 'text-zinc-600');
        btnVisual?.classList.add('border', 'border-zinc-200', 'hover:bg-zinc-50');
    }
}
```

- [ ] **Step 2: Verificar sintaxe**

O arquivo é grande — verificar ausência de erros no console ao importar.

- [ ] **Step 3: Commit**

```bash
git add js/graph.js
git commit -m "feat: add graph.js with D3 force graph + cascade search"
```

---

### Task 3.3: Adicionar rota `/graph` e item na sidebar

**Files:**
- Modify: `js/app.js`
- Modify: `js/sidebar.js`

- [x] **Step 1: Adicionar import e case no `app.js`**

```js
import { renderGraph } from './graph.js';
```

No switch:

```js
case 'graph':
    if (currentViewType !== 'graph') {
        renderGraph(viewContainer);
    }
    break;
```

- [x] **Step 2: Adicionar item na sidebar**

Em `js/sidebar.js`, na constante `navItems`:

```js
{ id: 'graph', label: 'Grafo', icon: 'network' },
```

Adicionar após o item `notes`.

- [ ] **Step 3: Verificar**

Abrir o app → clicar em "Grafo" → deve renderizar o grafo D3. Verificar que os nós aparecem coloridos por mastery. Testar arrastar nós. Testar busca — digitar "tendência" → ver cards expansíveis com conexões.

- [ ] **Step 4: Testar navegação**

Clicar num nó do grafo → deve navegar para o conceito. Clicar numa pill na cascata → idem.

- [ ] **Step 5: Commit**

```bash
git add js/app.js js/sidebar.js
git commit -m "feat: add /graph route and sidebar navigation item"
```

---

### Task 3.4: Passar `graphNodes` e `graphEdges` pelo store (otimização)

Para não recalcular o grafo toda vez que a view é acessada, cachear os dados derivados no store.

**Files:**
- Modify: `js/state.js`
- Modify: `js/graph.js`
- Modify: `js/engine.js`

- [x] **Step 1: Verificar o estado inicial em `state.js`**

Abrir `js/state.js` e confirmar que existe um campo para o grafo, ou adicionar:

```js
// Dentro do initialState:
graphNodes: [],
graphEdges: [],
```

- [x] **Step 2: Popular no engine após carregar conceitos**

Em `js/engine.js`, após o carregamento dos conceitos (onde o store é atualizado com `concepts`), adicionar a derivação do grafo. Encontrar o ponto onde `store.setState({ concepts: ... })` é chamado e adicionar logo após:

```js
// Derivar dados do grafo (pré-requisitos + subcategoria)
import { buildGraphDataFromConcepts } from './graph.js';
// ...
const { graphNodes, graphEdges } = buildGraphDataFromConcepts(mergedConcepts);
store.setState({ concepts: mergedConcepts, graphNodes, graphEdges });
```

- [x] **Step 3: Exportar a função `buildGraphDataFromConcepts` de `graph.js`**

No `graph.js`, renomear `buildGraphData` para `buildGraphDataFromConcepts` e exportar:

```js
export function buildGraphDataFromConcepts(concepts) { ... }
```

E dentro de `renderGraph`, usar:

```js
const { graphNodes, graphEdges } = buildGraphDataFromConcepts(state.concepts || []);
```

- [ ] **Step 4: Verificar**

Abrir o Grafo → confirmar funcionamento. Navegar para outro conceito e voltar ao Grafo → verificar que re-renderiza corretamente.

- [ ] **Step 5: Commit**

```bash
git add js/state.js js/graph.js js/engine.js
git commit -m "refactor: cache graph nodes/edges in store for performance"
```

---

## Checklist Final de Verificação

- [x] Campo `aula_curso` existe no Supabase + `dataService.js` o carrega
- [x] `course-mapping.json` criado e válido
- [x] `runCourseMapper()` executado e conceitos atualizados no banco
- [x] Badge módulo/aula aparece no concept-detail com link de navegação
- [ ] Rota `/notes` funciona: criar nota, renomear, sub-notas, editor, auto-save
- [ ] Modo foco funciona em notas e em concept-detail
- [ ] Paste de Markdown funciona no editor de notas (`.md` colado renderiza corretamente)
- [ ] Rota `/graph` funciona: nós coloridos, drag, zoom, tooltip
- [ ] Busca em cascata mostra conexões (pré-requisitos, dependentes, relacionados)
- [ ] Clicar num nó do grafo navega para o conceito correto
- [x] Sidebar tem: Notas + Grafo nos itens de nav

---

*Plano gerado em 2026-03-13. Stack: Vanilla JS + Supabase + Tiptap + D3.js v7 + Tailwind CDN.*
