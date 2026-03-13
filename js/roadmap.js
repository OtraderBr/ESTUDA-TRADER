// js/roadmap.js
import { store } from './state.js';

export function renderRoadmap(container, state) {
  const { concepts } = state;

  container.innerHTML = `
    <div class="p-8 h-full flex flex-col bg-zinc-50" id="roadmap-content">
      <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 class="text-3xl font-bold text-zinc-900 tracking-tight flex items-center gap-3">
            <i data-lucide="target" class="w-8 h-8 text-emerald-500"></i>
            Trilha de Estudo
          </h1>
          <p class="text-zinc-500 mt-1">Navegue pela sequência lógica de aprendizado baseada em pré-requisitos.</p>
        </div>
        
        <div class="flex items-center gap-2 bg-white/50 p-1 rounded-xl border border-zinc-200">
          <button id="zoom-in" class="p-2 hover:bg-zinc-100 rounded-lg text-zinc-500 transition-colors" title="Zoom In">
            <i data-lucide="zoom-in" class="w-4 h-4"></i>
          </button>
          <button id="zoom-out" class="p-2 hover:bg-zinc-100 rounded-lg text-zinc-500 transition-colors" title="Zoom Out">
            <i data-lucide="zoom-out" class="w-4 h-4"></i>
          </button>
          <button id="zoom-reset" class="p-2 hover:bg-zinc-100 rounded-lg text-zinc-500 transition-colors" title="Reset View">
            <i data-lucide="maximize-2" class="w-4 h-4"></i>
          </button>
        </div>
      </div>
      
      <div class="flex-1 bg-zinc-100/50 border border-zinc-200/50 rounded-[2rem] overflow-hidden relative group">
        <!-- Legend -->
        <div class="absolute top-6 right-6 flex flex-col gap-3 bg-white/90 backdrop-blur-xl p-5 rounded-2xl border border-zinc-200 shadow-2xl z-10">
          <h4 class="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-1">Status de Domínio</h4>
          <div class="flex items-center gap-3 text-xs text-zinc-700">
            <div class="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]"></div>
            <span>Dominado (A)</span>
          </div>
          <div class="flex items-center gap-3 text-xs text-zinc-700">
            <div class="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]"></div>
            <span>Em Progresso (B)</span>
          </div>
          <div class="flex items-center gap-3 text-xs text-zinc-700">
            <div class="w-2.5 h-2.5 rounded-full bg-zinc-200"></div>
            <span>Não Iniciado (C)</span>
          </div>
          <div class="mt-2 pt-3 border-t border-zinc-200">
            <div class="flex items-start gap-2 text-[10px] text-zinc-500 leading-relaxed">
              <i data-lucide="info" class="w-3 h-3 mt-0.5 shrink-0"></i>
              <span>Use o scroll para zoom e arraste para navegar no mapa.</span>
            </div>
          </div>
        </div>

        <div id="d3-container" class="w-full h-full cursor-grab active:cursor-grabbing">
          <svg id="roadmap-svg" class="w-full h-full"></svg>
        </div>
      </div>
    </div>
  `;

  if (window.lucide) window.lucide.createIcons();

  // Add D3.js dynamically if not present
  if (!window.d3) {
    const script = document.createElement('script');
    script.src = 'https://d3js.org/d3.v7.min.js';
    script.onload = () => drawD3Tree(concepts);
    document.head.appendChild(script);
  } else {
    drawD3Tree(concepts);
  }
}

function drawD3Tree(concepts) {
  if (concepts.length === 0) return;

  const svgElement = d3.select('#roadmap-svg');
  svgElement.selectAll("*").remove();

  const virtualRootId = "START";
  const conceptNames = new Set(concepts.map(c => c.name));

  const data = [
    { id: virtualRootId, parentId: null, concept: null },
    ...concepts.map(c => {
      const hasValidParent = c.prerequisite !== 'Nenhum' && conceptNames.has(c.prerequisite);
      return {
        id: c.name,
        parentId: hasValidParent ? c.prerequisite : virtualRootId,
        concept: c
      };
    })
  ];

  try {
    const stratify = d3.stratify()
      .id(d => d.id)
      .parentId(d => d.parentId);

    const root = stratify(data);

    // Fixed sizing to prevent viewport shrinking
    const dx = 50;
    const dy = 280;
    const margin = { top: 60, right: 200, bottom: 60, left: 200 };

    const treeLayout = d3.tree()
      .nodeSize([dx, dy])
      .separation((a, b) => (a.parent == b.parent ? 1.2 : 2));

    treeLayout(root);

    let x0 = Infinity;
    let x1 = -x0;
    let y0 = Infinity;
    let y1 = -y0;
    root.each(d => {
      if (d.x > x1) x1 = d.x;
      if (d.x < x0) x0 = d.x;
      if (d.y > y1) y1 = d.y;
      if (d.y < y0) y0 = d.y;
    });

    // Ensure static canvas minimums
    const width = Math.max(1200, y1 - y0 + margin.left + margin.right);
    const height = Math.max(800, x1 - x0 + margin.top + margin.bottom);

    const svg = svgElement
      .attr("viewBox", [-margin.left, x0 - margin.top, width, height])
      .append("g");

    const zoom = d3.zoom()
      .scaleExtent([0.5, 3])
      .on("zoom", (event) => {
        svg.attr("transform", event.transform);
      });

    svgElement.call(zoom);

    // Zoom Controls
    d3.select('#zoom-in').on('click', () => {
      svgElement.transition().call(zoom.scaleBy, 1.2);
    });
    d3.select('#zoom-out').on('click', () => {
      svgElement.transition().call(zoom.scaleBy, 0.8);
    });
    d3.select('#zoom-reset').on('click', () => {
      svgElement.transition().call(zoom.transform, d3.zoomIdentity);
    });

    // Links
    svg.append("g")
      .attr("fill", "none")
      .attr("stroke", "#e4e4e7")
      .attr("stroke-opacity", 0.6)
      .attr("stroke-width", 1.5)
      .selectAll("path")
      .data(root.links().filter(l => l.source.id !== virtualRootId))
      .join("path")
      .attr("class", "link")
      .attr("d", d3.linkHorizontal()
        .x(d => d.y)
        .y(d => d.x));

    // Nodes
    const node = svg.append("g")
      .selectAll("g")
      .data(root.descendants().filter(d => d.id !== virtualRootId))
      .join("g")
      .attr("transform", d => `translate(${d.y},${d.x})`)
      .style("cursor", "pointer")
      .on("mouseover", function () {
        d3.select(this).select("rect").attr("stroke-width", 2).attr("opacity", 1);
        d3.select(this).select("circle").attr("r", 7);
      })
      .on("mouseout", function () {
        d3.select(this).select("rect").attr("stroke-width", 1).attr("opacity", 0.8);
        d3.select(this).select("circle").attr("r", 5);
      })
      .on("click", (event, d) => {
        store.setState({ selectedConceptId: d.data.concept.id });
      });

    // Node background
    node.append("rect")
      .attr("x", d => d.children ? -145 : 15)
      .attr("y", -15)
      .attr("width", 130)
      .attr("height", 30)
      .attr("rx", 8)
      .attr("fill", "#ffffff")
      .attr("stroke", d => {
        const mastery = d.data.concept.masteryPercentage || 0;
        if (mastery >= 85) return "#10b981";
        if (mastery > 0) return "#f59e0b";
        return "#d4d4d8";
      })
      .attr("stroke-width", 1)
      .attr("opacity", 0.8)
      .attr("class", "transition-all duration-200");

    node.append("circle")
      .attr("fill", d => {
        const mastery = d.data.concept.masteryPercentage || 0;
        if (mastery >= 85) return "#10b981";
        if (mastery > 0) return "#f59e0b";
        return "#d4d4d8";
      })
      .attr("r", 5)
      .attr("class", "transition-all duration-200");

    node.append("text")
      .attr("dy", "0.31em")
      .attr("x", d => d.children ? -25 : 25)
      .attr("text-anchor", d => d.children ? "end" : "start")
      .text(d => d.data.id.length > 18 ? d.data.id.substring(0, 15) + '...' : d.data.id)
      .attr("fill", "#18181b")
      .style("font-size", "11px")
      .style("font-weight", "600")
      .style("font-family", "Inter, sans-serif")
      .style("pointer-events", "none");

    // Tooltip
    node.append("title")
      .text(d => `${d.data.id}\nCategoria: ${d.data.concept.category}\nRetenção: ${d.data.concept.masteryPercentage || 0}%`);

  } catch (e) {
    console.error("Error building tree:", e);
  }
}
