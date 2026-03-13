// js/graph.js
// View /graph: grafo de conhecimento D3 force-directed + busca em cascata

import { store } from './state.js';

// ─── Ponto de entrada ─────────────────────────────────────────────────────────

export function renderGraph(container, state) {
    container.innerHTML = `
      <div class="flex flex-col h-full" id="graph-root">

        <!-- Header / controles -->
        <div class="flex items-center gap-3 px-6 py-3 border-b border-zinc-200 bg-white shrink-0 flex-wrap">
          <h2 class="text-sm font-semibold text-zinc-900 shrink-0">Grafo de Conhecimento</h2>

          <!-- Busca -->
          <div class="relative flex-1 min-w-[200px] max-w-sm">
            <i data-lucide="search" class="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"></i>
            <input id="graph-search" type="text" placeholder="Pesquisar conceito..."
              class="w-full bg-white border border-zinc-200 text-zinc-800 text-xs rounded-lg pl-8 pr-3 py-2 focus:outline-none focus:border-zinc-400 transition-colors"
            />
          </div>

          <!-- Alternância de modo -->
          <div class="flex items-center gap-1 ml-auto shrink-0">
            <button id="graph-view-visual"
              class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-900 text-white transition-colors">
              <i data-lucide="git-network" class="w-3.5 h-3.5"></i>Grafo
            </button>
            <button id="graph-view-cascade"
              class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-50 transition-colors">
              <i data-lucide="list-tree" class="w-3.5 h-3.5"></i>Cascata
            </button>
          </div>
        </div>

        <!-- Legenda (grafo visual) -->
        <div id="graph-legend"
          class="flex flex-wrap items-center gap-4 px-6 py-2 border-b border-zinc-100 bg-zinc-50 text-[11px] text-zinc-500">
          <span class="font-semibold text-zinc-400 uppercase tracking-wider text-[10px]">Retenção:</span>
          <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>≥85% Dominado</span>
          <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block"></span>≥50% Em progresso</span>
          <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full bg-red-400 inline-block"></span>&lt;50% Fraco</span>
          <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full bg-slate-300 inline-block"></span>Não estudado</span>
          <span class="ml-auto flex items-center gap-3">
            <span class="flex items-center gap-1.5">
              <span class="inline-block w-6 h-0.5 bg-indigo-400 opacity-70"></span>Pré-requisito
            </span>
            <span class="flex items-center gap-1.5">
              <span class="inline-block w-6 h-0.5 bg-zinc-200"></span>Relacionado
            </span>
          </span>
        </div>

        <!-- Área principal -->
        <div class="flex-1 relative overflow-hidden">

          <!-- Grafo visual D3 -->
          <div id="graph-visual" class="absolute inset-0">
            <svg id="graph-svg" style="width:100%;height:100%"></svg>
            <div id="graph-tooltip"
              class="absolute hidden pointer-events-none z-20 bg-zinc-900 text-white text-xs rounded-xl px-3 py-2.5 shadow-xl max-w-[220px]">
            </div>
            <div id="graph-hint"
              class="absolute bottom-4 right-4 text-[10px] text-zinc-400 bg-white/80 px-3 py-1.5 rounded-full border border-zinc-200 backdrop-blur-sm">
              Scroll para zoom · Arraste nós · Clique para abrir
            </div>
          </div>

          <!-- Busca em cascata -->
          <div id="graph-cascade" class="absolute inset-0 overflow-y-auto p-6 hidden bg-zinc-50">
            <div id="graph-cascade-results" class="max-w-2xl mx-auto space-y-3">
              <p class="text-sm text-zinc-400 text-center py-12">
                <i data-lucide="search" class="w-8 h-8 mx-auto mb-3 opacity-30"></i><br>
                Digite um termo para explorar as conexões
              </p>
            </div>
          </div>
        </div>
      </div>
    `;

    if (window.lucide) window.lucide.createIcons();

    const currentState = state || store.getState();
    const { graphNodes, graphEdges } = buildGraphDataFromConcepts(currentState.concepts || []);

    // Inicializar D3
    initD3Graph(graphNodes, graphEdges);

    // Listeners
    const searchInput = document.getElementById('graph-search');
    let searchTimer;
    searchInput?.addEventListener('input', (e) => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
            const term = e.target.value.trim();
            if (term.length < 2) {
                clearCascadeResults();
            } else {
                showCascadeResults(term, graphNodes, graphEdges);
                setViewMode('cascade');
            }
        }, 250);
    });

    document.getElementById('graph-view-visual')?.addEventListener('click', () => setViewMode('visual'));
    document.getElementById('graph-view-cascade')?.addEventListener('click', () => {
        const term = searchInput?.value.trim() || '';
        if (term.length >= 2) showCascadeResults(term, graphNodes, graphEdges);
        setViewMode('cascade');
    });
}

// ─── Construção dos dados do grafo ────────────────────────────────────────────

export function buildGraphDataFromConcepts(concepts) {
    const nodes = concepts.map(c => ({
        id: c.id,
        name: c.name,
        category: c.category || '',
        subcategory: c.subcategory || '',
        macroCategory: c.macroCategory || 'Fundamento',
        mastery: c.masteryPercentage || 0,
        abcCategory: c.abcCategory || 'C'
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

    // Arestas de pré-requisito (direcionais)
    concepts.forEach(c => {
        if (c.prerequisite && c.prerequisite !== 'Nenhum' && nodeIds.has(c.prerequisite)) {
            addEdge(c.prerequisite, c.id, 'prerequisite');
        }
    });

    // Arestas de mesma subcategoria (implícitas, cadeia linear para não poluir)
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

// ─── D3 Force Graph ───────────────────────────────────────────────────────────

function initD3Graph(nodes, edges) {
    if (!window.d3) {
        document.getElementById('graph-visual').innerHTML =
            `<div class="flex items-center justify-center h-full text-zinc-400 text-sm">D3.js não carregou. Verifique a conexão.</div>`;
        return;
    }

    const container = document.getElementById('graph-visual');
    const svgEl = document.getElementById('graph-svg');
    if (!container || !svgEl) return;

    const width = container.clientWidth || 900;
    const height = container.clientHeight || 600;

    const svg = window.d3.select(svgEl);
    svg.selectAll('*').remove();

    const masteryColor = (m) => {
        if (m >= 85) return '#10b981';
        if (m >= 50) return '#fbbf24';
        if (m > 0)   return '#f87171';
        return '#cbd5e1';
    };

    const nodeRadius = (n) => {
        if (n.macroCategory === 'Operacional') return 7;
        return 5;
    };

    // Simulação
    const simulation = window.d3.forceSimulation(nodes)
        .force('link', window.d3.forceLink(edges).id(d => d.id).distance(70).strength(0.3))
        .force('charge', window.d3.forceManyBody().strength(-130))
        .force('center', window.d3.forceCenter(width / 2, height / 2))
        .force('collision', window.d3.forceCollide(d => nodeRadius(d) + 4));

    // Zoom e pan
    const g = svg.append('g');
    svg.call(window.d3.zoom()
        .scaleExtent([0.15, 4])
        .on('zoom', (event) => g.attr('transform', event.transform)));

    // Definir seta para arestas de pré-requisito
    svg.append('defs').append('marker')
        .attr('id', 'arrow')
        .attr('viewBox', '0 -4 8 8')
        .attr('refX', 14)
        .attr('refY', 0)
        .attr('markerWidth', 6)
        .attr('markerHeight', 6)
        .attr('orient', 'auto')
        .append('path')
        .attr('d', 'M0,-4L8,0L0,4')
        .attr('fill', '#818cf8')
        .attr('opacity', 0.7);

    // Arestas
    const link = g.append('g')
        .selectAll('line')
        .data(edges)
        .join('line')
        .attr('stroke', d => d.type === 'prerequisite' ? '#818cf8' : '#e2e8f0')
        .attr('stroke-opacity', d => d.type === 'prerequisite' ? 0.65 : 0.4)
        .attr('stroke-width', d => d.type === 'prerequisite' ? 1.5 : 1)
        .attr('marker-end', d => d.type === 'prerequisite' ? 'url(#arrow)' : null);

    // Nós
    const node = g.append('g')
        .selectAll('circle')
        .data(nodes)
        .join('circle')
        .attr('r', d => nodeRadius(d))
        .attr('fill', d => masteryColor(d.mastery))
        .attr('stroke', '#fff')
        .attr('stroke-width', 1.5)
        .style('cursor', 'pointer')
        .call(window.d3.drag()
            .on('start', (event, d) => {
                if (!event.active) simulation.alphaTarget(0.3).restart();
                d.fx = d.x; d.fy = d.y;
            })
            .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y; })
            .on('end', (event, d) => {
                if (!event.active) simulation.alphaTarget(0);
                d.fx = null; d.fy = null;
            }));

    // Labels (apenas nós com mastery >= 50)
    const label = g.append('g')
        .selectAll('text')
        .data(nodes.filter(n => n.mastery >= 50))
        .join('text')
        .text(d => d.name.length > 22 ? d.name.slice(0, 20) + '…' : d.name)
        .attr('font-size', '9px')
        .attr('fill', '#52525b')
        .attr('text-anchor', 'middle')
        .attr('dy', -9)
        .style('pointer-events', 'none')
        .style('user-select', 'none');

    // Tooltip
    const tooltip = document.getElementById('graph-tooltip');
    node
        .on('mouseover', (event, d) => {
            if (!tooltip) return;
            const abcColors = { A: '#10b981', B: '#f59e0b', C: '#ef4444' };
            const abc = d.abcCategory || 'C';
            tooltip.innerHTML = `
              <div class="font-semibold mb-0.5 text-sm leading-tight">${d.name}</div>
              <div class="text-zinc-400 text-[10px] mb-1.5">${d.macroCategory} · ${d.category}</div>
              <div class="flex items-center gap-2 text-[11px]">
                <span>Retenção: <strong>${d.mastery}%</strong></span>
                <span class="px-1.5 py-0.5 rounded text-[9px] font-bold"
                  style="background:${abcColors[abc]}22;color:${abcColors[abc]}">Cat. ${abc}</span>
              </div>
            `;
            tooltip.classList.remove('hidden');
            moveTooltip(event);
        })
        .on('mousemove', moveTooltip)
        .on('mouseout', () => tooltip?.classList.add('hidden'))
        .on('click', (event, d) => {
            store.setState({ currentPage: 'concepts', selectedConceptId: d.id });
        });

    function moveTooltip(event) {
        if (!tooltip || !container) return;
        const rect = container.getBoundingClientRect();
        let x = event.clientX - rect.left + 14;
        let y = event.clientY - rect.top - 10;
        // Evitar que vá pra fora
        if (x + 220 > rect.width) x = event.clientX - rect.left - 230;
        tooltip.style.left = x + 'px';
        tooltip.style.top = y + 'px';
    }

    // Tick
    simulation.on('tick', () => {
        link
            .attr('x1', d => d.source.x).attr('y1', d => d.source.y)
            .attr('x2', d => d.target.x).attr('y2', d => d.target.y);
        node.attr('cx', d => d.x).attr('cy', d => d.y);
        label.attr('x', d => d.x).attr('y', d => d.y);
    });
}

// ─── Busca em cascata ─────────────────────────────────────────────────────────

function showCascadeResults(term, graphNodes, graphEdges) {
    const results = document.getElementById('graph-cascade-results');
    if (!results) return;

    const lower = term.toLowerCase();
    const matching = graphNodes.filter(n =>
        n.name.toLowerCase().includes(lower) ||
        n.category.toLowerCase().includes(lower) ||
        n.macroCategory.toLowerCase().includes(lower) ||
        n.subcategory.toLowerCase().includes(lower)
    );

    if (matching.length === 0) {
        results.innerHTML = `
          <div class="text-center py-12 text-zinc-400">
            <i data-lucide="search-x" class="w-8 h-8 mx-auto mb-3 opacity-40"></i>
            <p class="text-sm">Nenhum conceito encontrado para <strong>"${term}"</strong></p>
          </div>`;
        if (window.lucide) window.lucide.createIcons();
        return;
    }

    results.innerHTML = `
      <p class="text-xs text-zinc-400 mb-3">${matching.length} resultado${matching.length > 1 ? 's' : ''} para <strong class="text-zinc-600">"${term}"</strong></p>
      ${matching.slice(0, 25).map(node => renderCascadeCard(node, graphNodes, graphEdges)).join('')}
    `;

    if (window.lucide) window.lucide.createIcons();

    // Expandir/recolher card
    results.querySelectorAll('[data-cascade-toggle]').forEach(btn => {
        btn.addEventListener('click', () => {
            const panel = btn.closest('.cascade-card').querySelector('.cascade-connections');
            const chevron = btn.querySelector('.cascade-chevron');
            const isOpen = !panel?.classList.contains('hidden');
            panel?.classList.toggle('hidden', isOpen);
            chevron?.classList.toggle('rotate-180', !isOpen);
        });
    });

    // Navegar para conceito pelas pills
    results.querySelectorAll('[data-nav-concept]').forEach(pill => {
        pill.addEventListener('click', (e) => {
            e.stopPropagation();
            store.setState({ currentPage: 'concepts', selectedConceptId: pill.getAttribute('data-nav-concept') });
        });
    });
}

function renderCascadeCard(node, graphNodes, graphEdges) {
    const connected = getConnectedNodes(node.id, graphNodes, graphEdges);
    const masteryTextColor = node.mastery >= 85
        ? 'text-emerald-600' : node.mastery >= 50 ? 'text-amber-500' : 'text-red-500';
    const totalConnections = connected.prerequisites.length + connected.dependents.length + connected.related.length;

    return `
      <div class="cascade-card bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-sm">
        <button data-cascade-toggle class="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-zinc-50 transition-colors">
          <div class="flex-1 min-w-0">
            <div class="text-[10px] text-zinc-400 font-medium uppercase tracking-wider mb-0.5">
              ${node.macroCategory} · ${node.category}
            </div>
            <h3 class="text-sm font-semibold text-zinc-900 leading-tight">${node.name}</h3>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <span class="text-xs font-bold ${masteryTextColor}">${node.mastery}%</span>
            ${totalConnections > 0 ? `<span class="text-[10px] text-zinc-400">${totalConnections} conexão${totalConnections > 1 ? 'ões' : ''}</span>` : ''}
            <i data-lucide="chevron-down" class="w-4 h-4 text-zinc-400 cascade-chevron transition-transform duration-200"></i>
          </div>
        </button>

        <div class="cascade-connections hidden border-t border-zinc-100 px-5 pb-5">
          ${connected.prerequisites.length > 0 ? `
            <div class="mt-4">
              <p class="text-[10px] font-semibold text-indigo-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                <i data-lucide="arrow-up-circle" class="w-3 h-3"></i> Precisa conhecer antes
              </p>
              <div class="flex flex-wrap gap-1.5">${connected.prerequisites.map(renderPill).join('')}</div>
            </div>
          ` : ''}

          ${connected.dependents.length > 0 ? `
            <div class="mt-4">
              <p class="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider mb-2 flex items-center gap-1">
                <i data-lucide="arrow-down-circle" class="w-3 h-3"></i> Conceitos que usam este
              </p>
              <div class="flex flex-wrap gap-1.5">${connected.dependents.map(renderPill).join('')}</div>
            </div>
          ` : ''}

          ${connected.related.length > 0 ? `
            <div class="mt-4">
              <p class="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                <i data-lucide="link-2" class="w-3 h-3"></i> Relacionados (mesma categoria)
              </p>
              <div class="flex flex-wrap gap-1.5">${connected.related.slice(0, 8).map(renderPill).join('')}
              ${connected.related.length > 8 ? `<span class="text-[10px] text-zinc-400 self-center">+${connected.related.length - 8} mais</span>` : ''}
              </div>
            </div>
          ` : ''}

          ${totalConnections === 0
            ? `<p class="text-xs text-zinc-400 mt-4">Nenhuma conexão mapeada para este conceito.</p>`
            : ''}

          <button data-nav-concept="${node.id}"
            class="mt-4 w-full text-xs font-medium text-indigo-600 hover:text-indigo-800 border border-indigo-200 hover:border-indigo-300 rounded-lg py-2 transition-colors bg-indigo-50 hover:bg-indigo-100">
            Abrir conceito completo →
          </button>
        </div>
      </div>
    `;
}

function renderPill(node) {
    const bg = node.mastery >= 85
        ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
        : node.mastery >= 50
            ? 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
            : node.mastery > 0
                ? 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100'
                : 'bg-zinc-50 border-zinc-200 text-zinc-600 hover:bg-zinc-100';

    return `
      <button data-nav-concept="${node.id}"
        class="flex items-center gap-1 px-2.5 py-1 rounded-full border text-[11px] font-medium transition-colors ${bg}">
        ${node.name}
        <span class="opacity-60 text-[9px]">${node.mastery}%</span>
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

function clearCascadeResults() {
    const results = document.getElementById('graph-cascade-results');
    if (results) results.innerHTML = `
      <p class="text-sm text-zinc-400 text-center py-12">
        Digite um termo para explorar as conexões
      </p>`;
}

// ─── Alternância de modo ──────────────────────────────────────────────────────

function setViewMode(mode) {
    const visual = document.getElementById('graph-visual');
    const legend = document.getElementById('graph-legend');
    const cascade = document.getElementById('graph-cascade');
    const btnV = document.getElementById('graph-view-visual');
    const btnC = document.getElementById('graph-view-cascade');

    const activeClass = ['bg-zinc-900', 'text-white'];
    const inactiveClass = ['bg-white', 'border', 'border-zinc-200', 'text-zinc-600', 'hover:bg-zinc-50'];

    if (mode === 'visual') {
        visual?.classList.remove('hidden');
        legend?.classList.remove('hidden');
        cascade?.classList.add('hidden');
        btnV?.classList.add(...activeClass);
        btnV?.classList.remove(...inactiveClass);
        btnC?.classList.remove(...activeClass);
        btnC?.classList.add(...inactiveClass);
    } else {
        visual?.classList.add('hidden');
        legend?.classList.add('hidden');
        cascade?.classList.remove('hidden');
        btnC?.classList.add(...activeClass);
        btnC?.classList.remove(...inactiveClass);
        btnV?.classList.remove(...activeClass);
        btnV?.classList.add(...inactiveClass);
    }
}
