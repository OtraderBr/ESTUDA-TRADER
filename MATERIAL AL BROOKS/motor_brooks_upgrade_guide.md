# Motor Brooks — Guia Completo de Atualização do Sistema

> **Contexto:** O CSV foi de 504 → 633 conceitos (+25,7%) com 5 campos novos e 4 seções completamente inéditas. Este guia cobre tudo que precisa mudar no sistema para aproveitar ao máximo esses dados.

---

## 1. O QUE MUDOU NOS DADOS

### 1.1 Campos novos (obrigatório atualizar o schema)

| Campo Novo | Tipo | O que habilita |
|---|---|---|
| `MacroCategoria` | TEXT | Navegação de alto nível (10 macro-áreas) |
| `Modulo_Curso` | TEXT | Filtrar por módulo 01-07 até 47-50 |
| `Regras_Operacionais` | TEXT | Exibir entrada/stop/alvo diretamente no card |
| `Probabilidade` | TEXT | Badge visual de probabilidade por conceito |
| `Mercado_Aplicavel` | TEXT | Filtro Universal/Forex/Emini |

### 1.2 Seções completamente novas

- **Decisão e Operação** (73 conceitos) — tipos de ordem, stops, checklist pré-trade
- **Operando por Contexto** (43 conceitos) — regras específicas por modo de mercado
- **Operando por Tempo** (42 conceitos) — abertura/meio-dia/final, multi-TF
- **Gestão de Perdas** (12 conceitos) — mentalidade e erros evitáveis

### 1.3 Distribuição final por MacroCategoria

```
Contexto              → 144 conceitos
Padrões               → 118 conceitos
Habilidades Práticas  →  83 conceitos
Fundamentos           →  77 conceitos
Decisão e Operação    →  73 conceitos
Operando por Contexto →  43 conceitos
Operando por Tempo    →  42 conceitos
Psicologia            →  20 conceitos
Desenvolvimento       →  21 conceitos
Gestão de Perdas      →  12 conceitos
```

---

## 2. ATUALIZAÇÃO DO SCHEMA SUPABASE

### 2.1 Migration SQL — execute no Supabase SQL Editor

```sql
-- Adicionar colunas novas na tabela existente
ALTER TABLE conceitos
  ADD COLUMN IF NOT EXISTS macro_categoria TEXT,
  ADD COLUMN IF NOT EXISTS modulo_curso TEXT,
  ADD COLUMN IF NOT EXISTS regras_operacionais TEXT,
  ADD COLUMN IF NOT EXISTS probabilidade TEXT,
  ADD COLUMN IF NOT EXISTS mercado_aplicavel TEXT DEFAULT 'Universal';

-- Índices para performance nos novos filtros
CREATE INDEX IF NOT EXISTS idx_macro_categoria ON conceitos(macro_categoria);
CREATE INDEX IF NOT EXISTS idx_modulo_curso ON conceitos(modulo_curso);
CREATE INDEX IF NOT EXISTS idx_mercado ON conceitos(mercado_aplicavel);

-- View útil para o dashboard de progresso por MacroCategoria
CREATE OR REPLACE VIEW progresso_por_macro AS
SELECT 
  macro_categoria,
  COUNT(*) AS total,
  COUNT(CASE WHEN conhecimento_atual >= 7 THEN 1 END) AS dominados,
  COUNT(CASE WHEN conhecimento_atual > 0 AND conhecimento_atual < 7 THEN 1 END) AS em_progresso,
  COUNT(CASE WHEN conhecimento_atual = 0 THEN 1 END) AS nao_iniciados,
  ROUND(AVG(conhecimento_atual), 1) AS media_conhecimento
FROM conceitos
GROUP BY macro_categoria
ORDER BY media_conhecimento DESC;

-- View para conceitos com regras operacionais (Árvore de Escolha)
CREATE OR REPLACE VIEW conceitos_operacionais AS
SELECT conceito, macro_categoria, categoria, regras_operacionais, probabilidade, mercado_aplicavel
FROM conceitos
WHERE regras_operacionais IS NOT NULL AND regras_operacionais != ''
ORDER BY macro_categoria, categoria;
```

### 2.2 Import do novo CSV

```javascript
// Script de importação com upsert (preserva progresso existente)
const { data, error } = await supabase
  .from('conceitos')
  .upsert(novosConceitos, { 
    onConflict: 'conceito',  // chave única = nome do conceito
    ignoreDuplicates: false   // atualiza campos novos mas preserva conhecimento_atual
  });
```

**IMPORTANTE:** O upsert deve ser configurado para:
- Atualizar: `macro_categoria`, `modulo_curso`, `regras_operacionais`, `probabilidade`, `mercado_aplicavel`, `categoria`, `subcategoria`, `prerequisito`, `notas`
- PRESERVAR: `conhecimento_atual`, `data_estudo`, `tempo_investido_hrs` (progresso do usuário)

---

## 3. FEATURES NOVAS HABILITADAS PELOS DADOS

### 3.1 🎯 MODO ÁRVORE DE ESCOLHA (feature mais importante)
**O que é:** Os 51 conceitos com `regras_operacionais` preenchidos são a Árvore de Escolha em formato de cards. Quando o aluno estuda "H1 em Canal Estreito Alta", ele vê diretamente: entrada | stop | alvo.

**Como implementar:**
```javascript
// Card expandido quando há regras operacionais
{conceito.regras_operacionais && (
  <div className="regras-box">
    <h4>📋 Regras Operacionais</h4>
    <p>{conceito.regras_operacionais}</p>
    {conceito.probabilidade && (
      <span className="badge-prob">{conceito.probabilidade}</span>
    )}
  </div>
)}
```

### 3.2 📊 DASHBOARD POR MACROCATEGORIA
**O que é:** A tela principal mostra 10 barras de progresso — uma por MacroCategoria — em vez de uma lista plana de categorias. Hierarquia: MacroCategoria → Categoria → Subcategoria.

**Exemplo de componente:**
```javascript
const macroCategorias = [
  { nome: "Fundamentos", icone: "🏗️", cor: "#4A90D9" },
  { nome: "Psicologia", icone: "🧠", cor: "#9B59B6" },
  { nome: "Contexto", icone: "🗺️", cor: "#27AE60" },
  { nome: "Padrões", icone: "📐", cor: "#E67E22" },
  { nome: "Decisão e Operação", icone: "⚡", cor: "#E74C3C" },
  { nome: "Operando por Contexto", icone: "🎯", cor: "#1ABC9C" },
  { nome: "Operando por Tempo", icone: "⏰", cor: "#F39C12" },
  { nome: "Habilidades Práticas", icone: "🔧", cor: "#2ECC71" },
  { nome: "Gestão de Perdas", icone: "🛡️", cor: "#E91E63" },
  { nome: "Desenvolvimento", icone: "📈", cor: "#3498DB" },
];
```

### 3.3 🔗 TRILHA DE PREREQUISITOS VISUAL
**O que é:** Com o campo `Prerequisito` mapeado, o sistema pode mostrar o caminho de aprendizado antes de estudar um conceito. "Para estudar MTR, você precisa dominar: LH, HL, Linha de Tendência, Duplos."

**Como implementar:**
```javascript
// Buscar prerequisitos encadeados
async function getPathToConceito(conceito) {
  const path = [];
  let current = conceito;
  while (current.prerequisito !== 'Nenhum') {
    const prereq = await supabase
      .from('conceitos')
      .select('*')
      .eq('conceito', current.prerequisito)
      .single();
    path.unshift(prereq.data);
    current = prereq.data;
  }
  return path;
}
```

### 3.4 📅 FILTRO POR MÓDULO DO CURSO
**O que é:** Você está no Módulo 30-36? Filtre e veja exatamente os 73 conceitos de "Decisão e Operação" que correspondem àquele módulo.

```javascript
// Filtro de módulo na UI
const modulos = [
  { range: "01-07", nome: "Fundamentos" },
  { range: "08-11", nome: "Análise de Gráficos" },
  { range: "12-18", nome: "Ciclo de Mercado" },
  { range: "19-29", nome: "Padrões e Setups" },
  { range: "30-36", nome: "Decisão e Operação" },
  { range: "37-42", nome: "Operando por Contexto" },
  { range: "43-46", nome: "Operando por Tempo" },
  { range: "47-50", nome: "Gestão de Perdas" },
];
```

### 3.5 🌍 FILTRO DE MERCADO
**O que é:** Está operando Forex? Filtre e veja apenas os conceitos aplicáveis ao Forex (incluindo os específicos de pip, sessões, armadilha 11 pips, etc.).

### 3.6 🎲 MODO QUIZ COM PROBABILIDADES
**O que é:** Para conceitos com `probabilidade` preenchida, o quiz pode perguntar: "Qual a probabilidade de um Breakout Forte continuar?" com múltipla escolha. Isso força memorização dos números que Al Brooks usa.

```javascript
// Geração automática de perguntas de probabilidade
const perguntasProb = conceitos
  .filter(c => c.probabilidade)
  .map(c => ({
    pergunta: `Qual a probabilidade de "${c.conceito}"?`,
    resposta: c.probabilidade,
    contexto: c.regras_operacionais,
    distractors: ["40-50%", "60-70%", "80%", "20%"].filter(d => d !== c.probabilidade)
  }));
```

---

## 4. MELHORIAS DE UI/UX NO STUDY TRACKER

### 4.1 Card de Conceito (redesenho)
O card atual mostra: conceito + nota atual + objetivo

O card novo deve mostrar:
```
┌─────────────────────────────────────────────┐
│ 🎯 H1 em Canal Estreito Alta     [70-80%] ➤ │
│ Operando por Contexto › Setup              │
│ Módulo 37-42 | Mercado: Universal          │
│                                             │
│ Prerequisito: Canal Estreito Alta ✓        │
│                                             │
│ ▼ Regras Operacionais (clique para ver)    │
│   Entrada: stop 1 tick acima máxima sinal  │
│   Stop: abaixo mínima barra sinal          │
│   Alvo: MM ou próximo S/R                  │
│                                             │
│ Conhecimento: ████████░░  8/10             │
└─────────────────────────────────────────────┘
```

### 4.2 Tela Principal (dashboard)
Em vez de uma lista: **10 blocos de MacroCategoria** com:
- Ícone + nome
- Barra de progresso (% dominado)
- Contagem: X/633 conceitos
- Clique → expande listagem daquela macro

### 4.3 Tela de Estudo (modo foco)
Modo "sessão de estudo" por módulo do curso:
- Selecione o módulo que está assistindo
- O sistema mostra apenas os conceitos daquele módulo
- Ao marcar como estudado → avança para o próximo
- Exibe regras operacionais como "ficha de referência rápida"

### 4.4 Modo "Árvore de Decisão" (feature premium)
Uma tela separada que navega a Árvore de Escolha interativamente:
- "Em que modo está o mercado?" → Breakout / Canal / TR / Reversão
- Cada resposta filtra os conceitos relevantes
- Exibe as regras operacionais do contexto
- Permite marcar como "praticado hoje"

---

## 5. NOVOS MODOS DE ESTUDO HABILITADOS

### 5.1 Estudo por Módulo do Curso (novo)
**Como funciona:** Você assiste Módulo 30-36. Antes de assistir, você pré-visualiza os 73 conceitos. Durante a aula, marca "ouvi falar" (nota 3-4). Após assistir, revisa os conceitos e marca "entendo" (nota 7-8). Após praticar, marca "domino" (nota 9-10).

**Por que é melhor:** Você não estuda no vácuo. Cada conceito está ancorado à sua posição no curso.

### 5.2 Estudo Orientado por Contexto (novo)
**Como funciona:** Hoje você vai estudar "Canal Estreito". O sistema filtra automaticamente todos os conceitos de MacroCategoria "Operando por Contexto" + Categoria "Canal Estreito" e cria uma sessão temática.

**Sequência sugerida:**
1. Identificação (Fundamentos)
2. Definição (Contexto)
3. Setup/Regras (Decisão e Operação)
4. Habilidade prática (Habilidades Práticas)

### 5.3 Revisão de Regras Operacionais (novo)
**Como funciona:** Modo flashcard apenas com os 51 conceitos que têm `regras_operacionais`. O sistema mostra o nome do conceito, você tenta lembrar as regras, depois clica para revelar. Perfeito para memorizar entrada/stop/alvo.

### 5.4 Estudo Guiado por Prerequisitos (novo)
**Como funciona:** Você quer aprender "MTR em Topos". O sistema mapeia toda a cadeia de prerequisitos e mostra: "Você tem X conceitos prévios com nota < 7. Domine-os primeiro."

---

## 6. CHECKLIST DE IMPLEMENTAÇÃO (PRIORIDADE)

### 🔴 CRÍTICO (faça primeiro)

- [ ] Rodar migration SQL no Supabase (adicionar 5 colunas novas)
- [ ] Fazer import do `motor_brooks_consolidado.csv` com upsert
- [ ] Validar que progresso existente foi preservado (conhecimento_atual)
- [ ] Atualizar a query principal do app para incluir novos campos

### 🟡 IMPORTANTE (fase 2)

- [ ] Adicionar filtro por `MacroCategoria` na tela principal
- [ ] Adicionar filtro por `Modulo_Curso` 
- [ ] Adicionar filtro por `Mercado_Aplicavel`
- [ ] Redesenhar card para mostrar `regras_operacionais` expansível
- [ ] Adicionar badge visual para `probabilidade`
- [ ] Criar dashboard de progresso por MacroCategoria (10 barras)

### 🟢 MELHORIA (fase 3)

- [ ] Modo sessão por módulo do curso
- [ ] Flashcard de regras operacionais (51 conceitos)
- [ ] Mapa visual de prerequisitos
- [ ] Quiz de probabilidades
- [ ] Modo "Árvore de Decisão" interativa

---

## 7. SUGESTÕES DE FEATURES AVANÇADAS (futuro)

### 7.1 PTS Integration (Progressive Trader System)
O sistema atual é um tracker. O próximo nível é um **tutor ativo**:
- Comando `/avaliar` → o sistema pergunta sobre um conceito aleatório da sua zona de conforto (nota 5-7)
- Comando `/treinar setup` → gera um cenário hipotético e você responde qual seria a ação
- Comando `/revisar hoje` → mostra todos os conceitos estudados recentemente que precisam de revisão espaçada

### 7.2 Spaced Repetition Engine
Com `data_estudo` e `conhecimento_atual`, é possível calcular a data ideal de revisão:
```
Nota 1-3: revisar em 1 dia
Nota 4-6: revisar em 3 dias  
Nota 7-8: revisar em 7 dias
Nota 9-10: revisar em 21 dias
```

### 7.3 Mapa de Calor de Competências
Uma visualização tipo GitHub contributions onde cada quadrado é um conceito e a intensidade da cor é o nível de domínio. Você vê de relance onde estão os "buracos" no conhecimento.

### 7.4 Rastreamento de Sessão de Estudo
Ao iniciar uma sessão, o sistema:
- Registra hora de início
- Conta quantos conceitos foram revisados
- Calcula tempo médio por conceito
- Gera relatório da sessão ao finalizar

---

## 8. ESTRUTURA DE ARQUIVOS RECOMENDADA PARA O APP

```
motor-brooks/
├── data/
│   └── motor_brooks_consolidado.csv     ← arquivo mestre
├── src/
│   ├── components/
│   │   ├── ConceptCard.js               ← card redesenhado
│   │   ├── MacroCategoryBlock.js        ← bloco de progresso
│   │   ├── FilterBar.js                 ← filtros novos
│   │   ├── OperationalRules.js          ← exibe regras/stop/alvo
│   │   └── ProbabilityBadge.js         ← badge de probabilidade
│   ├── views/
│   │   ├── Dashboard.js                 ← visão macro
│   │   ├── StudySession.js              ← modo foco por módulo
│   │   ├── Flashcards.js                ← revisão de regras
│   │   └── PrerequisiteMap.js           ← mapa de dependências
│   └── services/
│       ├── supabase.js                  ← queries atualizadas
│       └── importCSV.js                 ← script de import/upsert
└── scripts/
    └── migrate.sql                      ← migration do schema
```

---

## 9. RESUMO EXECUTIVO

O novo CSV não é apenas "mais dados" — ele é uma mudança qualitativa no tipo de sistema que você pode construir:

| Antes | Depois |
|-------|--------|
| Lista plana de 504 conceitos | 10 macro-áreas hierárquicas com 633 conceitos |
| Filtro por categoria | Filtro por módulo do curso + mercado + macro |
| Conceito = nome + nota | Conceito = nome + nota + entrada + stop + alvo + probabilidade |
| Estudar = marcar nota | Estudar = sessão por módulo → flashcard → quiz de probabilidade |
| Tracker passivo | Sistema ativo com regras operacionais embutidas |

O sistema tem potencial de ser seu **segundo cérebro de Price Action** — não apenas onde você guarda o que aprendeu, mas onde você pratica, revisa e é testado.
