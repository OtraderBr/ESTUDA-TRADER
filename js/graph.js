// js/graph.js
// View /graph: Explorador de Conceitos em cascata — sem grafo D3

import { store } from './state.js';

// ─── Ponto de entrada ─────────────────────────────────────────────────────────

export function renderGraph(container, state) {
    const currentState = state || store.getState();
    const graphData = currentState.graphNodes?.length
        ? { graphNodes: currentState.graphNodes, graphEdges: currentState.graphEdges }
        : buildGraphDataFromConcepts(currentState.concepts || []);
    const { graphNodes, graphEdges } = graphData;

    const macroCategories = [...new Set(graphNodes.map(n => n.macroCategory))].filter(Boolean).sort();

    container.innerHTML = `
      <div class="flex flex-col h-full" id="graph-root">

        <!-- Header -->
        <div class="flex items-center gap-3 px-6 py-3 border-b border-zinc-200 bg-white shrink-0 flex-wrap">
          <h2 class="text-sm font-semibold text-zinc-900 shrink-0">Explorar Conceitos</h2>

          <div class="relative flex-1 min-w-[180px] max-w-sm">
            <i data-lucide="search" class="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"></i>
            <input id="graph-search" type="text" placeholder="Pesquisar conceito..."
              class="w-full bg-white border border-zinc-200 text-zinc-800 text-xs rounded-lg pl-8 pr-3 py-2 focus:outline-none focus:border-zinc-400 transition-colors"
            />
          </div>

          <div class="flex items-center gap-1.5 ml-auto shrink-0 flex-wrap">
            <button class="macro-filter-btn active px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-900 text-white transition-colors" data-macro="all">
              Todos
            </button>
            ${macroCategories.map(mc => `
              <button class="macro-filter-btn px-3 py-1.5 text-xs font-medium rounded-lg bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-50 transition-colors" data-macro="${mc}">
                ${mc}
              </button>
            `).join('')}
          </div>
        </div>

        <!-- Filtros ABC -->
        <div class="flex items-center gap-2 px-6 py-2 border-b border-zinc-100 bg-zinc-50 flex-wrap">
          <span class="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider shrink-0">Categoria:</span>
          <button class="abc-filter-btn active text-[11px] font-medium px-2.5 py-1 rounded-full border bg-zinc-900 text-white border-zinc-900 transition-colors" data-abc="all">Todas</button>
          <button class="abc-filter-btn text-[11px] font-medium px-2.5 py-1 rounded-full border bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-50 transition-colors" data-abc="A">A — Prioritário</button>
          <button class="abc-filter-btn text-[11px] font-medium px-2.5 py-1 rounded-full border bg-white text-emerald-600 border-emerald-200 hover:bg-emerald-50 transition-colors" data-abc="B">B — Em Progresso</button>
          <button class="abc-filter-btn text-[11px] font-medium px-2.5 py-1 rounded-full border bg-white text-amber-600 border-amber-200 hover:bg-amber-50 transition-colors" data-abc="C">C — Suporte</button>
          <button class="abc-filter-btn text-[11px] font-medium px-2.5 py-1 rounded-full border bg-white text-violet-600 border-violet-200 hover:bg-violet-50 transition-colors" data-abc="D">D — Validado</button>
          <button class="abc-filter-btn text-[11px] font-medium px-2.5 py-1 rounded-full border bg-white text-zinc-500 border-zinc-300 hover:bg-zinc-50 transition-colors" data-abc="E">E — Inativo</button>
        </div>

        <!-- Área principal -->
        <div class="flex-1 overflow-y-auto bg-zinc-50">
          <div id="graph-cascade-results" class="max-w-3xl mx-auto p-6 space-y-1.5">
          </div>
        </div>
      </div>
    `;

    if (window.lucide) window.lucide.createIcons();

    let currentSearch = '';
    let currentMacro = 'all';
    let currentAbc = 'all';

    function renderCascade() {
        let filtered = graphNodes;

        if (currentSearch.length >= 2) {
            const lower = currentSearch.toLowerCase();
            filtered = filtered.filter(n =>
                n.name.toLowerCase().includes(lower) ||
                n.category.toLowerCase().includes(lower) ||
                n.macroCategory.toLowerCase().includes(lower) ||
                (n.subcategory || '').toLowerCase().includes(lower)
            );
        }

        if (currentMacro !== 'all') {
            filtered = filtered.filter(n => n.macroCategory === currentMacro);
        }

        if (currentAbc !== 'all') {
            filtered = filtered.filter(n => (n.abcCategory || 'B') === currentAbc);
        }

        const results = document.getElementById('graph-cascade-results');
        if (!results) return;

        if (filtered.length === 0) {
            results.innerHTML = `
              <div class="text-center py-16 text-zinc-400">
                <i data-lucide="search-x" class="w-10 h-10 mx-auto mb-3 opacity-30"></i>
                <p class="text-sm font-medium">Nenhum conceito encontrado</p>
                <p class="text-xs mt-1 opacity-70">Tente outros filtros ou termos de busca</p>
              </div>`;
            if (window.lucide) window.lucide.createIcons();
            return;
        }

        const showGrouped = currentSearch.length < 2 && currentMacro === 'all' && currentAbc === 'all';

        if (showGrouped) {
            const groups = {};
            filtered.forEach(n => {
                const key = n.macroCategory || 'Outros';
                if (!groups[key]) groups[key] = [];
                groups[key].push(n);
            });

            const macroCatOrder = ['Fundamento', 'Operacional', 'Regras', 'Probabilidades', 'Outros'];
            const sortedGroups = macroCatOrder.filter(k => groups[k]).concat(
                Object.keys(groups).filter(k => !macroCatOrder.includes(k))
            );

            const macroCatColors = {
                Fundamento:     'text-blue-700 bg-blue-50 border-blue-200',
                Operacional:    'text-emerald-700 bg-emerald-50 border-emerald-200',
                Regras:         'text-amber-700 bg-amber-50 border-amber-200',
                Probabilidades: 'text-violet-700 bg-violet-50 border-violet-200',
                Outros:         'text-zinc-600 bg-zinc-100 border-zinc-200'
            };

            results.innerHTML = sortedGroups.map(groupKey => {
                const groupNodes = groups[groupKey];
                const colorCls = macroCatColors[groupKey] || macroCatColors.Outros;
                const dominated = groupNodes.filter(n => n.abcCategory === 'D' || n.mastery >= 85).length;
                const pct = Math.round((dominated / groupNodes.length) * 100);
                return `
                  <div class="mb-3">
                    <button class="group-header w-full flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white border border-zinc-200 hover:border-zinc-300 transition-all shadow-sm" data-group="${groupKey}">
                      <span class="text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg border ${colorCls}">${groupKey}</span>
                      <span class="text-xs text-zinc-500">${groupNodes.length} conceito${groupNodes.length !== 1 ? 's' : ''}</span>
                      <div class="flex-1 h-1.5 bg-zinc-100 rounded-full overflow-hidden mx-2">
                        <div class="h-full bg-emerald-400 rounded-full transition-all" style="width:${pct}%"></div>
                      </div>
                      <span class="text-xs font-semibold text-zinc-500">${pct}%</span>
                      <i data-lucide="chevron-down" class="w-4 h-4 text-zinc-300 group-chevron transition-transform duration-200 shrink-0"></i>
                    </button>
                    <div class="group-body mt-1.5 space-y-1.5" data-group-body="${groupKey}">
                      ${groupNodes.map(node => renderCascadeCard(node, graphNodes, graphEdges)).join('')}
                    </div>
                  </div>
                `;
            }).join('');
        } else {
            const label = currentSearch.length >= 2
                ? `${filtered.length} resultado${filtered.length !== 1 ? 's' : ''} para <strong class="text-zinc-700">"${currentSearch}"</strong>`
                : `${filtered.length} conceito${filtered.length !== 1 ? 's' : ''}`;
            results.innerHTML = `
              <p class="text-xs text-zinc-400 mb-3 px-1">${label}</p>
              ${filtered.map(node => renderCascadeCard(node, graphNodes, graphEdges)).join('')}
            `;
        }

        if (window.lucide) window.lucide.createIcons();

        // Toggle grupos
        results.querySelectorAll('.group-header').forEach(btn => {
            btn.addEventListener('click', () => {
                const groupKey = btn.getAttribute('data-group');
                const body = results.querySelector(`[data-group-body="${groupKey}"]`);
                const chevron = btn.querySelector('.group-chevron');
                if (body) {
                    const isHidden = body.classList.toggle('hidden');
                    chevron?.classList.toggle('rotate-180', !isHidden);
                }
            });
        });

        // Expandir/recolher card
        results.querySelectorAll('[data-cascade-toggle]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const card = btn.closest('.cascade-card');
                const panel = card?.querySelector('.cascade-connections');
                const chevron = btn.querySelector('.cascade-chevron');
                if (panel) {
                    const isOpen = !panel.classList.contains('hidden');
                    panel.classList.toggle('hidden', isOpen);
                    chevron?.classList.toggle('rotate-180', !isOpen);
                }
            });
        });

        // Navegar para conceito
        results.querySelectorAll('[data-nav-concept]').forEach(pill => {
            pill.addEventListener('click', (e) => {
                e.stopPropagation();
                store.setState({ selectedConceptId: pill.getAttribute('data-nav-concept') });
            });
        });
    }

    // ── Busca ──
    const searchInput = document.getElementById('graph-search');
    let searchTimer;
    searchInput?.addEventListener('input', (e) => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
            currentSearch = e.target.value.trim();
            renderCascade();
        }, 200);
    });

    // ── Filtro macro ──
    container.querySelectorAll('.macro-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            currentMacro = btn.getAttribute('data-macro');
            container.querySelectorAll('.macro-filter-btn').forEach(b => {
                b.className = 'macro-filter-btn px-3 py-1.5 text-xs font-medium rounded-lg bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-50 transition-colors';
            });
            btn.className = 'macro-filter-btn active px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-900 text-white transition-colors';
            renderCascade();
        });
    });

    // ── Filtro ABC ──
    const abcInactive = {
        all: 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50',
        A:   'bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-50',
        B:   'bg-white text-emerald-600 border-emerald-200 hover:bg-emerald-50',
        C:   'bg-white text-amber-600 border-amber-200 hover:bg-amber-50',
        D:   'bg-white text-violet-600 border-violet-200 hover:bg-violet-50',
        E:   'bg-white text-zinc-500 border-zinc-300 hover:bg-zinc-50',
    };
    const abcActive = {
        all: 'bg-zinc-900 text-white border-zinc-900',
        A:   'bg-indigo-600 text-white border-indigo-600',
        B:   'bg-emerald-600 text-white border-emerald-600',
        C:   'bg-amber-500 text-white border-amber-500',
        D:   'bg-violet-600 text-white border-violet-600',
        E:   'bg-zinc-500 text-white border-zinc-500',
    };

    container.querySelectorAll('.abc-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            currentAbc = btn.getAttribute('data-abc');
            container.querySelectorAll('.abc-filter-btn').forEach(b => {
                const k = b.getAttribute('data-abc');
                b.className = `abc-filter-btn text-[11px] font-medium px-2.5 py-1 rounded-full border transition-colors ${abcInactive[k] || abcInactive.all}`;
            });
            btn.className = `abc-filter-btn text-[11px] font-medium px-2.5 py-1 rounded-full border transition-colors ${abcActive[currentAbc] || abcActive.all}`;
            renderCascade();
        });
    });

    renderCascade();
}

// ─── Construção dos dados do grafo ────────────────────────────────────────────

export function buildGraphDataFromConcepts(concepts) {
    const nodes = concepts.map(c => ({
        id: c.id,
        name: c.name,
        category: c.category || '',
        subcategory: c.subcategory || '',
        macroCategory: c.macroCategory || 'Fundamento',
        mastery: c.abcCategory === 'D' ? 100 : (c.masteryPercentage || 0),
        abcCategory: c.abcCategory || 'B'
    }));

    const nodeIds = new Set(nodes.map(n => n.id));
    const edges = [];
    const edgeSet = new Set();

    const addEdge = (source, target, type) => {
        const key = `${source}→${target}`;
        if (!edgeSet.has(key) && source !== target) {
            edgeSet.add(key);
            edges.push({ source, target, type });
        }
    };

    concepts.forEach(c => {
        if (c.prerequisite && c.prerequisite !== 'Nenhum' && nodeIds.has(c.prerequisite)) {
            addEdge(c.prerequisite, c.id, 'prerequisite');
        }
    });

    const bySubcat = {};
    concepts.forEach(c => {
        if (!c.subcategory) return;
        if (!bySubcat[c.subcategory]) bySubcat[c.subcategory] = [];
        bySubcat[c.subcategory].push(c.id);
    });
    Object.values(bySubcat).forEach(group => {
        if (group.length < 2 || group.length > 15) return;
        for (let i = 0; i < group.length - 1; i++) {
            addEdge(group[i], group[i + 1], 'related');
        }
    });

    return { graphNodes: nodes, graphEdges: edges };
}

// ─── Card de conceito em cascata ──────────────────────────────────────────────

function renderCascadeCard(node, graphNodes, graphEdges) {
    const connected = getConnectedNodes(node.id, graphNodes, graphEdges);
    const totalConnections = connected.prerequisites.length + connected.dependents.length + connected.related.length;

    const abcBadge = {
        A: 'bg-indigo-50 border-indigo-200 text-indigo-600',
        B: 'bg-emerald-50 border-emerald-200 text-emerald-600',
        C: 'bg-amber-50 border-amber-200 text-amber-600',
        D: 'bg-violet-50 border-violet-200 text-violet-600',
        E: 'bg-zinc-100 border-zinc-300 text-zinc-500',
    };
    const abc = node.abcCategory || 'B';
    const badge = abcBadge[abc] || abcBadge.B;

    const masteryColor = node.mastery >= 85 ? 'text-emerald-600' : node.mastery >= 50 ? 'text-amber-500' : node.mastery > 0 ? 'text-red-500' : 'text-zinc-400';
    const barColor    = node.mastery >= 85 ? 'bg-emerald-500' : node.mastery >= 50 ? 'bg-amber-400' : node.mastery > 0 ? 'bg-red-400' : 'bg-zinc-200';

    return `
      <div class="cascade-card bg-white border border-zinc-200 rounded-xl overflow-hidden hover:border-zinc-300 hover:shadow-sm transition-all">
        <div class="flex items-center gap-3 px-4 py-3">
          <div class="flex-1 min-w-0">
            <div class="text-[10px] text-zinc-400 font-medium mb-0.5">${node.category}${node.subcategory ? ' · ' + node.subcategory : ''}</div>
            <div class="flex items-center gap-1.5">
              <h3 class="text-sm font-semibold text-zinc-900 leading-tight truncate">${node.name}</h3>
              ${abc === 'D' ? '<i data-lucide="shield-check" class="w-3.5 h-3.5 text-violet-400 shrink-0"></i>' : ''}
              ${abc === 'E' ? '<i data-lucide="eye-off" class="w-3.5 h-3.5 text-zinc-400 shrink-0"></i>' : ''}
            </div>
            <div class="mt-2 h-1 w-full bg-zinc-100 rounded-full overflow-hidden">
              <div class="h-full ${barColor} rounded-full" style="width:${node.mastery}%"></div>
            </div>
          </div>

          <div class="flex items-center gap-2 shrink-0">
            <span class="text-xs font-bold ${masteryColor}">${node.mastery}%</span>
            <span class="text-[10px] font-semibold px-1.5 py-0.5 rounded border ${badge}">${abc}</span>
            ${totalConnections > 0 ? `
              <button data-cascade-toggle
                class="flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 transition-colors"
                title="${totalConnections} conexão${totalConnections > 1 ? 'ões' : ''}">
                <i data-lucide="git-fork" class="w-3.5 h-3.5"></i>
                <span class="text-[10px] font-medium">${totalConnections}</span>
                <i data-lucide="chevron-down" class="w-3.5 h-3.5 cascade-chevron transition-transform duration-200"></i>
              </button>
            ` : ''}
            <button data-nav-concept="${node.id}"
              class="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-700 text-white text-[11px] font-medium transition-colors">
              Abrir <i data-lucide="arrow-right" class="w-3 h-3"></i>
            </button>
          </div>
        </div>

        ${totalConnections > 0 ? `
          <div class="cascade-connections hidden border-t border-zinc-100 px-4 pb-4 pt-3 space-y-3">
            ${connected.prerequisites.length > 0 ? `
              <div>
                <p class="text-[10px] font-semibold text-indigo-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <i data-lucide="arrow-up-circle" class="w-3 h-3"></i> Pré-requisitos
                </p>
                <div class="flex flex-wrap gap-1.5">${connected.prerequisites.map(renderPill).join('')}</div>
              </div>
            ` : ''}
            ${connected.dependents.length > 0 ? `
              <div>
                <p class="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <i data-lucide="arrow-down-circle" class="w-3 h-3"></i> Dependentes
                </p>
                <div class="flex flex-wrap gap-1.5">${connected.dependents.map(renderPill).join('')}</div>
              </div>
            ` : ''}
            ${connected.related.length > 0 ? `
              <div>
                <p class="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <i data-lucide="link-2" class="w-3 h-3"></i> Relacionados
                </p>
                <div class="flex flex-wrap gap-1.5">
                  ${connected.related.slice(0, 8).map(renderPill).join('')}
                  ${connected.related.length > 8 ? `<span class="text-[10px] text-zinc-400 self-center">+${connected.related.length - 8} mais</span>` : ''}
                </div>
              </div>
            ` : ''}
          </div>
        ` : ''}
      </div>
    `;
}

function renderPill(node) {
    const abcPill = {
        A: 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100',
        B: 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100',
        C: 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100',
        D: 'bg-violet-50 border-violet-200 text-violet-700 hover:bg-violet-100',
        E: 'bg-zinc-100 border-zinc-300 text-zinc-500 hover:bg-zinc-200',
    };
    const abc = node.abcCategory || 'B';
    const style = abcPill[abc] || abcPill.B;

    return `
      <button data-nav-concept="${node.id}"
        class="flex items-center gap-1 px-2.5 py-1 rounded-full border text-[11px] font-medium transition-colors ${style}">
        ${node.name}
        <span class="opacity-50 text-[9px]">${node.mastery}%</span>
      </button>
    `;
}

function getConnectedNodes(nodeId, graphNodes, graphEdges) {
    const nodeMap = Object.fromEntries(graphNodes.map(n => [n.id, n]));

    const resolve = (idOrObj) => {
        const id = typeof idOrObj === 'object' ? idOrObj.id : idOrObj;
        return nodeMap[id];
    };

    const prerequisites = graphEdges
        .filter(e => resolve(e.target)?.id === nodeId && e.type === 'prerequisite')
        .map(e => resolve(e.source)).filter(Boolean);

    const dependents = graphEdges
        .filter(e => resolve(e.source)?.id === nodeId && e.type === 'prerequisite')
        .map(e => resolve(e.target)).filter(Boolean);

    const related = graphEdges
        .filter(e => e.type === 'related' && (resolve(e.source)?.id === nodeId || resolve(e.target)?.id === nodeId))
        .map(e => {
            const src = resolve(e.source);
            const tgt = resolve(e.target);
            return src?.id === nodeId ? tgt : src;
        })
        .filter(Boolean);

    return { prerequisites, dependents, related };
}
