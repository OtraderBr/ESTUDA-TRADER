// js/analise.js
// Lab de Análise — Registro estruturado de evoluções e operações
// Persistência: localStorage key 'motor_analise_v1'
// Tema: Evoluções = indigo · Operações = violet

/* ═══════════════════════════════════════════════════════════════════
   PERSISTÊNCIA
   ═══════════════════════════════════════════════════════════════════ */

function db() {
    try { return JSON.parse(localStorage.getItem('motor_analise_v1') || '[]'); }
    catch { return []; }
}
function dbSave(records) {
    localStorage.setItem('motor_analise_v1', JSON.stringify(records));
}
function dbAdd(record) {
    const records = db();
    records.unshift(record);
    dbSave(records);
    return record;
}
function dbDelete(id) {
    dbSave(db().filter(r => r.id !== id));
}

/* ═══════════════════════════════════════════════════════════════════
   STEP CONFIG — EVOLUÇÕES
   ═══════════════════════════════════════════════════════════════════ */

const EVOLUCAO_STEPS = [
    {
        id: 'foco',
        label: 'Foco do Estudo',
        icon: 'target',
        type: 'chips_free',
        required: true,
        options: ['H1','H2','H3','L1','L2','L3','MTR','Canal Estreito','Canal Amplo','TR','TTR','Breakout','BO Fraco','Cunha','Duplo Topo','Duplo Fundo','OHO','Clímax','Bandeira Final','Micro Canal'],
        placeholder: 'Outro padrão...',
        hint: 'Qual padrão, setup ou conceito está analisando?'
    },
    {
        id: 'timeframe',
        label: 'Timeframe Analisado',
        icon: 'clock',
        type: 'chips',
        required: true,
        options: ['Mensal','Semanal','Diário','4h','1h','15min','5min','1min'],
        hint: 'Em qual gráfico está observando a evolução?'
    },
    {
        id: 'htf',
        label: 'Contexto HTF (Always In)',
        icon: 'layers',
        type: 'themed_chips',
        required: true,
        options: [
            { label: 'Alta (AIL)', theme: 'emerald' },
            { label: 'Baixa (AIS)', theme: 'red' },
            { label: 'TR', theme: 'amber' }
        ],
        hint: 'Qual a direção dominante no timeframe superior?'
    },
    {
        id: 'ctf',
        label: 'Fase do Mercado (CTF)',
        icon: 'activity',
        type: 'chips',
        required: true,
        options: ['Breakout','Canal Estreito Alta','Canal Estreito Baixa','Canal Amplo','TR','MTR em Formação','Correção','Micro Canal','Spike'],
        hint: 'Em qual fase o mercado se encontra agora?'
    },
    {
        id: 'qualidade',
        label: 'Qualidade do Setup',
        icon: 'bar-chart-2',
        type: 'grade_chips',
        required: true,
        options: [
            { label: 'A', desc: 'Excelente', theme: 'emerald' },
            { label: 'B', desc: 'Boa', theme: 'blue' },
            { label: 'C', desc: 'Média', theme: 'amber' },
            { label: 'D', desc: 'Fraca', theme: 'red' }
        ],
        hint: 'Como avalia a clareza e qualidade deste setup?'
    },
    {
        id: 'barra',
        label: 'Barra de Sinal',
        icon: 'signal',
        type: 'chips',
        required: false,
        options: ['Forte','Média','Fraca','Doji','Outside Bar','Inside Bar','ii','ioi','Sem sinal'],
        hint: 'Qual foi a qualidade da barra de sinal? (opcional)'
    },
    {
        id: 'evolucao',
        label: 'Como o Setup Evoluiu',
        icon: 'git-branch',
        type: 'outcome_chips',
        required: true,
        options: [
            { label: 'Funcionou', theme: 'emerald' },
            { label: 'Hesitação', theme: 'amber' },
            { label: 'Em Desenvolvimento', theme: 'blue' },
            { label: 'Falhou — Premissa', theme: 'red' },
            { label: 'Falhou — Execução', theme: 'orange' },
            { label: 'Stop 1ª Tentativa', theme: 'red' },
            { label: 'Virou TR', theme: 'zinc' },
            { label: 'Clímax', theme: 'purple' }
        ],
        hint: 'Qual foi o desfecho desta evolução?'
    },
    {
        id: 'nota',
        label: 'Observação / Lição',
        icon: 'message-circle',
        type: 'textarea',
        required: false,
        placeholder: 'O que observou? Qual a lição principal? O que confirmou ou refutou sua hipótese?',
        hint: 'Registro livre de aprendizado (opcional)'
    }
];

/* ═══════════════════════════════════════════════════════════════════
   STEP CONFIG — OPERAÇÕES
   ═══════════════════════════════════════════════════════════════════ */

const OPERACAO_STEPS = [
    {
        id: 'tipo',
        label: 'Tipo de Operação',
        icon: 'zap',
        type: 'chips',
        required: true,
        options: ['Swing','Scalp'],
        hint: 'Qual o horizonte desta operação?'
    },
    {
        id: 'htf',
        label: 'Contexto HTF (Always In)',
        icon: 'layers',
        type: 'themed_chips',
        required: true,
        options: [
            { label: 'Alta', theme: 'emerald' },
            { label: 'Baixa', theme: 'red' },
            { label: 'TR', theme: 'amber' }
        ],
        hint: 'Qual a direção dominante no timeframe superior?'
    },
    {
        id: 'ctf',
        label: 'Fase do Mercado (CTF)',
        icon: 'activity',
        type: 'chips',
        required: true,
        options: ['Breakout','Canal Estreito','Canal Amplo','TR','MTR','Micro Canal','Correção','Spike'],
        hint: 'Em qual fase o mercado estava no momento da entrada?'
    },
    {
        id: 'setup',
        label: 'Setup de Entrada',
        icon: 'crosshair',
        type: 'chips',
        required: true,
        options: ['H1','H2','H3','L1','L2','L3','DT','DF','MTR','Fade BO','Cunha','Micro Canal','Segunda Entrada','Outro'],
        hint: 'Qual padrão originou a entrada?'
    },
    {
        id: 'direcao',
        label: 'Direção',
        icon: 'arrow-up-down',
        type: 'direction_chips',
        required: true,
        options: [
            { label: 'Compra', sublabel: 'Long', theme: 'emerald' },
            { label: 'Venda', sublabel: 'Short', theme: 'red' }
        ],
        hint: 'Compra ou venda?'
    },
    {
        id: 'racional',
        label: 'Racional de Entrada',
        icon: 'brain',
        type: 'textarea',
        required: false,
        placeholder: 'Por que entrou? O que o mercado mostrou para justificar esta operação? Qual a premissa?',
        hint: 'Raciocínio por trás da entrada (opcional)'
    },
    {
        id: 'gestao',
        label: 'Gestão / Forma de Saída',
        icon: 'sliders-horizontal',
        type: 'chips',
        required: true,
        options: ['No alvo','Stop','Antecipado','Parcial + Segurou','Swing → Scalp','Trailing','Saída Manual'],
        hint: 'Como foi gerenciada e encerrada a operação?'
    },
    {
        id: 'resultado',
        label: 'Resultado',
        icon: 'flag',
        type: 'result_chips',
        required: true,
        options: [
            { label: 'WIN', theme: 'emerald' },
            { label: 'LOSS', theme: 'red' },
            { label: 'BE', sublabel: 'Breakeven', theme: 'amber' }
        ],
        hint: 'Qual foi o resultado financeiro da operação?'
    },
    {
        id: 'processo',
        label: 'Qualidade do Processo',
        icon: 'award',
        type: 'grade_chips',
        required: true,
        options: [
            { label: 'A', desc: 'Correto', theme: 'emerald' },
            { label: 'B', desc: 'Razoável', theme: 'amber' },
            { label: 'C', desc: 'Ruim', theme: 'red' }
        ],
        hint: 'Como foi o processo, independente do resultado?'
    },
    {
        id: 'nota',
        label: 'Reflexão Pós-Operação',
        icon: 'message-circle',
        type: 'textarea',
        required: false,
        placeholder: 'O que faria diferente? O que aprendeu? A premissa foi respeitada?',
        hint: 'Diário de reflexão (opcional)'
    }
];

/* ═══════════════════════════════════════════════════════════════════
   TEMA POR MODO
   ═══════════════════════════════════════════════════════════════════ */

const THEME = {
    evolucao: {
        accent: 'indigo',
        bg: 'bg-indigo-50',
        bgCard: 'bg-indigo-50/40',
        border: 'border-indigo-200',
        text: 'text-indigo-700',
        textMuted: 'text-indigo-500',
        badge: 'bg-indigo-100 text-indigo-700 border-indigo-200',
        btn: 'bg-indigo-600 hover:bg-indigo-700',
        btnOutline: 'border-indigo-200 text-indigo-600 hover:bg-indigo-50',
        tabActive: 'bg-indigo-600 text-white shadow-sm',
        dot: 'bg-indigo-500',
        progressBar: 'bg-indigo-500',
        icon: 'flask-conical',
        label: 'Evolução',
        labelPlural: 'Evoluções'
    },
    operacao: {
        accent: 'violet',
        bg: 'bg-violet-50',
        bgCard: 'bg-violet-50/40',
        border: 'border-violet-200',
        text: 'text-violet-700',
        textMuted: 'text-violet-500',
        badge: 'bg-violet-100 text-violet-700 border-violet-200',
        btn: 'bg-violet-600 hover:bg-violet-700',
        btnOutline: 'border-violet-200 text-violet-600 hover:bg-violet-50',
        tabActive: 'bg-violet-600 text-white shadow-sm',
        dot: 'bg-violet-500',
        progressBar: 'bg-violet-500',
        icon: 'trending-up',
        label: 'Operação',
        labelPlural: 'Operações'
    }
};

/* ═══════════════════════════════════════════════════════════════════
   ESTADO LOCAL
   ═══════════════════════════════════════════════════════════════════ */

let _mode = 'evolucao';
let _sel = {};
let _detail = null;
let _container = null;

/* ═══════════════════════════════════════════════════════════════════
   PONTO DE ENTRADA
   ═══════════════════════════════════════════════════════════════════ */

export function renderAnalise(container) {
    _container = container;
    _sel = {};
    _detail = null;
    repaint();
}

/* ═══════════════════════════════════════════════════════════════════
   REPAINT
   ═══════════════════════════════════════════════════════════════════ */

function repaint() {
    if (!_container) return;
    const records = db();
    _container.innerHTML = shell(records);
    if (window.lucide) window.lucide.createIcons();
    bindAll();
}

/* ═══════════════════════════════════════════════════════════════════
   SHELL
   ═══════════════════════════════════════════════════════════════════ */

function shell(records) {
    const mainContent = _detail ? detailView(_detail) : builderView();
    return `
<div class="flex h-full overflow-hidden" id="analise-root">

  <!-- ── Sidebar desktop ─────────────────────────────────────────── -->
  <aside class="hidden md:flex flex-col w-[17rem] shrink-0 border-r border-zinc-200 bg-white h-full overflow-hidden">
    ${sidebarInner(records)}
  </aside>

  <!-- ── Drawer mobile ───────────────────────────────────────────── -->
  <div id="analise-drawer" class="md:hidden fixed inset-0 z-30 hidden">
    <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" id="analise-drawer-overlay"></div>
    <aside class="absolute left-0 top-0 h-full w-[17rem] bg-white shadow-2xl flex flex-col overflow-hidden">
      ${sidebarInner(records)}
    </aside>
  </div>

  <!-- ── Main ────────────────────────────────────────────────────── -->
  <main class="flex-1 min-w-0 flex flex-col h-full overflow-hidden bg-zinc-50/50">
    <!-- Mobile top bar -->
    <div class="md:hidden flex items-center gap-3 px-4 py-3 border-b border-zinc-200 bg-white shrink-0">
      <button id="analise-sidebar-btn" class="p-2 rounded-lg hover:bg-zinc-100 text-zinc-500 transition-colors">
        <i data-lucide="panel-left" class="w-4 h-4"></i>
      </button>
      <div class="flex items-center gap-2">
        <i data-lucide="flask-conical" class="w-4 h-4 text-zinc-400"></i>
        <span class="text-sm font-semibold text-zinc-800">Lab de Análise</span>
      </div>
    </div>

    <!-- Scrollable content -->
    <div class="flex-1 overflow-y-auto">
      ${mainContent}
    </div>
  </main>

</div>`;
}

/* ═══════════════════════════════════════════════════════════════════
   SIDEBAR INNER
   ═══════════════════════════════════════════════════════════════════ */

function sidebarInner(records) {
    const t = THEME[_mode];
    const modeRecords = records.filter(r => r.mode === _mode);

    // ── Stats block
    let statsHTML = '';
    if (_mode === 'operacao') {
        const wins   = modeRecords.filter(r => r.resultado === 'WIN').length;
        const losses = modeRecords.filter(r => r.resultado === 'LOSS').length;
        const bes    = modeRecords.filter(r => r.resultado === 'BE').length;
        const total  = wins + losses + bes;
        const wr     = total > 0 ? Math.round((wins / total) * 100) : 0;
        statsHTML = `
        <div class="px-3 pb-3 space-y-2">
          <div class="grid grid-cols-3 gap-1.5">
            <div class="bg-emerald-50 border border-emerald-200 rounded-xl p-2 text-center">
              <div class="text-xl font-black text-emerald-600 leading-tight">${wins}</div>
              <div class="text-[9px] font-bold text-emerald-500 uppercase tracking-wider mt-0.5">Win</div>
            </div>
            <div class="bg-red-50 border border-red-200 rounded-xl p-2 text-center">
              <div class="text-xl font-black text-red-600 leading-tight">${losses}</div>
              <div class="text-[9px] font-bold text-red-500 uppercase tracking-wider mt-0.5">Loss</div>
            </div>
            <div class="bg-amber-50 border border-amber-200 rounded-xl p-2 text-center">
              <div class="text-xl font-black text-amber-600 leading-tight">${bes}</div>
              <div class="text-[9px] font-bold text-amber-500 uppercase tracking-wider mt-0.5">BE</div>
            </div>
          </div>
          ${total > 0 ? `
          <div class="bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 flex items-center justify-between">
            <span class="text-[10px] text-zinc-500 font-medium">${total} operações · WR</span>
            <span class="text-sm font-black ${wr >= 50 ? 'text-emerald-600' : 'text-red-600'}">${wr}%</span>
          </div>` : ''}
        </div>`;
    } else {
        const focoCounts = {};
        modeRecords.forEach(r => {
            if (r.foco) focoCounts[r.foco] = (focoCounts[r.foco] || 0) + 1;
        });
        const topFocos = Object.entries(focoCounts).sort((a,b) => b[1]-a[1]).slice(0, 3);
        if (topFocos.length > 0) {
            statsHTML = `
            <div class="px-3 pb-3 space-y-1.5">
              ${topFocos.map(([foco, count]) => `
              <div class="flex items-center gap-2 bg-indigo-50 border border-indigo-100 rounded-lg px-2.5 py-2">
                <span class="text-[10px] font-black text-indigo-700 bg-indigo-200 px-1.5 py-0.5 rounded shrink-0">${count}x</span>
                <span class="text-xs font-medium text-indigo-800 truncate">${foco}</span>
              </div>`).join('')}
            </div>`;
        }
    }

    return `
    <!-- Header -->
    <div class="shrink-0 px-4 pt-4 pb-3 border-b border-zinc-100">
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center gap-2">
          <i data-lucide="flask-conical" class="w-4 h-4 text-zinc-400"></i>
          <span class="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Lab de Análise</span>
        </div>
        <button id="new-analise-btn"
          class="flex items-center gap-1 px-3 py-1.5 rounded-lg ${t.btn} text-white text-[11px] font-bold transition-colors">
          <i data-lucide="plus" class="w-3 h-3"></i> Novo
        </button>
      </div>

      <!-- Mode tabs -->
      <div class="flex p-1 bg-zinc-100 rounded-xl gap-1">
        <button id="mode-evolucao"
          class="flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${_mode === 'evolucao' ? THEME.evolucao.tabActive : 'text-zinc-500 hover:text-zinc-800'}">
          Evoluções
        </button>
        <button id="mode-operacao"
          class="flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${_mode === 'operacao' ? THEME.operacao.tabActive : 'text-zinc-500 hover:text-zinc-800'}">
          Operações
        </button>
      </div>
    </div>

    <!-- Stats -->
    <div class="shrink-0 pt-3">${statsHTML}</div>

    <!-- History label -->
    <div class="shrink-0 px-4 pb-2">
      <span class="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
        ${modeRecords.length} registro${modeRecords.length !== 1 ? 's' : ''}
      </span>
    </div>

    <!-- History list -->
    <div class="flex-1 overflow-y-auto px-2 pb-4 space-y-1">
      ${modeRecords.length === 0
        ? `<div class="flex flex-col items-center py-10 text-center px-4">
            <div class="w-10 h-10 rounded-xl bg-zinc-100 flex items-center justify-center mb-3">
              <i data-lucide="inbox" class="w-5 h-5 text-zinc-300"></i>
            </div>
            <p class="text-xs text-zinc-400 font-medium">Nenhum registro ainda.</p>
            <p class="text-[10px] text-zinc-300 mt-1">Clique em "Novo" para começar.</p>
           </div>`
        : modeRecords.map(r => historyCard(r)).join('')}
    </div>`;
}

/* ═══════════════════════════════════════════════════════════════════
   HISTORY CARD
   ═══════════════════════════════════════════════════════════════════ */

function historyCard(record) {
    const isActive = _detail?.id === record.id;
    const t = THEME[record.mode];
    const d = new Date(record.createdAt);
    const date = d.toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit' });
    const time = d.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });

    let badge = '';
    if (record.mode === 'operacao' && record.resultado) {
        const col = { WIN:'bg-emerald-100 text-emerald-700 border-emerald-300', LOSS:'bg-red-100 text-red-700 border-red-300', BE:'bg-amber-100 text-amber-700 border-amber-300' };
        badge = `<span class="text-[10px] font-black px-1.5 py-0.5 rounded-md border shrink-0 ${col[record.resultado] || 'bg-zinc-100 text-zinc-600 border-zinc-200'}">${record.resultado}</span>`;
    } else if (record.mode === 'evolucao' && record.evolucao) {
        const good = record.evolucao === 'Funcionou';
        const bad  = record.evolucao.includes('Falhou') || record.evolucao.includes('Stop');
        const col  = good ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : bad ? 'bg-red-100 text-red-700 border-red-200' : 'bg-zinc-100 text-zinc-600 border-zinc-200';
        const short = record.evolucao.replace('Falhou — ','').replace('Em Desenvolvimento','Develop.');
        badge = `<span class="text-[9px] font-bold px-1.5 py-0.5 rounded-md border ${col} truncate max-w-[72px] shrink-0">${short}</span>`;
    }

    const title = record.mode === 'evolucao'
        ? (record.foco || 'Evolução')
        : (record.setup
            ? `${record.setup}${record.direcao ? ' ' + (record.direcao === 'Compra' ? '↑' : '↓') : ''}`
            : 'Operação');

    const subline = record.mode === 'evolucao'
        ? (record.ctf || record.timeframe || '')
        : (record.ctf || '');

    return `
    <button data-history-id="${record.id}"
      class="w-full text-left px-3 py-2.5 rounded-xl border transition-all group ${
        isActive
          ? (record.mode === 'evolucao' ? 'bg-indigo-50 border-indigo-200' : 'bg-violet-50 border-violet-200')
          : 'bg-white border-zinc-200 hover:border-zinc-300 hover:shadow-sm'
      }">
      <div class="flex items-start justify-between gap-2 mb-1">
        <span class="text-xs font-semibold text-zinc-800 truncate leading-snug flex-1">${title}</span>
        ${badge}
      </div>
      <div class="flex items-center gap-1.5 text-[10px] text-zinc-400 flex-wrap">
        <span>${date} ${time}</span>
        ${subline ? `<span class="text-zinc-300">·</span><span class="truncate max-w-[80px]">${subline}</span>` : ''}
        ${record.qualidade || record.processo ? `<span class="text-zinc-300">·</span><span class="font-bold">${record.processo || record.qualidade}</span>` : ''}
      </div>
    </button>`;
}

/* ═══════════════════════════════════════════════════════════════════
   BUILDER VIEW
   ═══════════════════════════════════════════════════════════════════ */

function builderView() {
    const steps = _mode === 'evolucao' ? EVOLUCAO_STEPS : OPERACAO_STEPS;
    const t = THEME[_mode];

    const required    = steps.filter(s => s.required);
    const answered    = required.filter(s => _sel[s.id] && String(_sel[s.id]).trim());
    const progress    = required.length > 0 ? Math.round((answered.length / required.length) * 100) : 0;
    const remaining   = required.length - answered.length;
    const canSave     = remaining === 0;

    return `
<div class="max-w-[680px] mx-auto px-4 py-6 pb-28">

  <!-- Builder header -->
  <div class="mb-6">
    <div class="flex items-center gap-3 mb-4">
      <div class="w-11 h-11 rounded-2xl ${t.bg} border ${t.border} flex items-center justify-center shrink-0 shadow-sm">
        <i data-lucide="${t.icon}" class="w-5 h-5 ${t.text}"></i>
      </div>
      <div>
        <h2 class="text-base font-bold text-zinc-900">Nova ${t.label}</h2>
        <p class="text-[11px] text-zinc-400 mt-0.5">
          ${answered.length} de ${required.length} obrigatórios preenchidos
          ${remaining > 0 ? `· faltam ${remaining}` : ' · pronto!'}
        </p>
      </div>
      <div class="ml-auto text-right">
        <div class="text-2xl font-black ${t.text}">${progress}%</div>
      </div>
    </div>
    <div class="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
      <div class="h-full rounded-full transition-all duration-500 ${t.progressBar}" style="width:${progress}%"></div>
    </div>
  </div>

  <!-- Steps -->
  <div class="space-y-2.5">
    ${steps.map((step, idx) => stepCard(step, idx)).join('')}
  </div>

</div>

<!-- Sticky save bar -->
<div class="fixed bottom-0 left-0 right-0 md:left-[17rem] bg-white/95 backdrop-blur-sm border-t border-zinc-200 px-4 py-3 flex items-center gap-3 z-10 shadow-lg">
  <div class="flex-1 min-w-0">
    ${canSave
      ? `<p class="text-xs text-emerald-600 font-semibold flex items-center gap-1.5">
           <i data-lucide="check-circle" class="w-3.5 h-3.5 shrink-0"></i>
           Tudo preenchido — pode salvar
         </p>`
      : `<p class="text-xs text-zinc-400">
           ${remaining} campo${remaining !== 1 ? 's' : ''} obrigatório${remaining !== 1 ? 's' : ''} pendente${remaining !== 1 ? 's' : ''}
         </p>`
    }
  </div>
  <button id="save-analise-btn"
    class="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
      canSave
        ? `${t.btn} text-white shadow-sm`
        : 'bg-zinc-200 text-zinc-400 cursor-not-allowed'
    }"
    ${canSave ? '' : 'disabled'}>
    <i data-lucide="save" class="w-4 h-4"></i>
    Salvar Registro
  </button>
</div>`;
}

/* ═══════════════════════════════════════════════════════════════════
   STEP CARD
   ═══════════════════════════════════════════════════════════════════ */

function stepCard(step, idx) {
    const t = THEME[_mode];
    const val = _sel[step.id];
    const isAnswered = val && String(val).trim();

    // ── Render input por tipo ──────────────────────────────────────

    let inputHTML = '';

    if (step.type === 'chips' || step.type === 'chips_free') {
        const chipsHTML = step.options.map(opt => {
            const sel = val === opt;
            return `<button class="lab-chip px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                sel
                    ? `${t.bg} ${t.border} ${t.text} font-semibold shadow-sm`
                    : 'bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50'
            }" data-step="${step.id}" data-val="${opt}">${opt}</button>`;
        }).join('');

        const isCustom = val && !step.options.includes(val);
        const freeHTML = step.type === 'chips_free' ? `
            <input type="text" id="free-${step.id}"
              class="mt-2 w-full text-xs bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:border-${t.accent}-400 transition-colors"
              placeholder="${step.placeholder || 'Outro...'}"
              value="${isCustom ? val : ''}"
              data-free="${step.id}" />` : '';

        inputHTML = `<div class="flex flex-wrap gap-1.5">${chipsHTML}</div>${freeHTML}`;

    } else if (step.type === 'themed_chips') {
        const thMap = {
            emerald: { sel:'bg-emerald-500 text-white border-emerald-500', neu:'bg-white border-emerald-200 text-emerald-700 hover:bg-emerald-50' },
            red:     { sel:'bg-red-500 text-white border-red-500',         neu:'bg-white border-red-200 text-red-700 hover:bg-red-50' },
            amber:   { sel:'bg-amber-500 text-white border-amber-500',     neu:'bg-white border-amber-200 text-amber-700 hover:bg-amber-50' }
        };
        inputHTML = `<div class="flex flex-wrap gap-2">
            ${step.options.map(opt => {
                const sel = val === opt.label;
                const c = thMap[opt.theme] || thMap.amber;
                return `<button class="lab-chip px-5 py-2.5 rounded-xl border-2 text-sm font-bold transition-all ${sel ? c.sel : c.neu}" data-step="${step.id}" data-val="${opt.label}">${opt.label}</button>`;
            }).join('')}
        </div>`;

    } else if (step.type === 'grade_chips') {
        const gMap = {
            emerald:{ sel:'bg-emerald-500 text-white border-emerald-500', neu:'bg-white border-emerald-200 text-emerald-600 hover:bg-emerald-50' },
            blue:   { sel:'bg-blue-500 text-white border-blue-500',       neu:'bg-white border-blue-200 text-blue-600 hover:bg-blue-50' },
            amber:  { sel:'bg-amber-500 text-white border-amber-500',     neu:'bg-white border-amber-200 text-amber-600 hover:bg-amber-50' },
            red:    { sel:'bg-red-500 text-white border-red-500',         neu:'bg-white border-red-200 text-red-600 hover:bg-red-50' }
        };
        inputHTML = `<div class="flex gap-2">
            ${step.options.map(opt => {
                const sel = val === opt.label;
                const c = gMap[opt.theme] || gMap.amber;
                return `<button class="lab-chip flex-1 flex flex-col items-center py-3.5 px-2 rounded-xl border-2 transition-all ${sel ? c.sel : c.neu}" data-step="${step.id}" data-val="${opt.label}">
                    <span class="text-2xl font-black leading-none">${opt.label}</span>
                    <span class="text-[10px] font-semibold opacity-75 mt-1">${opt.desc}</span>
                </button>`;
            }).join('')}
        </div>`;

    } else if (step.type === 'direction_chips') {
        inputHTML = `<div class="flex gap-3">
            ${step.options.map(opt => {
                const sel = val === opt.label;
                const c = opt.theme === 'emerald'
                    ? { sel:'bg-emerald-500 text-white border-emerald-500', neu:'bg-white border-emerald-200 text-emerald-700 hover:bg-emerald-50' }
                    : { sel:'bg-red-500 text-white border-red-500',         neu:'bg-white border-red-200 text-red-700 hover:bg-red-50' };
                const arrow = opt.theme === 'emerald' ? '↑' : '↓';
                return `<button class="lab-chip flex-1 flex flex-col items-center py-5 rounded-2xl border-2 font-bold transition-all ${sel ? c.sel : c.neu}" data-step="${step.id}" data-val="${opt.label}">
                    <span class="text-3xl leading-none mb-1">${arrow}</span>
                    <span class="text-sm">${opt.label}</span>
                    <span class="text-[10px] opacity-60">${opt.sublabel}</span>
                </button>`;
            }).join('')}
        </div>`;

    } else if (step.type === 'outcome_chips') {
        const oMap = {
            emerald:{ sel:'bg-emerald-500 text-white border-emerald-500', neu:'bg-white border-zinc-200 text-zinc-700 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700' },
            amber:  { sel:'bg-amber-500 text-white border-amber-500',     neu:'bg-white border-zinc-200 text-zinc-700 hover:border-amber-200 hover:bg-amber-50 hover:text-amber-700' },
            blue:   { sel:'bg-blue-500 text-white border-blue-500',       neu:'bg-white border-zinc-200 text-zinc-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700' },
            red:    { sel:'bg-red-500 text-white border-red-500',         neu:'bg-white border-zinc-200 text-zinc-700 hover:border-red-200 hover:bg-red-50 hover:text-red-700' },
            orange: { sel:'bg-orange-500 text-white border-orange-500',   neu:'bg-white border-zinc-200 text-zinc-700 hover:border-orange-200 hover:bg-orange-50 hover:text-orange-700' },
            purple: { sel:'bg-purple-500 text-white border-purple-500',   neu:'bg-white border-zinc-200 text-zinc-700 hover:border-purple-200 hover:bg-purple-50 hover:text-purple-700' },
            zinc:   { sel:'bg-zinc-600 text-white border-zinc-600',       neu:'bg-white border-zinc-200 text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50' }
        };
        inputHTML = `<div class="flex flex-wrap gap-1.5">
            ${step.options.map(opt => {
                const sel = val === opt.label;
                const c = oMap[opt.theme] || oMap.zinc;
                return `<button class="lab-chip px-3 py-2 rounded-lg border text-xs font-semibold transition-all ${sel ? c.sel : c.neu}" data-step="${step.id}" data-val="${opt.label}">${opt.label}</button>`;
            }).join('')}
        </div>`;

    } else if (step.type === 'result_chips') {
        const rMap = {
            WIN: { sel:'bg-emerald-500 text-white border-emerald-500', neu:'bg-white border-emerald-200 text-emerald-700 hover:bg-emerald-50' },
            LOSS:{ sel:'bg-red-500 text-white border-red-500',         neu:'bg-white border-red-200 text-red-700 hover:bg-red-50' },
            BE:  { sel:'bg-amber-500 text-white border-amber-500',     neu:'bg-white border-amber-200 text-amber-700 hover:bg-amber-50' }
        };
        inputHTML = `<div class="flex gap-3">
            ${step.options.map(opt => {
                const sel = val === opt.label;
                const c = rMap[opt.label] || rMap.BE;
                return `<button class="lab-chip flex-1 flex flex-col items-center py-4 rounded-2xl border-2 transition-all ${sel ? c.sel : c.neu}" data-step="${step.id}" data-val="${opt.label}">
                    <span class="text-xl font-black">${opt.label}</span>
                    ${opt.sublabel ? `<span class="text-[10px] font-medium opacity-70 mt-0.5">${opt.sublabel}</span>` : ''}
                </button>`;
            }).join('')}
        </div>`;

    } else if (step.type === 'textarea') {
        inputHTML = `<textarea id="ta-${step.id}"
            class="w-full text-xs bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:border-${t.accent}-400 focus:bg-white transition-colors min-h-[88px] leading-relaxed"
            placeholder="${step.placeholder || ''}"
            data-ta="${step.id}">${val || ''}</textarea>`;
    }

    // ── Valor atual exibido no header ──────────────────────────────
    let currentVal = '';
    if (isAnswered && step.type !== 'textarea') {
        currentVal = `<span class="text-[11px] font-semibold ${t.text} ${t.bg} border ${t.border} px-2.5 py-0.5 rounded-lg shrink-0 max-w-[120px] truncate block">${val}</span>`;
    }

    return `
<div class="bg-white border ${isAnswered ? `${t.border}` : 'border-zinc-200'} rounded-xl overflow-hidden transition-colors shadow-sm">
    <div class="flex items-center gap-3 px-4 py-3 ${isAnswered ? 'border-b ' + t.border : 'border-b border-zinc-100'}">
        <div class="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
            isAnswered ? `${t.bg} border ${t.border}` : 'bg-zinc-100 border border-zinc-200'
        }">
            <i data-lucide="${isAnswered ? 'check' : step.icon}" class="w-3.5 h-3.5 ${isAnswered ? t.text : 'text-zinc-400'}"></i>
        </div>
        <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
                <span class="text-xs font-semibold text-zinc-700">${step.label}</span>
                ${step.required
                    ? `<span class="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">obrigatório</span>`
                    : `<span class="text-[9px] text-zinc-300 uppercase tracking-wider">opcional</span>`}
            </div>
            <p class="text-[10px] text-zinc-400 mt-0.5 leading-snug">${step.hint}</p>
        </div>
        ${currentVal}
    </div>
    <div class="px-4 py-3 ${isAnswered && step.type !== 'textarea' ? 'pb-3' : 'pb-3.5'}">
        ${inputHTML}
    </div>
</div>`;
}

/* ═══════════════════════════════════════════════════════════════════
   DETAIL VIEW
   ═══════════════════════════════════════════════════════════════════ */

function detailView(record) {
    const t = THEME[record.mode];
    const steps = record.mode === 'evolucao' ? EVOLUCAO_STEPS : OPERACAO_STEPS;
    const d = new Date(record.createdAt);
    const dateStr = d.toLocaleString('pt-BR', {
        day:'2-digit', month:'2-digit', year:'numeric',
        hour:'2-digit', minute:'2-digit'
    });

    // ── Header badge
    let headerBadge = '';
    if (record.mode === 'operacao' && record.resultado) {
        const col = {
            WIN: 'bg-emerald-100 text-emerald-700 border-emerald-300',
            LOSS:'bg-red-100 text-red-700 border-red-300',
            BE:  'bg-amber-100 text-amber-700 border-amber-300'
        };
        headerBadge = `<div class="text-2xl font-black px-4 py-2 rounded-xl border-2 ${col[record.resultado] || 'bg-zinc-100 text-zinc-700 border-zinc-300'}">${record.resultado}</div>`;
    } else if (record.mode === 'evolucao' && record.evolucao) {
        const good = record.evolucao === 'Funcionou';
        const bad  = record.evolucao.includes('Falhou') || record.evolucao.includes('Stop');
        const col  = good ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : bad ? 'bg-red-100 text-red-700 border-red-300' : 'bg-zinc-100 text-zinc-600 border-zinc-300';
        headerBadge = `<div class="text-sm font-bold px-3 py-2 rounded-xl border ${col} text-center max-w-[140px]">${record.evolucao}</div>`;
    }

    // ── Main title
    const title = record.mode === 'evolucao'
        ? (record.foco || 'Evolução')
        : (record.setup ? `${record.setup}${record.direcao ? ' · ' + record.direcao : ''}` : 'Operação');

    // ── Fields (não-textarea)
    const fieldSteps = steps.filter(s => s.type !== 'textarea' && record[s.id]);
    const fieldsHTML = fieldSteps.map(s => {
        let dispVal = record[s.id];
        // Cor especial para campos temáticos
        let valClass = 'text-zinc-800';
        if (s.id === 'htf') {
            if (dispVal.includes('Alta') || dispVal.includes('AIL')) valClass = 'text-emerald-700 font-bold';
            else if (dispVal.includes('Baixa') || dispVal.includes('AIS')) valClass = 'text-red-700 font-bold';
            else valClass = 'text-amber-700 font-bold';
        }
        if (s.id === 'resultado') {
            valClass = dispVal === 'WIN' ? 'text-emerald-700 font-black' : dispVal === 'LOSS' ? 'text-red-700 font-black' : 'text-amber-700 font-black';
        }
        if (s.id === 'direcao') {
            valClass = dispVal === 'Compra' ? 'text-emerald-700 font-bold' : 'text-red-700 font-bold';
            dispVal = dispVal === 'Compra' ? '↑ Compra (Long)' : '↓ Venda (Short)';
        }
        return `
        <div class="flex items-start gap-3 py-3 border-b border-zinc-50 last:border-0">
            <div class="w-7 h-7 rounded-lg ${t.bg} border ${t.border} flex items-center justify-center shrink-0 mt-0.5">
                <i data-lucide="${s.icon}" class="w-3.5 h-3.5 ${t.text}"></i>
            </div>
            <div class="flex-1 min-w-0">
                <div class="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-0.5">${s.label}</div>
                <div class="text-sm ${valClass}">${dispVal}</div>
            </div>
        </div>`;
    }).join('');

    // ── Textarea fields
    const taFields = steps.filter(s => s.type === 'textarea' && record[s.id]);
    const taHTML = taFields.map(s => `
    <div class="mt-3 bg-zinc-50 border border-zinc-200 rounded-xl p-4">
        <div class="flex items-center gap-2 mb-2">
            <i data-lucide="${s.icon}" class="w-3.5 h-3.5 text-zinc-400"></i>
            <span class="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">${s.label}</span>
        </div>
        <p class="text-sm text-zinc-700 leading-relaxed whitespace-pre-wrap">${record[s.id]}</p>
    </div>`).join('');

    return `
<div class="max-w-[680px] mx-auto px-4 py-6 pb-24">

    <!-- Header -->
    <div class="flex items-start gap-4 mb-6">
        <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap mb-1.5">
                <span class="text-[10px] font-bold ${t.text} ${t.bg} border ${t.border} px-2 py-0.5 rounded-md uppercase tracking-wider">
                    ${t.label}
                </span>
                <span class="text-[10px] text-zinc-400">${dateStr}</span>
            </div>
            <h2 class="text-xl font-bold text-zinc-900 leading-tight">${title}</h2>
        </div>
        <div class="shrink-0">${headerBadge}</div>
    </div>

    <!-- Fields card -->
    <div class="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-sm mb-3">
        <div class="divide-y divide-zinc-50 px-4">
            ${fieldsHTML || `<p class="py-4 text-xs text-zinc-400 text-center">Sem campos para exibir.</p>`}
        </div>
    </div>

    ${taHTML}

    <!-- Actions -->
    <div class="mt-6 flex items-center justify-between gap-3">
        <button id="back-to-new-btn"
            class="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-sm font-semibold transition-colors">
            <i data-lucide="plus" class="w-4 h-4"></i>
            Novo Registro
        </button>
        <button id="delete-analise-btn" data-id="${record.id}"
            class="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-zinc-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 text-sm font-semibold transition-all">
            <i data-lucide="trash-2" class="w-4 h-4"></i>
            Excluir
        </button>
    </div>

</div>`;
}

/* ═══════════════════════════════════════════════════════════════════
   BIND ALL
   ═══════════════════════════════════════════════════════════════════ */

function bindAll() {
    // ── Mode tabs
    document.getElementById('mode-evolucao')?.addEventListener('click', () => {
        if (_mode === 'evolucao') return;
        _mode = 'evolucao'; _sel = {}; _detail = null;
        repaint();
    });
    document.getElementById('mode-operacao')?.addEventListener('click', () => {
        if (_mode === 'operacao') return;
        _mode = 'operacao'; _sel = {}; _detail = null;
        repaint();
    });

    // ── New button
    document.getElementById('new-analise-btn')?.addEventListener('click', () => {
        _detail = null; _sel = {};
        repaint();
    });

    // ── Mobile drawer
    document.getElementById('analise-sidebar-btn')?.addEventListener('click', () => {
        document.getElementById('analise-drawer')?.classList.remove('hidden');
    });
    document.getElementById('analise-drawer-overlay')?.addEventListener('click', () => {
        document.getElementById('analise-drawer')?.classList.add('hidden');
    });

    // ── History items
    document.querySelectorAll('[data-history-id]').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-history-id');
            const records = db();
            _detail = records.find(r => r.id === id) || null;
            repaint();
            document.getElementById('analise-drawer')?.classList.add('hidden');
        });
    });

    // ── Chips (toggle: re-click deselects)
    document.querySelectorAll('.lab-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const stepId = chip.getAttribute('data-step');
            const val    = chip.getAttribute('data-val');
            if (_sel[stepId] === val) {
                delete _sel[stepId];
            } else {
                _sel[stepId] = val;
                // Clear free input for this step if chip selected
                const freeEl = document.getElementById(`free-${stepId}`);
                if (freeEl) freeEl.value = '';
            }
            repaint();
        });
    });

    // ── Free text inputs (chips_free) — debounced, no repaint
    document.querySelectorAll('[data-free]').forEach(input => {
        // Restore value if chip not selected
        const stepId = input.getAttribute('data-free');
        const steps = _mode === 'evolucao' ? EVOLUCAO_STEPS : OPERACAO_STEPS;
        const step = steps.find(s => s.id === stepId);
        if (step && _sel[stepId] && step.options && !step.options.includes(_sel[stepId])) {
            input.value = _sel[stepId];
        }

        input.addEventListener('input', () => {
            const v = input.value.trim();
            if (v) {
                _sel[stepId] = v;
                // Unselect any chip for this step visually (chip handles are already in DOM)
            } else {
                delete _sel[stepId];
            }
            updateSaveBtn();
        });
    });

    // ── Textareas — no repaint, just update state + save btn
    document.querySelectorAll('[data-ta]').forEach(ta => {
        ta.addEventListener('input', () => {
            const stepId = ta.getAttribute('data-ta');
            const v = ta.value;
            _sel[stepId] = v;
            updateSaveBtn();
        });
    });

    // ── Save
    document.getElementById('save-analise-btn')?.addEventListener('click', () => {
        saveRecord();
    });

    // ── Back to new
    document.getElementById('back-to-new-btn')?.addEventListener('click', () => {
        _detail = null; _sel = {};
        repaint();
    });

    // ── Delete
    document.getElementById('delete-analise-btn')?.addEventListener('click', e => {
        const id = e.currentTarget.getAttribute('data-id');
        if (!confirm('Excluir este registro permanentemente?')) return;
        dbDelete(id);
        _detail = null;
        repaint();
    });
}

/* ═══════════════════════════════════════════════════════════════════
   UPDATE SAVE BTN (sem repaint completo)
   ═══════════════════════════════════════════════════════════════════ */

function updateSaveBtn() {
    const steps = _mode === 'evolucao' ? EVOLUCAO_STEPS : OPERACAO_STEPS;
    const required = steps.filter(s => s.required);
    const answered = required.filter(s => _sel[s.id] && String(_sel[s.id]).trim());
    const canSave  = answered.length === required.length;
    const t = THEME[_mode];

    const btn = document.getElementById('save-analise-btn');
    if (!btn) return;

    btn.disabled = !canSave;
    btn.className = `flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
        canSave
            ? `${t.btn} text-white shadow-sm`
            : 'bg-zinc-200 text-zinc-400 cursor-not-allowed'
    }`;
}

/* ═══════════════════════════════════════════════════════════════════
   SAVE RECORD
   ═══════════════════════════════════════════════════════════════════ */

function saveRecord() {
    // Capture latest textarea values before save
    document.querySelectorAll('[data-ta]').forEach(ta => {
        const v = ta.value.trim();
        if (v) _sel[ta.getAttribute('data-ta')] = v;
    });
    document.querySelectorAll('[data-free]').forEach(inp => {
        const v = inp.value.trim();
        const stepId = inp.getAttribute('data-free');
        if (v) _sel[stepId] = v;
    });

    const record = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
        mode: _mode,
        createdAt: new Date().toISOString(),
        ..._sel
    };

    dbAdd(record);
    _detail = record;
    _sel = {};
    repaint();
}
