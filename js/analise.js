// js/analise.js
// Mapeamento Visual de Price Action — módulo nativo vanilla JS
// Convertido de TypeScript (mapeamento-visual-de-price-action) para integração direta

import { PA_CONCEPTS } from '../data/pa-concepts.js';

// ─── Estado interno do canvas ────────────────────────────────────────────────
const paState = {
  nodes: [],
  edges: [],
  scale: 1,
  panX: 0,
  panY: 0,
  selectedNodeId: null,
  onNodesChange: () => {},
  onEdgesChange: () => {},
};

// ─── Interaction state ───────────────────────────────────────────────────────
let isDraggingNode = false;
let hasDragged = false;
let draggedNodeId = null;
let dragStartX = 0, dragStartY = 0, nodeStartX = 0, nodeStartY = 0;
let isPanning = false;
let panStartX = 0, panStartY = 0;
let isConnecting = false;
let connectionSourceNode = null;
let connectionSourceHandle = null;
let tempEdgePath = null;

// ─── Refs ────────────────────────────────────────────────────────────────────
let canvasContainer, transformLayer, nodesLayer, edgesLayer;

// ─── Sidebar state ───────────────────────────────────────────────────────────
let currentMode = 'evolucao';
let searchQuery = '';
let expandedCategories = {};

// ─── Storage key ─────────────────────────────────────────────────────────────
const STORAGE_KEY = 'motor-brooks-pa-canvas';

// ─── UUID generator ──────────────────────────────────────────────────────────
function uuid() {
  return crypto.randomUUID ? crypto.randomUUID() : 'xxxx-xxxx-xxxx'.replace(/x/g, () => Math.floor(Math.random() * 16).toString(16));
}

// ─── Toast notification ──────────────────────────────────────────────────────
function showToast(msg, type = 'success') {
  const existing = document.getElementById('pa-toast');
  if (existing) existing.remove();
  const colors = type === 'success' ? 'bg-emerald-600' : type === 'error' ? 'bg-red-600' : 'bg-zinc-700';
  const toast = document.createElement('div');
  toast.id = 'pa-toast';
  toast.className = `fixed bottom-6 left-1/2 -translate-x-1/2 ${colors} text-white text-sm font-medium px-5 py-2.5 rounded-xl shadow-lg z-[100] transition-all duration-300 opacity-0 translate-y-2`;
  toast.textContent = msg;
  document.body.appendChild(toast);
  requestAnimationFrame(() => { toast.classList.remove('opacity-0', 'translate-y-2'); });
  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 2200);
}

// ═════════════════════════════════════════════════════════════════════════════
//  RENDER PRINCIPAL
// ═════════════════════════════════════════════════════════════════════════════

export function renderAnalise(container) {
  if (!container) return;

  // Clean up previous event listeners
  cleanupGlobalListeners();

  container.innerHTML = `
    <div id="pa-root" class="flex h-full w-full bg-gray-50 overflow-hidden" style="font-family:'Inter',system-ui,sans-serif">
      <!-- Sidebar -->
      <aside id="pa-sidebar" class="w-72 bg-white border-r border-gray-200 flex flex-col h-full shadow-sm z-20 shrink-0
                                    max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-50 max-md:w-72 max-md:-translate-x-full max-md:transition-transform max-md:duration-200"></aside>

      <!-- Canvas -->
      <main id="pa-canvas-container" class="flex-1 h-full relative overflow-hidden bg-gray-50">
        <!-- Grid Background -->
        <div id="pa-canvas-bg" class="absolute inset-0 pointer-events-none" style="background-image:radial-gradient(#cbd5e1 1px,transparent 1px);background-size:24px 24px"></div>

        <!-- Transform Layer -->
        <div id="pa-canvas-transform" class="absolute inset-0 origin-top-left will-change-transform">
          <svg id="pa-edges-layer" class="absolute inset-0 overflow-visible pointer-events-none w-full h-full"></svg>
          <div id="pa-nodes-layer" class="absolute inset-0 w-full h-full pointer-events-none"></div>
        </div>

        <!-- Mobile sidebar toggle -->
        <button id="pa-mobile-toggle" class="md:hidden absolute top-3 left-3 z-30 p-2.5 bg-white border border-gray-200 rounded-xl shadow-sm hover:bg-gray-50 transition-colors">
          <i data-lucide="panel-left" class="w-4 h-4 text-gray-600"></i>
        </button>

        <!-- UI Controls -->
        <div class="absolute top-3 right-3 flex gap-2 z-20">
          <button id="pa-btn-save" class="flex items-center gap-2 px-3.5 py-2 bg-white border border-gray-200 rounded-xl shadow-sm hover:bg-gray-50 text-xs font-semibold text-gray-700 transition-colors pointer-events-auto">
            <i data-lucide="save" class="w-3.5 h-3.5 text-blue-600"></i> Salvar
          </button>
          <button id="pa-btn-restore" class="flex items-center gap-2 px-3.5 py-2 bg-white border border-gray-200 rounded-xl shadow-sm hover:bg-gray-50 text-xs font-semibold text-gray-700 transition-colors pointer-events-auto">
            <i data-lucide="upload" class="w-3.5 h-3.5 text-green-600"></i> Restaurar
          </button>
          <button id="pa-btn-clear" class="flex items-center gap-2 px-3.5 py-2 bg-white border border-red-200 rounded-xl shadow-sm hover:bg-red-50 text-xs font-semibold text-red-700 transition-colors pointer-events-auto">
            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i> Limpar
          </button>
        </div>

        <!-- Zoom indicator -->
        <div id="pa-zoom-indicator" class="absolute bottom-3 right-3 z-20 px-3 py-1.5 bg-white/90 border border-gray-200 rounded-lg text-[11px] font-medium text-gray-500 pointer-events-none backdrop-blur-sm">100%</div>
      </main>

      <!-- Modal -->
      <div id="pa-modal" class="hidden fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm opacity-0 transition-opacity duration-200">
        <div class="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden transform scale-95 transition-transform duration-200 mx-4" id="pa-modal-content"></div>
      </div>

      <!-- Mobile sidebar overlay -->
      <div id="pa-sidebar-overlay" class="hidden md:hidden fixed inset-0 bg-black/40 z-40 backdrop-blur-sm"></div>
    </div>
  `;

  if (window.lucide) window.lucide.createIcons();

  // ── Refs
  canvasContainer = document.getElementById('pa-canvas-container');
  transformLayer = document.getElementById('pa-canvas-transform');
  nodesLayer = document.getElementById('pa-nodes-layer');
  edgesLayer = document.getElementById('pa-edges-layer');

  // ── Auto-restore
  restoreState();

  // ── Init subsystems
  paState.onNodesChange = renderNodes;
  paState.onEdgesChange = renderEdges;
  initCanvas();
  initSidebar();
  initButtons();
  initMobileSidebar();

  // Initial render
  updateTransform();
  renderNodes();
  renderEdges();
}

// ═════════════════════════════════════════════════════════════════════════════
//  PERSISTENCE
// ═════════════════════════════════════════════════════════════════════════════

function saveState() {
  const data = { nodes: paState.nodes, edges: paState.edges, panX: paState.panX, panY: paState.panY, scale: paState.scale };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function restoreState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const data = JSON.parse(raw);
    paState.nodes = data.nodes || [];
    paState.edges = data.edges || [];
    paState.scale = data.scale || 1;
    paState.panX = data.panX || 0;
    paState.panY = data.panY || 0;
  } catch (e) { console.error('PA: failed to restore state', e); }
}

function initButtons() {
  document.getElementById('pa-btn-save')?.addEventListener('click', () => {
    saveState();
    showToast('Canvas salvo com sucesso!');
  });

  document.getElementById('pa-btn-restore')?.addEventListener('click', () => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      restoreState();
      updateTransform();
      paState.onNodesChange();
      paState.onEdgesChange();
      showToast('Canvas restaurado!');
    } else {
      showToast('Nenhum canvas salvo encontrado.', 'info');
    }
  });

  document.getElementById('pa-btn-clear')?.addEventListener('click', () => {
    if (confirm('Tem certeza que deseja limpar o canvas?')) {
      paState.nodes = [];
      paState.edges = [];
      paState.scale = 1;
      paState.panX = 0;
      paState.panY = 0;
      updateTransform();
      paState.onNodesChange();
      paState.onEdgesChange();
      showToast('Canvas limpo!', 'info');
    }
  });
}

// ═════════════════════════════════════════════════════════════════════════════
//  MOBILE SIDEBAR
// ═════════════════════════════════════════════════════════════════════════════

function initMobileSidebar() {
  const sidebar = document.getElementById('pa-sidebar');
  const overlay = document.getElementById('pa-sidebar-overlay');
  const toggle = document.getElementById('pa-mobile-toggle');

  function open() {
    sidebar?.classList.remove('max-md:-translate-x-full');
    sidebar?.classList.add('max-md:translate-x-0');
    overlay?.classList.remove('hidden');
  }
  function close() {
    sidebar?.classList.add('max-md:-translate-x-full');
    sidebar?.classList.remove('max-md:translate-x-0');
    overlay?.classList.add('hidden');
  }

  toggle?.addEventListener('click', open);
  overlay?.addEventListener('click', close);
}

// ═════════════════════════════════════════════════════════════════════════════
//  CANVAS — Pan, Zoom, Transform
// ═════════════════════════════════════════════════════════════════════════════

function updateTransform() {
  if (!transformLayer) return;
  transformLayer.style.transform = `translate(${paState.panX}px, ${paState.panY}px) scale(${paState.scale})`;
  const bg = document.getElementById('pa-canvas-bg');
  if (bg) {
    bg.style.backgroundPosition = `${paState.panX}px ${paState.panY}px`;
    bg.style.backgroundSize = `${24 * paState.scale}px ${24 * paState.scale}px`;
  }
  const zoom = document.getElementById('pa-zoom-indicator');
  if (zoom) zoom.textContent = `${Math.round(paState.scale * 100)}%`;
}

// Global listeners collection for cleanup
const globalListeners = [];
function addGlobalListener(target, event, handler, opts) {
  target.addEventListener(event, handler, opts);
  globalListeners.push({ target, event, handler, opts });
}
function cleanupGlobalListeners() {
  globalListeners.forEach(({ target, event, handler, opts }) => {
    target.removeEventListener(event, handler, opts);
  });
  globalListeners.length = 0;
}

function initCanvas() {
  // Wheel zoom
  canvasContainer.addEventListener('wheel', (e) => {
    e.preventDefault();
    let delta = e.deltaY;
    if (e.deltaMode === 1) delta *= 16;
    else if (e.deltaMode === 2) delta *= 800;
    const zoomFactor = Math.exp(-delta * 0.002);
    const newScale = Math.min(Math.max(0.1, paState.scale * zoomFactor), 3);
    const rect = canvasContainer.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    paState.panX = mouseX - (mouseX - paState.panX) * (newScale / paState.scale);
    paState.panY = mouseY - (mouseY - paState.panY) * (newScale / paState.scale);
    paState.scale = newScale;
    updateTransform();
  }, { passive: false });

  // Pan start
  canvasContainer.addEventListener('mousedown', (e) => {
    const target = e.target;
    const isBg = target === canvasContainer || target === transformLayer || target.id === 'pa-canvas-bg' || target.id === 'pa-nodes-layer' || target.id === 'pa-edges-layer';
    if (e.button === 1 || (e.button === 0 && isBg)) {
      isPanning = true;
      panStartX = e.clientX - paState.panX;
      panStartY = e.clientY - paState.panY;
      canvasContainer.style.cursor = 'grabbing';
    }
  });

  // Global move
  function onMouseMove(e) {
    if (isPanning) {
      paState.panX = e.clientX - panStartX;
      paState.panY = e.clientY - panStartY;
      updateTransform();
    }
    if (isDraggingNode && draggedNodeId) {
      const dx = (e.clientX - dragStartX) / paState.scale;
      const dy = (e.clientY - dragStartY) / paState.scale;
      if (Math.abs(e.clientX - dragStartX) > 3 || Math.abs(e.clientY - dragStartY) > 3) hasDragged = true;
      const node = paState.nodes.find(n => n.id === draggedNodeId);
      if (node) {
        node.x = nodeStartX + dx;
        node.y = nodeStartY + dy;
        const el = document.getElementById(`pa-node-${node.id}`);
        if (el) el.style.transform = `translate(${node.x}px, ${node.y}px)`;
        renderEdges();
      }
    }
    if (isConnecting && connectionSourceNode && connectionSourceHandle) {
      const rect = canvasContainer.getBoundingClientRect();
      const mouseX = (e.clientX - rect.left - paState.panX) / paState.scale;
      const mouseY = (e.clientY - rect.top - paState.panY) / paState.scale;
      const srcPos = getHandlePosition(connectionSourceNode, connectionSourceHandle);
      if (srcPos && tempEdgePath) {
        tempEdgePath.setAttribute('d', getBezierPath(srcPos.x, srcPos.y, mouseX, mouseY, connectionSourceHandle, 'top'));
      }
    }
  }
  addGlobalListener(window, 'mousemove', onMouseMove);

  // Global mouse up
  function onMouseUp(e) {
    if (isPanning) { isPanning = false; canvasContainer.style.cursor = 'default'; }
    if (isDraggingNode) { isDraggingNode = false; draggedNodeId = null; }
    if (isConnecting) {
      const targetEl = e.target?.closest?.('.pa-handle');
      if (targetEl) {
        const targetNode = targetEl.getAttribute('data-node-id');
        const targetHandle = targetEl.getAttribute('data-handle-id');
        if (targetNode !== connectionSourceNode) {
          const exists = paState.edges.some(ed =>
            (ed.source === connectionSourceNode && ed.target === targetNode && ed.sourceHandle === connectionSourceHandle && ed.targetHandle === targetHandle) ||
            (ed.source === targetNode && ed.target === connectionSourceNode && ed.sourceHandle === targetHandle && ed.targetHandle === connectionSourceHandle)
          );
          if (!exists) {
            paState.edges.push({ id: uuid(), source: connectionSourceNode, sourceHandle: connectionSourceHandle, target: targetNode, targetHandle });
            renderEdges();
          }
        }
      }
      isConnecting = false; connectionSourceNode = null; connectionSourceHandle = null;
      if (tempEdgePath) { tempEdgePath.remove(); tempEdgePath = null; }
    }
  }
  addGlobalListener(window, 'mouseup', onMouseUp);

  // Drag & Drop from sidebar
  canvasContainer.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; });
  canvasContainer.addEventListener('drop', (e) => {
    e.preventDefault();
    const conceptStr = e.dataTransfer.getData('application/json');
    if (!conceptStr) return;
    const concept = JSON.parse(conceptStr);
    const rect = canvasContainer.getBoundingClientRect();
    const x = (e.clientX - rect.left - paState.panX) / paState.scale;
    const y = (e.clientY - rect.top - paState.panY) / paState.scale;
    paState.nodes.push({ id: uuid(), x, y, concept, notes: concept.notes });
    renderNodes();
    // Close mobile sidebar after drop
    const sidebar = document.getElementById('pa-sidebar');
    sidebar?.classList.add('max-md:-translate-x-full');
    sidebar?.classList.remove('max-md:translate-x-0');
    document.getElementById('pa-sidebar-overlay')?.classList.add('hidden');
  });
}

// ═════════════════════════════════════════════════════════════════════════════
//  NODES
// ═════════════════════════════════════════════════════════════════════════════

function renderNodes() {
  if (!nodesLayer) return;
  nodesLayer.innerHTML = '';

  paState.nodes.forEach(node => {
    const isEvo = node.concept.mode === 'evolucao';
    const bgClass = isEvo ? 'bg-blue-50 border-blue-200 text-blue-900' : 'bg-emerald-50 border-emerald-200 text-emerald-900';
    const iconColor = isEvo ? 'text-blue-600' : 'text-emerald-600';
    const iconName = isEvo ? 'book-open' : 'activity';

    const el = document.createElement('div');
    el.id = `pa-node-${node.id}`;
    el.className = `absolute rounded-xl border-2 shadow-sm transition-shadow duration-200 min-w-[200px] max-w-[260px] ${bgClass} cursor-pointer pointer-events-auto hover:shadow-md`;
    el.style.transform = `translate(${node.x}px, ${node.y}px)`;

    const handles = ['top', 'right', 'bottom', 'left'].map(pos => {
      let posClass = '';
      if (pos === 'top') posClass = 'top-0 left-1/2 -translate-x-1/2 -translate-y-1/2';
      if (pos === 'bottom') posClass = 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2';
      if (pos === 'left') posClass = 'left-0 top-1/2 -translate-x-1/2 -translate-y-1/2';
      if (pos === 'right') posClass = 'right-0 top-1/2 translate-x-1/2 -translate-y-1/2';
      return `<div data-node-id="${node.id}" data-handle-id="${pos}" class="pa-handle absolute w-3 h-3 bg-slate-400 border-2 border-white rounded-full cursor-crosshair z-10 hover:bg-blue-500 hover:scale-125 transition-all ${posClass}"></div>`;
    }).join('');

    let extras = '';
    if (node.notes) extras += `<div class="mt-2 text-xs opacity-80 italic border-l-2 border-black/10 pl-2 line-clamp-2">${node.notes}</div>`;
    if (node.comments || node.imageUrl) {
      extras += `<div class="mt-2.5 pt-2.5 border-t border-black/10 flex gap-3 text-xs font-medium opacity-80">`;
      if (node.comments) extras += `<div class="flex items-center gap-1"><i data-lucide="message-square" class="w-3.5 h-3.5"></i><span>Anotações</span></div>`;
      if (node.imageUrl) extras += `<div class="flex items-center gap-1"><i data-lucide="image" class="w-3.5 h-3.5"></i><span>Imagem</span></div>`;
      extras += `</div>`;
    }

    el.innerHTML = `
      ${handles}
      <div class="p-3.5">
        <div class="flex items-start gap-2.5 mb-1">
          <div class="p-1.5 bg-white rounded-lg shadow-sm shrink-0">
            <i data-lucide="${iconName}" class="w-4 h-4 ${iconColor}"></i>
          </div>
          <div class="flex-1 min-w-0">
            <h3 class="font-bold text-[13px] leading-tight mb-0.5">${node.concept.title}</h3>
            <p class="text-[10px] font-bold uppercase tracking-wider opacity-60 truncate">${node.concept.category} &bull; ${node.concept.subcategory}</p>
          </div>
        </div>
        ${extras}
      </div>
    `;

    // Node mousedown — drag or connect
    el.addEventListener('mousedown', (e) => {
      const target = e.target;
      if (target.classList.contains('pa-handle')) {
        isConnecting = true;
        connectionSourceNode = target.getAttribute('data-node-id');
        connectionSourceHandle = target.getAttribute('data-handle-id');
        tempEdgePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        tempEdgePath.setAttribute('stroke', '#94a3b8');
        tempEdgePath.setAttribute('stroke-width', '2');
        tempEdgePath.setAttribute('fill', 'none');
        tempEdgePath.setAttribute('stroke-dasharray', '5,5');
        edgesLayer.appendChild(tempEdgePath);
        e.stopPropagation();
        return;
      }
      isDraggingNode = true;
      hasDragged = false;
      draggedNodeId = node.id;
      dragStartX = e.clientX; dragStartY = e.clientY;
      nodeStartX = node.x; nodeStartY = node.y;
      const idx = paState.nodes.findIndex(n => n.id === node.id);
      if (idx > -1) { paState.nodes.push(paState.nodes.splice(idx, 1)[0]); nodesLayer.appendChild(el); }
      e.stopPropagation();
    });

    // Click → modal
    el.addEventListener('click', (e) => {
      if (!hasDragged && !e.target.classList.contains('pa-handle')) openModal(node.id);
    });

    nodesLayer.appendChild(el);
  });

  if (window.lucide) window.lucide.createIcons();
  renderEdges();
}

// ═════════════════════════════════════════════════════════════════════════════
//  EDGES — Bezier
// ═════════════════════════════════════════════════════════════════════════════

function getHandlePosition(nodeId, handleId) {
  const node = paState.nodes.find(n => n.id === nodeId);
  const el = document.getElementById(`pa-node-${nodeId}`);
  if (!node || !el) return null;
  const w = el.offsetWidth, h = el.offsetHeight;
  if (handleId === 'top') return { x: node.x + w / 2, y: node.y };
  if (handleId === 'bottom') return { x: node.x + w / 2, y: node.y + h };
  if (handleId === 'left') return { x: node.x, y: node.y + h / 2 };
  if (handleId === 'right') return { x: node.x + w, y: node.y + h / 2 };
  return { x: node.x, y: node.y };
}

function getBezierPath(x1, y1, x2, y2, pos1, pos2) {
  const dx = Math.abs(x2 - x1) * 0.5;
  const dy = Math.abs(y2 - y1) * 0.5;
  const offset = Math.max(dx, dy, 50);
  let cp1x = x1, cp1y = y1;
  if (pos1 === 'top') cp1y -= offset;
  if (pos1 === 'bottom') cp1y += offset;
  if (pos1 === 'left') cp1x -= offset;
  if (pos1 === 'right') cp1x += offset;
  let cp2x = x2, cp2y = y2;
  if (pos2 === 'top') cp2y -= offset;
  if (pos2 === 'bottom') cp2y += offset;
  if (pos2 === 'left') cp2x -= offset;
  if (pos2 === 'right') cp2x += offset;
  return `M ${x1} ${y1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${y2}`;
}

function renderEdges() {
  if (!edgesLayer) return;
  const tmpEdge = tempEdgePath;
  edgesLayer.innerHTML = '';
  if (tmpEdge) edgesLayer.appendChild(tmpEdge);

  paState.edges.forEach(edge => {
    const srcPos = getHandlePosition(edge.source, edge.sourceHandle);
    const tgtPos = getHandlePosition(edge.target, edge.targetHandle);
    if (!srcPos || !tgtPos) return;

    const d = getBezierPath(srcPos.x, srcPos.y, tgtPos.x, tgtPos.y, edge.sourceHandle, edge.targetHandle);

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    path.setAttribute('stroke', '#94a3b8');
    path.setAttribute('stroke-width', '2');
    path.setAttribute('fill', 'none');
    path.style.transition = 'stroke 0.2s, stroke-width 0.2s';
    path.style.pointerEvents = 'none';

    const hitPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    hitPath.setAttribute('d', d);
    hitPath.setAttribute('stroke', 'transparent');
    hitPath.setAttribute('stroke-width', '15');
    hitPath.setAttribute('fill', 'none');
    hitPath.style.pointerEvents = 'stroke';
    hitPath.style.cursor = 'pointer';

    hitPath.addEventListener('mouseenter', () => { path.setAttribute('stroke', '#ef4444'); path.setAttribute('stroke-width', '4'); });
    hitPath.addEventListener('mouseleave', () => { path.setAttribute('stroke', '#94a3b8'); path.setAttribute('stroke-width', '2'); });
    hitPath.addEventListener('dblclick', () => { paState.edges = paState.edges.filter(ed => ed.id !== edge.id); renderEdges(); });

    edgesLayer.appendChild(path);
    edgesLayer.appendChild(hitPath);
  });
}

// ═════════════════════════════════════════════════════════════════════════════
//  MODAL
// ═════════════════════════════════════════════════════════════════════════════

let closeTimeout = null;

function openModal(nodeId) {
  if (closeTimeout) { clearTimeout(closeTimeout); closeTimeout = null; }
  const node = paState.nodes.find(n => n.id === nodeId);
  if (!node) return;
  const modal = document.getElementById('pa-modal');
  const content = document.getElementById('pa-modal-content');
  if (!modal || !content) return;

  content.innerHTML = `
    <div class="flex justify-between items-center p-5 border-b border-gray-100">
      <div class="flex-1 min-w-0">
        <h2 class="text-xl font-bold text-gray-900 truncate">${node.concept.title}</h2>
        <p class="text-xs font-medium text-gray-500 uppercase tracking-wider mt-1">${node.concept.category} &bull; ${node.concept.subcategory}</p>
      </div>
      <button id="pa-modal-close" class="text-gray-400 hover:text-gray-600 transition-colors p-2 rounded-full hover:bg-gray-100 shrink-0 ml-3">
        <i data-lucide="x" class="w-5 h-5"></i>
      </button>
    </div>
    <div class="p-5 space-y-5">
      <div class="space-y-2">
        <label class="flex items-center gap-2 text-sm font-semibold text-gray-700">
          <i data-lucide="message-square" class="w-4 h-4 text-blue-500"></i> Comentários e Anotações
        </label>
        <textarea id="pa-modal-comments" class="w-full h-28 p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none transition-all text-sm" placeholder="Adicione suas anotações sobre este conceito...">${node.comments || ''}</textarea>
      </div>
      <div class="space-y-2">
        <label class="flex items-center gap-2 text-sm font-semibold text-gray-700">
          <i data-lucide="image" class="w-4 h-4 text-green-500"></i> URL da Imagem de Exemplo
        </label>
        <input id="pa-modal-image-url" type="text" class="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all text-sm" placeholder="https://exemplo.com/imagem.png" value="${node.imageUrl || ''}" />
        <div id="pa-modal-image-preview" class="mt-3 rounded-xl overflow-hidden border border-gray-200 bg-gray-50 aspect-video flex items-center justify-center ${node.imageUrl ? '' : 'hidden'}">
          <img src="${node.imageUrl || ''}" alt="Exemplo" class="max-w-full max-h-full object-contain" onerror="this.style.display='none'" />
        </div>
      </div>
    </div>
    <div class="p-5 border-t border-gray-100 bg-gray-50 flex justify-between gap-3">
      <button id="pa-modal-delete" class="px-4 py-2 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-xl hover:bg-red-100 transition-colors flex items-center gap-2">
        <i data-lucide="trash-2" class="w-4 h-4"></i> Excluir Nó
      </button>
      <div class="flex gap-2">
        <button id="pa-modal-cancel" class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors">Cancelar</button>
        <button id="pa-modal-save" class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-sm">
          <i data-lucide="save" class="w-4 h-4"></i> Salvar
        </button>
      </div>
    </div>
  `;

  if (window.lucide) window.lucide.createIcons();

  document.getElementById('pa-modal-close')?.addEventListener('click', closeModal);
  document.getElementById('pa-modal-cancel')?.addEventListener('click', closeModal);

  document.getElementById('pa-modal-delete')?.addEventListener('click', () => {
    if (confirm('Excluir este conceito do canvas?')) {
      paState.nodes = paState.nodes.filter(n => n.id !== nodeId);
      paState.edges = paState.edges.filter(ed => ed.source !== nodeId && ed.target !== nodeId);
      paState.onNodesChange();
      closeModal();
    }
  });

  const imgInput = document.getElementById('pa-modal-image-url');
  const imgPreview = document.getElementById('pa-modal-image-preview');
  const imgEl = imgPreview?.querySelector('img');
  imgInput?.addEventListener('input', (e) => {
    const v = e.target.value;
    if (v && imgPreview && imgEl) { imgPreview.classList.remove('hidden'); imgEl.src = v; imgEl.style.display = 'block'; }
    else if (imgPreview) imgPreview.classList.add('hidden');
  });

  document.getElementById('pa-modal-save')?.addEventListener('click', () => {
    node.comments = document.getElementById('pa-modal-comments')?.value || '';
    node.imageUrl = document.getElementById('pa-modal-image-url')?.value || '';
    paState.onNodesChange();
    closeModal();
    showToast('Alterações salvas!');
  });

  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
  modal.classList.remove('hidden');
  setTimeout(() => { modal.classList.remove('opacity-0'); content.classList.remove('scale-95'); }, 10);
}

function closeModal() {
  const modal = document.getElementById('pa-modal');
  const content = document.getElementById('pa-modal-content');
  if (!modal || !content) return;
  modal.classList.add('opacity-0');
  content.classList.add('scale-95');
  closeTimeout = setTimeout(() => { modal.classList.add('hidden'); closeTimeout = null; }, 200);
}

// ═════════════════════════════════════════════════════════════════════════════
//  SIDEBAR — Repositório de Conceitos
// ═════════════════════════════════════════════════════════════════════════════

function initSidebar() {
  const sidebar = document.getElementById('pa-sidebar');
  if (!sidebar) return;
  renderSidebarContent(sidebar);

  sidebar.addEventListener('click', (e) => {
    const modeBtn = e.target.closest('[data-pa-mode]');
    if (modeBtn) { currentMode = modeBtn.getAttribute('data-pa-mode'); renderSidebarContent(sidebar); }
    const catBtn = e.target.closest('[data-pa-category]');
    if (catBtn) { const cat = catBtn.getAttribute('data-pa-category'); expandedCategories[cat] = !expandedCategories[cat]; renderSidebarContent(sidebar); }
  });

  sidebar.addEventListener('input', (e) => {
    if (e.target.id === 'pa-search-input') {
      searchQuery = e.target.value;
      if (searchQuery) {
        const groups = getGroupedConcepts();
        Object.keys(groups).forEach(c => expandedCategories[c] = true);
      }
      renderSidebarContent(sidebar);
    }
  });

  sidebar.addEventListener('dragstart', (e) => {
    const item = e.target.closest('[data-pa-concept-id]');
    if (item && e.dataTransfer) {
      const cid = item.getAttribute('data-pa-concept-id');
      const concept = PA_CONCEPTS.find(c => c.id === cid);
      if (concept) { e.dataTransfer.setData('application/json', JSON.stringify(concept)); e.dataTransfer.effectAllowed = 'move'; }
    }
  });
}

function getFilteredConcepts() {
  return PA_CONCEPTS.filter(c => {
    if (c.mode !== currentMode) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return c.title.toLowerCase().includes(q) || c.category.toLowerCase().includes(q) || c.subcategory.toLowerCase().includes(q) || (c.notes && c.notes.toLowerCase().includes(q));
  });
}

function getGroupedConcepts() {
  const filtered = getFilteredConcepts();
  const groups = {};
  filtered.forEach(c => {
    if (!groups[c.category]) groups[c.category] = {};
    if (!groups[c.category][c.subcategory]) groups[c.category][c.subcategory] = [];
    groups[c.category][c.subcategory].push(c);
  });
  return groups;
}

function renderSidebarContent(sidebar) {
  const wasFocused = document.activeElement?.id === 'pa-search-input';
  const groups = getGroupedConcepts();
  const hasConcepts = Object.keys(groups).length > 0;

  Object.keys(groups).forEach(cat => { if (expandedCategories[cat] === undefined) expandedCategories[cat] = true; });

  const evoActive = currentMode === 'evolucao';

  let html = `
    <div class="p-4 border-b border-gray-200 bg-gray-50/50 shrink-0">
      <div class="flex items-center justify-between mb-1">
        <h2 class="text-base font-bold text-gray-900">Repositório</h2>
        <button id="pa-sidebar-close" class="md:hidden p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors">
          <i data-lucide="x" class="w-4 h-4"></i>
        </button>
      </div>
      <p class="text-[11px] text-gray-500 mb-3">Arraste os conceitos para o canvas</p>
      <div class="flex p-1 bg-gray-100 rounded-lg mb-3">
        <button data-pa-mode="evolucao" class="flex-1 flex items-center justify-center gap-1.5 py-2 px-2 text-xs font-semibold rounded-md transition-all ${evoActive ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}">
          <i data-lucide="book-open" class="w-3.5 h-3.5"></i> Evolução
        </button>
        <button data-pa-mode="operacao" class="flex-1 flex items-center justify-center gap-1.5 py-2 px-2 text-xs font-semibold rounded-md transition-all ${!evoActive ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}">
          <i data-lucide="activity" class="w-3.5 h-3.5"></i> Operações
        </button>
      </div>
      <div class="relative">
        <i data-lucide="search" class="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400"></i>
        <input id="pa-search-input" type="text" placeholder="Buscar conceitos..." value="${searchQuery}" class="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" />
      </div>
    </div>
    <div class="flex-1 overflow-y-auto p-3 space-y-1">
  `;

  if (!hasConcepts) {
    html += `<div class="text-center py-8 text-gray-500 text-xs">Nenhum conceito encontrado.</div>`;
  } else {
    Object.entries(groups).forEach(([category, subcategories]) => {
      const isExp = expandedCategories[category];
      html += `<div class="mb-1.5">
        <button data-pa-category="${category}" class="w-full flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg transition-colors group">
          <span class="font-semibold text-gray-800 text-xs">${category}</span>
          <i data-lucide="${isExp ? 'chevron-down' : 'chevron-right'}" class="w-3.5 h-3.5 text-gray-400 group-hover:text-gray-600"></i>
        </button>`;
      if (isExp) {
        html += `<div class="pl-2 pr-1 mt-1 space-y-3 pb-1">`;
        Object.entries(subcategories).forEach(([sub, concepts]) => {
          html += `<div>
            <h4 class="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 pl-2">${sub}</h4>
            <div class="space-y-1">`;
          concepts.forEach(concept => {
            const bgCls = currentMode === 'evolucao' ? 'bg-blue-50/50 border-blue-100 hover:bg-blue-50 hover:border-blue-200' : 'bg-emerald-50/50 border-emerald-100 hover:bg-emerald-50 hover:border-emerald-200';
            html += `<div data-pa-concept-id="${concept.id}" draggable="true" class="group relative flex flex-col p-2 rounded-lg border cursor-grab transition-all hover:shadow-sm ${bgCls}">
              <div class="flex items-start">
                <i data-lucide="grip-vertical" class="w-3.5 h-3.5 text-gray-400 mr-1.5 shrink-0 mt-0.5"></i>
                <div class="flex-1 min-w-0">
                  <span class="text-xs font-medium text-gray-800 block truncate">${concept.title}</span>
                  ${concept.prerequisite ? `<span class="inline-block mt-0.5 px-1.5 py-0.5 bg-gray-200 text-gray-600 text-[9px] rounded font-medium">Pré: ${concept.prerequisite}</span>` : ''}
                </div>
                ${concept.notes ? `<div class="shrink-0 ml-1.5 text-gray-400 group-hover:text-gray-600" title="${concept.notes}"><i data-lucide="info" class="w-3.5 h-3.5"></i></div>` : ''}
              </div>
            </div>`;
          });
          html += `</div></div>`;
        });
        html += `</div>`;
      }
      html += `</div>`;
    });
  }

  html += `</div>`;
  sidebar.innerHTML = html;

  if (window.lucide) window.lucide.createIcons();

  // Re-focus search
  if (wasFocused) {
    const input = document.getElementById('pa-search-input');
    if (input) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
  }

  // Close button for mobile
  document.getElementById('pa-sidebar-close')?.addEventListener('click', () => {
    sidebar.classList.add('max-md:-translate-x-full');
    sidebar.classList.remove('max-md:translate-x-0');
    document.getElementById('pa-sidebar-overlay')?.classList.add('hidden');
  });
}
