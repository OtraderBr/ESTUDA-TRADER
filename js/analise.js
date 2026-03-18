// js/analise.js
// Mapeamento Visual de Price Action — v2 com Supabase e Sidebar Direita
// Arquitetura reestruturada conforme prompt de atualização

import { supabase } from './supabaseClient.js';
import {
  getAllCanvasMaps, createCanvasMap, updateCanvasMap, deleteCanvasMap,
  getCanvasNodes, createCanvasNode, updateCanvasNode, deleteCanvasNode,
  getCanvasEdges, createCanvasEdge, deleteCanvasEdge, saveCanvasState
} from './dataService.js';
import { PA_CONCEPTS } from '../data/pa-concepts.js';

// ═════════════════════════════════════════════════════════════════════════════
//  ESTADO
// ═════════════════════════════════════════════════════════════════════════════

const state = {
  currentMapId: null,
  nodes: [],
  edges: [],
  scale: 1,
  panX: 0,
  panY: 0,
  selectedNodeId: null,
  sidebarCollapsed: false,
  sidebarPosition: 'right',
  currentMode: 'evolucao', // 'evolucao' | 'operacao'
  searchQuery: '',
  expandedCategories: {},
  maps: [],
  isDirty: false,
  sidebarView: 'repository', // 'repository' | 'editor'
  editingNodeId: null,
  uiHidden: false, // UI principal escondida (fullscreen canvas)
  traderView: 'conceitos' // 'conceitos' | 'timeline' | 'operacional'
};

// Interaction state
let isDraggingNode = false, hasDragged = false, draggedNodeId = null;
let dragStartX = 0, dragStartY = 0, nodeStartX = 0, nodeStartY = 0;
let isPanning = false, panStartX = 0, panStartY = 0;
let isConnecting = false, connectionSourceNode = null, connectionSourceHandle = null;
let tempEdgePath = null;
let connectionTimeoutId = null;

// Refs
let canvasContainer, transformLayer, nodesLayer, edgesLayer;
let sidebarEl, overlayEl;

// Storage fallback (se não tiver mapa selecionado)
const LOCAL_STORAGE_KEY = 'motor-brooks-pa-canvas-fallback';

// ═════════════════════════════════════════════════════════════════════════════
//  UTILITÁRIOS
// ═════════════════════════════════════════════════════════════════════════════

function uuid() {
  return crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(16) + Math.random().toString(16).slice(2);
}

function showToast(msg, type = 'success') {
  const existing = document.getElementById('pa-toast');
  if (existing) existing.remove();
  const colors = { success: 'bg-emerald-600', error: 'bg-red-600', info: 'bg-zinc-700' }[type] || 'bg-zinc-700';
  const toast = document.createElement('div');
  toast.id = 'pa-toast';
  toast.className = `fixed bottom-6 left-1/2 -translate-x-1/2 ${colors} text-white text-sm font-medium px-5 py-2.5 rounded-xl shadow-lg z-[100] transition-all duration-300 opacity-0 translate-y-2`;
  toast.textContent = msg;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.remove('opacity-0', 'translate-y-2'));
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

  // Limpa listeners anteriores
  cleanupGlobalListeners();

  container.innerHTML = `
    <div id="pa-root" class="flex h-full w-full bg-gray-50 overflow-hidden" style="font-family:'Inter',system-ui,sans-serif">

      <!-- Canvas Area -->
      <main id="pa-canvas-container" class="flex-1 h-full relative overflow-hidden bg-gray-50">
        <!-- Grid Background -->
        <div id="pa-canvas-bg" class="absolute inset-0 pointer-events-none" style="background-image:radial-gradient(#cbd5e1 1px,transparent 1px);background-size:24px 24px"></div>

        <!-- Transform Layer -->
        <div id="pa-canvas-transform" class="absolute inset-0 origin-top-left will-change-transform">
          <svg id="pa-edges-layer" class="absolute inset-0 overflow-visible pointer-events-none w-full h-full"></svg>
          <div id="pa-nodes-layer" class="absolute inset-0 w-full h-full pointer-events-none"></div>
        </div>

        <!-- UI Controls Top Left -->
        <div class="absolute top-3 left-3 flex gap-2 z-20">
          <!-- Sidebar Toggle -->
          <button id="pa-btn-sidebar" class="flex items-center gap-2 px-3.5 py-2 bg-white border border-gray-200 rounded-xl shadow-sm hover:bg-gray-50 text-xs font-semibold text-gray-700 transition-colors pointer-events-auto">
            <i data-lucide="panel-right" class="w-3.5 h-3.5"></i> <span id="pa-sidebar-label">Ocultar</span>
          </button>

          <!-- UI Hide Toggle (Fullscreen) -->
          <button id="pa-btn-ui-hide" class="flex items-center gap-2 px-3.5 py-2 bg-white border border-gray-200 rounded-xl shadow-sm hover:bg-gray-50 text-xs font-semibold text-gray-700 transition-colors pointer-events-auto" title="Esconder UI - Fallback: tecla F">
            <i data-lucide="eye-off" class="w-3.5 h-3.5"></i> UI
          </button>

          <!-- Map Selector -->
          <div class="relative">
            <button id="pa-btn-maps" class="flex items-center gap-2 px-3.5 py-2 bg-white border border-gray-200 rounded-xl shadow-sm hover:bg-gray-50 text-xs font-semibold text-gray-700 transition-colors pointer-events-auto">
              <i data-lucide="layers" class="w-3.5 h-3.5"></i> <span id="pa-current-map-label">Carregar</span>
            </button>
            <div id="pa-maps-dropdown" class="hidden absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg min-w-[240px] max-h-[400px] overflow-y-auto z-30"></div>
          </div>

          <!-- Reset View -->
          <button id="pa-btn-reset-view" class="flex items-center gap-2 px-3.5 py-2 bg-white border border-gray-200 rounded-xl shadow-sm hover:bg-gray-50 text-xs font-semibold text-gray-700 transition-colors pointer-events-auto" title="Resetar Zoom/Pan">
            <i data-lucide="compass" class="w-3.5 h-3.5"></i>
          </button>
        </div>

        <!-- UI Controls Top Right -->
        <div class="absolute top-3 right-3 flex gap-2 z-20">
          <button id="pa-btn-help" class="flex items-center gap-2 px-3.5 py-2 bg-white border border-gray-200 rounded-xl shadow-sm hover:bg-gray-50 text-xs font-semibold text-gray-700 transition-colors pointer-events-auto" title="Ajuda e Atalhos">
            <i data-lucide="help-circle" class="w-3.5 h-3.5"></i>
          </button>
          <button id="pa-btn-text" class="flex items-center gap-2 px-3.5 py-2 bg-white border border-gray-200 rounded-xl shadow-sm hover:bg-gray-50 text-xs font-semibold text-gray-700 transition-colors pointer-events-auto" title="Adicionar box de texto (T)">
            <i data-lucide="type" class="w-3.5 h-3.5"></i> Texto
          </button>
          <button id="pa-btn-save" class="flex items-center gap-2 px-3.5 py-2 bg-white border border-gray-200 rounded-xl shadow-sm hover:bg-gray-50 text-xs font-semibold text-gray-700 transition-colors pointer-events-auto" title="Salvar (Ctrl+S)">
            <i data-lucide="save" class="w-3.5 h-3.5 text-blue-600"></i> Salvar
          </button>
          <button id="pa-btn-new" class="flex items-center gap-2 px-3.5 py-2 bg-white border border-gray-200 rounded-xl shadow-sm hover:bg-gray-50 text-xs font-semibold text-gray-700 transition-colors pointer-events-auto">
            <i data-lucide="plus" class="w-3.5 h-3.5"></i> Novo
          </button>
          <button id="pa-btn-clear" class="flex items-center gap-2 px-3.5 py-2 bg-white border border-red-200 rounded-xl shadow-sm hover:bg-red-50 text-xs font-semibold text-red-700 transition-colors pointer-events-auto">
            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i> Limpar
          </button>
        </div>

        <!-- Zoom Indicator -->
        <div id="pa-zoom-indicator" class="absolute bottom-3 right-3 z-20 px-3 py-1.5 bg-white/90 border border-gray-200 rounded-lg text-[11px] font-medium text-gray-500 pointer-events-none backdrop-blur-sm">100%</div>

        <!-- Connection Status -->
        <div id="pa-connection-status" class="hidden absolute top-16 left-3 z-20 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-[11px] font-medium text-blue-700 pointer-events-none">
          <i data-lucide="link" class="w-3 h-3 inline mr-1"></i>Conectando...
        </div>
        <!-- Connection Timeout Warning -->
        <div id="pa-connection-timeout" class="hidden absolute top-28 left-3 z-20 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-[11px] font-medium text-amber-700 pointer-events-none">
          <i data-lucide="alert-circle" class="w-3 h-3 inline mr-1"></i>Conexão demorando...
        </div>
      </main>

      <!-- Sidebar Direita (Repositório de Conceitos) -->
      <aside id="pa-sidebar" class="w-80 bg-white border-l border-gray-200 flex flex-col h-full shadow-sm z-20 transition-all duration-300
                                    max-md:fixed max-md:inset-y-0 max-md:right-0 max-md:z-50 max-md:w-80 max-md:translate-x-full max-md:transition-transform max-md:duration-200"></aside>

      <!-- Mobile sidebar overlay -->
      <div id="pa-sidebar-overlay" class="hidden md:hidden fixed inset-0 bg-black/40 z-40 backdrop-blur-sm"></div>


    </div>
  `;

  if (window.lucide) window.lucide.createIcons();

  // refs
  canvasContainer = document.getElementById('pa-canvas-container');
  transformLayer = document.getElementById('pa-canvas-transform');
  nodesLayer = document.getElementById('pa-nodes-layer');
  edgesLayer = document.getElementById('pa-edges-layer');
  sidebarEl = document.getElementById('pa-sidebar');
  overlayEl = document.getElementById('pa-sidebar-overlay');

  // init
  loadMaps();
  initCanvas();
  initSidebar();
  initButtons();
  initMobileSidebar();
  initPasteHandler();

  updateTransform();
  renderNodes();
  renderEdges();
}

// ═════════════════════════════════════════════════════════════════════════════
//  MAPS - Carregar/Criar/Salvar
// ═════════════════════════════════════════════════════════════════════════════

async function loadMaps() {
  const maps = await getAllCanvasMaps();
  state.maps = maps;
  renderMapsDropdown();

  // Auto-load mais recente ou cria novo
  if (maps.length > 0) {
    loadMap(maps[0].id);
  } else {
    createNewMap();
  }
}

async function createNewMap() {
  const newMap = await createCanvasMap({ title: 'Novo Mapeamento' });
  if (newMap) {
    state.maps.unshift(newMap);
    loadMap(newMap.id);
    renderMapsDropdown();
    showToast('Novo mapa criado!');
  }
}

async function loadMap(mapId) {
  state.currentMapId = mapId;
  const nodes = await getCanvasNodes(mapId);
  const edges = await getCanvasEdges(mapId);

  state.nodes = nodes.map(n => ({
    id: n.id,
    x: n.x,
    y: n.y,
    width: n.width,
    height: n.height,
    z_index: n.z_index,
    type: n.type,
    data: n.data || {},
    concept: n.data?.concept || {},
    notes: n.data?.notes || '',
    imageUrl: n.data?.imageUrl || ''
  }));

  state.edges = edges.map(e => ({
    id: e.id,
    source_id: e.source_id,
    target_id: e.target_id,
    edge_type: e.edge_type,
    label: e.label,
    color: e.color
  }));

  // Update UI
  const map = state.maps.find(m => m.id === mapId);
  document.getElementById('pa-current-map-label').textContent = map ? map.title.substring(0, 15) + (map.title.length > 15 ? '...' : '') : 'Mapa';

  updateTransform();
  renderNodes();
  renderEdges();
}

async function saveCurrentMap() {
  if (!state.currentMapId) return;

  const map = state.maps.find(m => m.id === state.currentMapId);
  if (map) {
    await updateCanvasMap(state.currentMapId, {
      title: map.title,
      viewport_x: state.panX,
      viewport_y: state.panY,
      viewport_scale: state.scale
    });
  }

  await saveCanvasState(state.currentMapId, state.nodes, state.edges, {
    viewport_x: state.panX,
    viewport_y: state.panY,
    viewport_scale: state.scale
  });

  state.isDirty = false;
  showToast('Canvas salvo no banco!');
}

function renderMapsDropdown() {
  const dropdown = document.getElementById('pa-maps-dropdown');
  if (!dropdown) return;

  // Sort maps by updated_at (most recent first)
  const sortedMaps = [...state.maps].sort((a, b) =>
    new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );

  dropdown.innerHTML = `
    <div class="px-4 py-3 border-b border-gray-200 bg-gray-50">
      <div class="text-xs font-bold text-gray-700 uppercase tracking-wider">Histórico de Canvas</div>
      <div class="text-[10px] text-gray-500 mt-0.5">${state.maps.length} canvas ${state.maps.length !== 1 ? 's' : ''} salvos</div>
    </div>
  ` + sortedMaps.map(m => {
    const date = new Date(m.updated_at).toLocaleDateString('pt-BR');
    const time = new Date(m.updated_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const isCurrent = m.id === state.currentMapId;

    return `
      <div class="px-4 py-3 border-b border-gray-100 group hover:bg-gray-50 transition-colors">
        <div class="flex items-center justify-between mb-2">
          <div class="text-xs font-semibold text-gray-800 truncate flex-1" title="${m.title}">
            ${isCurrent ? '<span class="text-emerald-600 mr-1">●</span>' : ''}${m.title}
          </div>
          <div class="flex gap-1">
            <button data-action="rename" data-map-id="${m.id}" class="p-1.5 hover:bg-blue-50 rounded transition-colors" title="Renomear">
              <i data-lucide="edit-2" class="w-3.5 h-3.5 text-blue-600"></i>
            </button>
            <button data-action="duplicate" data-map-id="${m.id}" class="p-1.5 hover:bg-green-50 rounded transition-colors" title="Duplicar">
              <i data-lucide="copy" class="w-3.5 h-3.5 text-green-600"></i>
            </button>
            <button data-action="delete" data-map-id="${m.id}" class="p-1.5 hover:bg-red-50 rounded transition-colors" title="Excluir">
              <i data-lucide="trash-2" class="w-3.5 h-3.5 text-red-600"></i>
            </button>
          </div>
        </div>
        <div class="flex items-center gap-2 text-[10px] text-gray-500 mb-2">
          <span>${date} · ${time}</span>
          <span class="text-gray-300">•</span>
          <span>${m.title.includes('cópia') ? 'Cópia' : 'Original'}</span>
        </div>
        <button data-action="load" data-map-id="${m.id}" class="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-[11px] font-semibold text-gray-700 transition-colors">
          <i data-lucide="folder-open" class="w-3.5 h-3.5"></i> ${isCurrent ? 'Canvas Atual' : 'Abrir Canvas'}
        </button>
      </div>
    `;
  }).join('');

  if (window.lucide) window.lucide.createIcons();

  // Load map on click
  dropdown.querySelectorAll('[data-map-id]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const mapId = btn.getAttribute('data-map-id');
      const action = btn.getAttribute('data-action');

      if (action) {
        e.stopPropagation();
        if (action === 'load') {
          loadMap(mapId);
          dropdown.classList.add('hidden');
        } else {
          handleMapAction(action, mapId);
        }
      }
    });
  });
}

function handleMapAction(action, mapId) {
  const map = state.maps.find(m => m.id === mapId);
  if (!map) return;

  switch (action) {
    case 'rename':
      const newTitle = prompt('Novo nome do mapa:', map.title);
      if (newTitle && newTitle.trim()) {
        updateCanvasMap(mapId, { title: newTitle });
        map.title = newTitle;
        renderMapsDropdown();
        showToast('Mapa renomeado!', 'success');
      }
      break;

    case 'duplicate':
      duplicateMap(map);
      break;

    case 'delete':
      if (confirm(`Excluir "${map.title}" permanentemente?`)) {
        deleteCanvasMap(mapId);
        state.maps = state.maps.filter(m => m.id !== mapId);
        if (state.currentMapId === mapId) {
          state.currentMapId = null;
          state.nodes = [];
          state.edges = [];
        }
        renderMapsDropdown();
        showToast('Mapa excluído!', 'info');
      }
      break;
  }
}

async function duplicateMap(map) {
  const newMap = await createCanvasMap({
    title: `${map.title} (cópia)`,
    viewport_x: map.viewport_x ?? 0,
    viewport_y: map.viewport_y ?? 0,
    viewport_scale: map.viewport_scale ?? 1
  });

  if (newMap) {
    // Copy nodes
    const nodesToCreate = state.nodes.map(n => ({
      map_id: newMap.id,
      type: n.type,
      x: n.x,
      y: n.y,
      width: n.width,
      height: n.height,
      z_index: n.z_index,
      data: n.data
    }));

    if (nodesToCreate.length > 0) {
      await supabase.from('canvas_nodes').insert(nodesToCreate);
    }

    // Copy edges
    const edgesToCreate = state.edges.map(e => ({
      map_id: newMap.id,
      source_id: e.source_id,
      target_id: e.target_id,
      source_handle: e.source_handle,
      target_handle: e.target_handle,
      edge_type: e.edge_type,
      label: e.label,
      color: e.color
    }));

    if (edgesToCreate.length > 0) {
      await supabase.from('canvas_edges').insert(edgesToCreate);
    }

    state.maps.unshift(newMap);
    renderMapsDropdown();
    showToast('Mapa duplicado!', 'success');
  }
}

// ═════════════════════════════════════════════════════════════════════════════
//  BUTTONS
// ═════════════════════════════════════════════════════════════════════════════

function initButtons() {
  document.getElementById('pa-btn-save')?.addEventListener('click', saveCurrentMap);

  document.getElementById('pa-btn-new')?.addEventListener('click', () => {
    if (state.isDirty && !confirm('Perder alterações não salvas?')) return;
    createNewMap();
  });

  document.getElementById('pa-btn-clear')?.addEventListener('click', () => {
    if (!state.currentMapId) return;
    if (confirm('Limpar todos os nodes e edges deste mapa?')) {
      state.nodes = [];
      state.edges = [];
      state.scale = 1;
      state.panX = 0;
      state.panY = 0;
      updateTransform();
      renderNodes();
      renderEdges();
      state.isDirty = true;
      showToast('Canvas limpo!', 'info');
    }
  });

  document.getElementById('pa-btn-sidebar')?.addEventListener('click', toggleSidebar);

  // UI Hide Toggle - Esconder toda UI (fullscreen canvas)
  document.getElementById('pa-btn-ui-hide')?.addEventListener('click', toggleUI);

  // Reset View - Resetar zoom e pan
  document.getElementById('pa-btn-reset-view')?.addEventListener('click', resetView);

  // Help Modal - Mostrar atalhos
  document.getElementById('pa-btn-help')?.addEventListener('click', showHelpModal);

  // Add Text Box - Criar box de texto
  document.getElementById('pa-btn-text')?.addEventListener('click', () => {
    addTextBox();
  });

  document.getElementById('pa-btn-maps')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const dropdown = document.getElementById('pa-maps-dropdown');
    dropdown.classList.toggle('hidden');
  });

  document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('pa-maps-dropdown');
    const btn = document.getElementById('pa-btn-maps');
    if (dropdown && !dropdown.contains(e.target) && !btn.contains(e.target)) {
      dropdown.classList.add('hidden');
    }
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Ignora se estiver em input/textarea
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

    if (e.key === 'f' || e.key === 'F') {
      toggleUI();
    }
    if (e.key === 'h' || e.key === 'H') {
      resetView();
    }
    if (e.key === 't' || e.key === 'T') {
      addTextBox();
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      // Deleta node selecionado
      if (state.editingNodeId) {
        const node = state.nodes.find(n => n.id === state.editingNodeId);
        if (node && confirm('Excluir este card?')) {
          state.nodes = state.nodes.filter(n => n.id !== node.id);
          state.edges = state.edges.filter(ed => ed.source_id !== node.id && ed.target_id !== node.id);
          renderNodes();
          closeNodeEditor();
          state.isDirty = true;
        }
      }
    }
    if (e.key === 'Escape') {
      // Fecha editor e deselecta
      if (state.sidebarView === 'editor') {
        closeNodeEditor();
      }
      if (state.uiHidden) {
        toggleUI();
      }
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      saveCurrentMap();
    }
  });
}

function toggleUI() {
  state.uiHidden = !state.uiHidden;
  const buttons = canvasContainer.querySelectorAll('.absolute.top-3 button');
  const zoomIndicator = document.getElementById('pa-zoom-indicator');
  if (state.uiHidden) {
    buttons.forEach(btn => btn.classList.add('hidden'));
    zoomIndicator?.classList.add('hidden');
    showToast('UI escondida - Pressione F para mostrar', 'info');
  } else {
    buttons.forEach(btn => btn.classList.remove('hidden'));
    zoomIndicator?.classList.remove('hidden');
  }
}

function resetView() {
  state.scale = 1;
  state.panX = 0;
  state.panY = 0;
  updateTransform();
  showToast('View resetada!', 'info');
}

function addTextBox() {
  const rect = canvasContainer.getBoundingClientRect();
  const x = (rect.width / 2 - state.panX) / state.scale;
  const y = (rect.height / 2 - state.panY) / state.scale;

  const newNode = {
    id: uuid(),
    x: x - 100,
    y: y - 40,
    width: 200,
    height: 80,
    type: 'note',
    data: { text: '', richText: '' },
    notes: 'Box de texto'
  };

  state.nodes.push(newNode);
  renderNodes();
  state.isDirty = true;
  showToast('Box de texto criado! Pressione T para adicionar mais', 'success');

  // Auto-open editor for text input
  openNodeEditor(newNode.id);
}

function showHelpModal() {
  const modal = document.createElement('div');
  modal.id = 'pa-help-modal';
  modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4';
  modal.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[80vh] overflow-y-auto">
      <div class="p-5 border-b border-gray-200 flex items-center justify-between">
        <h3 class="text-base font-bold text-gray-900">Atalhos de Teclado</h3>
        <button id="pa-help-close" class="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <i data-lucide="x" class="w-4 h-4 text-gray-500"></i>
        </button>
      </div>
      <div class="p-5 space-y-3">
        <div class="flex items-center justify-between py-2 border-b border-gray-100">
          <span class="text-sm text-gray-700">Texto box</span>
          <kbd class="px-2 py-1 bg-gray-100 rounded text-xs font-mono">T</kbd>
        </div>
        <div class="flex items-center justify-between py-2 border-b border-gray-100">
          <span class="text-sm text-gray-700">Esconder UI</span>
          <kbd class="px-2 py-1 bg-gray-100 rounded text-xs font-mono">F</kbd>
        </div>
        <div class="flex items-center justify-between py-2 border-b border-gray-100">
          <span class="text-sm text-gray-700">Reset view</span>
          <kbd class="px-2 py-1 bg-gray-100 rounded text-xs font-mono">H</kbd>
        </div>
        <div class="flex items-center justify-between py-2 border-b border-gray-100">
          <span class="text-sm text-gray-700">Salvar canvas</span>
          <kbd class="px-2 py-1 bg-gray-100 rounded text-xs font-mono">Ctrl+S</kbd>
        </div>
        <div class="flex items-center justify-between py-2 border-b border-gray-100">
          <span class="text-sm text-gray-700">Excluir node</span>
          <kbd class="px-2 py-1 bg-gray-100 rounded text-xs font-mono">Del/Backspace</kbd>
        </div>
        <div class="flex items-center justify-between py-2 border-b border-gray-100">
          <span class="text-sm text-gray-700">Fechar editor</span>
          <kbd class="px-2 py-1 bg-gray-100 rounded text-xs font-mono">Esc</kbd>
        </div>
        <div class="flex items-center justify-between py-2">
          <span class="text-sm text-gray-700">Conectar nodes</span>
          <kbd class="px-2 py-1 bg-gray-100 rounded text-xs font-mono">Drag handles</kbd>
        </div>
      </div>
      <div class="p-4 bg-gray-50 rounded-b-2xl">
        <p class="text-xs text-gray-500 text-center">
          <i data-lucide="info" class="w-3 h-3 inline mr-1"></i>
          Arraste conceitos da sidebar ou cole imagens (Ctrl+V)
        </p>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  if (window.lucide) window.lucide.createIcons();

  document.getElementById('pa-help-close')?.addEventListener('click', () => {
    modal.remove();
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });
}

function toggleSidebar() {
  state.sidebarCollapsed = !state.sidebarCollapsed;
  sidebarEl.classList.toggle('hidden', state.sidebarCollapsed);
  sidebarEl.classList.toggle('w-0', state.sidebarCollapsed);
  sidebarEl.classList.toggle('w-80', !state.sidebarCollapsed);

  const label = document.getElementById('pa-sidebar-label');
  if (label) label.textContent = state.sidebarCollapsed ? 'Mostrar' : 'Ocultar';
}

// ═════════════════════════════════════════════════════════════════════════════
//  MOBILE SIDEBAR
// ═════════════════════════════════════════════════════════════════════════════

function initMobileSidebar() {
  function open() {
    sidebarEl?.classList.remove('max-md:translate-x-full');
    sidebarEl?.classList.add('max-md:translate-x-0');
    overlayEl?.classList.remove('hidden');
  }
  function close() {
    sidebarEl?.classList.add('max-md:translate-x-full');
    sidebarEl?.classList.remove('max-md:translate-x-0');
    overlayEl?.classList.add('hidden');
  }

  document.getElementById('pa-btn-sidebar')?.addEventListener('click', () => {
    if (window.innerWidth < 768) open();
    else toggleSidebar();
  });

  overlayEl?.addEventListener('click', close);
}

// ═════════════════════════════════════════════════════════════════════════════
//  CANVAS — Pan, Zoom, Transform
// ═════════════════════════════════════════════════════════════════════════════

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

function updateTransform() {
  if (!transformLayer) return;
  transformLayer.style.transform = `translate(${state.panX}px, ${state.panY}px) scale(${state.scale})`;
  const bg = document.getElementById('pa-canvas-bg');
  if (bg) {
    bg.style.backgroundPosition = `${state.panX}px ${state.panY}px`;
    bg.style.backgroundSize = `${24 * state.scale}px ${24 * state.scale}px`;
  }
  const zoom = document.getElementById('pa-zoom-indicator');
  if (zoom) zoom.textContent = `${Math.round(state.scale * 100)}%`;
}

function initCanvas() {
  // Wheel zoom
  canvasContainer.addEventListener('wheel', (e) => {
    e.preventDefault();
    let delta = e.deltaY;
    if (e.deltaMode === 1) delta *= 16;
    else if (e.deltaMode === 2) delta *= 800;
    const zoomFactor = Math.exp(-delta * 0.002);
    const newScale = Math.min(Math.max(0.1, state.scale * zoomFactor), 3);
    const rect = canvasContainer.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    state.panX = mouseX - (mouseX - state.panX) * (newScale / state.scale);
    state.panY = mouseY - (mouseY - state.panY) * (newScale / state.scale);
    state.scale = newScale;
    updateTransform();
  }, { passive: false });

  // Pan start (middle click or space+click)
  canvasContainer.addEventListener('mousedown', (e) => {
    const target = e.target;
    const isBg = target === canvasContainer || target === transformLayer || target.id === 'pa-canvas-bg' || target.id === 'pa-nodes-layer' || target.id === 'pa-edges-layer';
    if (e.button === 1 || (e.button === 0 && isBg)) {
      isPanning = true;
      panStartX = e.clientX - state.panX;
      panStartY = e.clientY - state.panY;
      canvasContainer.style.cursor = 'grabbing';
    }
  });

  // Global move
  function onMouseMove(e) {
    if (isPanning) {
      state.panX = e.clientX - panStartX;
      state.panY = e.clientY - panStartY;
      updateTransform();
    }
    if (isDraggingNode && draggedNodeId) {
      const dx = (e.clientX - dragStartX) / state.scale;
      const dy = (e.clientY - dragStartY) / state.scale;
      if (Math.abs(e.clientX - dragStartX) > 3 || Math.abs(e.clientY - dragStartY) > 3) hasDragged = true;
      const node = state.nodes.find(n => n.id === draggedNodeId);
      if (node) {
        node.x = nodeStartX + dx;
        node.y = nodeStartY + dy;
        const el = document.getElementById(`pa-node-${node.id}`);
        if (el) {
          el.style.transform = `translate(${node.x}px, ${node.y}px)`;
          updateCanvasNode(node.id, { x: node.x, y: node.y });
        }
        renderEdges();
        state.isDirty = true;
      }
    }
    if (isConnecting && connectionSourceNode && connectionSourceHandle) {
      const rect = canvasContainer.getBoundingClientRect();
      const mouseX = (e.clientX - rect.left - state.panX) / state.scale;
      const mouseY = (e.clientY - rect.top - state.panY) / state.scale;
      const srcPos = getHandlePosition(connectionSourceNode, connectionSourceHandle);
      if (srcPos && tempEdgePath) {
        tempEdgePath.setAttribute('d', getBezierPath(srcPos.x, srcPos.y, mouseX, mouseY, connectionSourceHandle, 'top'));
      }
    }
  }
  addGlobalListener(window, 'mousemove', onMouseMove);

  // Global mouse up
  function onMouseUp(e) {
    if (isPanning) {
      isPanning = false;
      canvasContainer.style.cursor = 'default';
    }
    if (isDraggingNode) {
      isDraggingNode = false;
      draggedNodeId = null;
    }
    if (isConnecting) {
      const targetEl = e.target?.closest?.('.pa-handle');
      if (targetEl) {
        const targetNode = targetEl.getAttribute('data-node-id');
        const targetHandle = targetEl.getAttribute('data-handle-id');

        if (targetNode && targetNode !== connectionSourceNode) {
          // Check if edge already exists
          const exists = state.edges.some(ed =>
            (ed.source_id === connectionSourceNode && ed.target_id === targetNode) ||
            (ed.source_id === targetNode && ed.target_id === connectionSourceNode)
          );

          if (!exists) {
            state.edges.push({
              id: uuid(),
              source_id: connectionSourceNode,
              target_id: targetNode,
              source_handle: connectionSourceHandle || 'right',
              target_handle: targetHandle || 'left',
              edge_type: 'arrow'
            });
            renderEdges();
            state.isDirty = true;
            showToast('Conexão criada!', 'success');
          } else {
            showToast('Conexão já existe!', 'info');
          }
        }
      }

      isConnecting = false;
      connectionSourceNode = null;
      connectionSourceHandle = null;

      // Clear connection timeout
      if (connectionTimeoutId) {
        clearTimeout(connectionTimeoutId);
        connectionTimeoutId = null;
      }

      if (tempEdgePath) {
        tempEdgePath.remove();
        tempEdgePath = null;
      }

      // Hide connection status message
      const connStatus = document.getElementById('pa-connection-status');
      if (connStatus) connStatus.classList.add('hidden');

      // Hide connection timeout warning
      const connTimeout = document.getElementById('pa-connection-timeout');
      if (connTimeout) connTimeout.classList.add('hidden');
    } else {
      // Connection was cancelled - clear timeout
      if (connectionTimeoutId) {
        clearTimeout(connectionTimeoutId);
        connectionTimeoutId = null;
      }
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
    const x = (e.clientX - rect.left - state.panX) / state.scale;
    const y = (e.clientY - rect.top - state.panY) / state.scale;

    state.nodes.push({
      id: uuid(),
      x, y,
      type: 'concept',
      data: { concept, notes: concept.notes },
      concept,
      notes: concept.notes
    });

    renderNodes();
    state.isDirty = true;

    // Close mobile sidebar after drop
    sidebarEl?.classList.add('max-md:-translate-x-full');
    sidebarEl?.classList.remove('max-md:translate-x-0');
    overlayEl?.classList.add('hidden');
  });
}

// ═════════════════════════════════════════════════════════════════════════════
//  PASTE HANDLER - Colar imagens diretamente
// ═════════════════════════════════════════════════════════════════════════════

function initPasteHandler() {
  document.addEventListener('paste', async (e) => {
    // Se editor de nó está aberto, ignora
    if (state.sidebarView === 'editor') return;

    const items = e.clipboardData?.items;
    if (!items) return;

    for (let item of items) {
      if (item.type?.startsWith('image/')) {
        e.preventDefault();
        const blob = item.getAsFile();
        if (!blob) return;

        // Converte para base64 e salva no node
        const reader = new FileReader();
        reader.onload = (ev) => {
          const base64 = ev.target.result;
          const rect = canvasContainer.getBoundingClientRect();
          const x = (e.clientX - rect.left - state.panX) / state.scale - 100;
          const y = (e.clientY - rect.top - state.panY) / state.scale - 50;

          state.nodes.push({
            id: uuid(),
            x, y,
            type: 'image',
            data: { imageUrl: base64, caption: 'Imagem colada' },
            imageUrl: base64
          });

          renderNodes();
          state.isDirty = true;
          showToast('Imagem colada no canvas!');
        };
        reader.readAsDataURL(blob);
        break;
      }
    }

    // Paste de links/URLs
    const text = e.clipboardData?.getData('text');
    if (text && (text.startsWith('http') || text.includes('.'))) {
      e.preventDefault();
      const rect = canvasContainer.getBoundingClientRect();
      const x = (e.clientX - rect.left - state.panX) / state.scale - 100;
      const y = (e.clientY - rect.top - state.panY) / state.scale - 50;

      state.nodes.push({
        id: uuid(),
        x, y,
        type: 'note',
        data: { text: text, richText: '' },
        notes: text
      });

      renderNodes();
      state.isDirty = true;
      showToast('Link colado como anotação!', 'info');
    }
  });
}

// ═════════════════════════════════════════════════════════════════════════════
//  NODES
// ═════════════════════════════════════════════════════════════════════════════

function renderNodes() {
  if (!nodesLayer) return;
  nodesLayer.innerHTML = '';

  state.nodes.forEach(node => {
    const isEvo = node.concept?.mode === 'evolucao';
    const isImage = node.type === 'image';
    const isNote = node.type === 'note';

    let bgClass, iconColor, iconName;
    if (isImage) {
      bgClass = 'bg-purple-50 border-purple-200 text-purple-900';
      iconColor = 'text-purple-600';
      iconName = 'image';
    } else if (isNote) {
      bgClass = 'bg-amber-50 border-amber-200 text-amber-900';
      iconColor = 'text-amber-600';
      iconName = 'sticky-note';
    } else {
      bgClass = isEvo ? 'bg-blue-50 border-blue-200 text-blue-900' : 'bg-emerald-50 border-emerald-200 text-emerald-900';
      iconColor = isEvo ? 'text-blue-600' : 'text-emerald-600';
      iconName = isEvo ? 'book-open' : 'activity';
    }

    const el = document.createElement('div');
    el.id = `pa-node-${node.id}`;
    el.className = `absolute rounded-xl border-2 shadow-sm transition-shadow duration-200 min-w-[200px] max-w-[260px] ${bgClass} cursor-pointer pointer-events-auto hover:shadow-md`;
    el.style.transform = `translate(${node.x}px, ${node.y}px)`;
    el.style.width = `${node.width || 220}px`;
    el.style.height = node.type === 'image' && node.imageUrl ? 'auto' : `${node.height || 80}px`;

    const handles = ['top', 'right', 'bottom', 'left'].map(pos => {
      let posClass = '';
      if (pos === 'top') posClass = 'top-0 left-1/2 -translate-x-1/2 -translate-y-1/2';
      if (pos === 'bottom') posClass = 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2';
      if (pos === 'left') posClass = 'left-0 top-1/2 -translate-x-1/2 -translate-y-1/2';
      if (pos === 'right') posClass = 'right-0 top-1/2 translate-x-1/2 -translate-y-1/2';
      return `<div data-node-id="${node.id}" data-handle-id="${pos}" class="pa-handle absolute w-3 h-3 bg-slate-400 border-2 border-white rounded-full cursor-crosshair z-10 hover:bg-blue-500 hover:scale-125 transition-all ${posClass}"></div>`;
    }).join('');

    // Delete button HTML
    const deleteBtn = `<button data-delete-node="${node.id}" class="absolute top-2 right-2 p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 transition-colors z-20" title="Excluir card">
      <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
    </button>`;

    // Conteúdo do node com verificação de imagem - SEM ÍCONES
    if (isImage && node.imageUrl) {
      el.innerHTML = `
        ${handles}
        ${deleteBtn}
        <div class="p-2 cursor-grab active:cursor-grabbing">
          <div style="background:#fff; border-radius:8px; overflow:hidden;">
            <img src="${node.imageUrl}" alt="" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22100%22><rect fill=%22%23ddd%22 width=%22200%22 height=%22100%22/><text fill=%22%23666%22 x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22-3%22 font-size=%2212%22>Imagem não carregou</text></svg>'; this.classList.add('grayscale');" class="w-full h-auto rounded-lg border border-black/10" style="max-height:200px;object-fit:contain;display:block;" loading="lazy draggable="false""/>
          </div>
          <p class="text-[10px] text-gray-500 mt-1.5 text-center">${node.data?.caption || 'Imagem'}</p>
        </div>
      `;
    } else if (isNote) {
      el.innerHTML = `
        ${handles}
        ${deleteBtn}
        <div class="p-3.5 cursor-grab active:cursor-grabbing">
          <div class="flex-1 min-w-0">
            <h3 class="font-bold text-[13px] leading-tight mb-0.5">Anotação</h3>
            <p class="text-[10px] opacity-60 line-clamp-3">${node.data?.text || node.notes || ''}</p>
            ${node.data?.richText ? `<div class="mt-2 text-xs text-gray-600 border-t border-dashed pt-2">${node.data.richText}</div>` : ''}
          </div>
        </div>
      `;
    } else {
      el.innerHTML = `
        ${handles}
        ${deleteBtn}
        <div class="p-3.5 cursor-grab active:cursor-grabbing">
          <div class="flex-1 min-w-0">
            <h3 class="font-bold text-[13px] leading-tight mb-0.5">${node.concept?.title || 'Concept'}</h3>
            <p class="text-[10px] font-bold uppercase tracking-wider opacity-60 truncate">${node.concept?.category || ''}${node.concept?.subcategory ? ' • ' + node.concept.subcategory : ''}</p>
          </div>
        </div>
      `;
    }

    // Node mousedown - Melhorado para conexão e drag
    el.addEventListener('mousedown', (e) => {
      const target = e.target;
      const handleEl = target?.classList?.contains('pa-handle') ? target : target?.closest?.('.pa-handle');
      const deleteBtn = target?.closest('[data-delete-node]');

      if (deleteBtn) {
        e.stopPropagation();
        return;
      }

      if (handleEl) {
        // Conexão iniciada
        isConnecting = true;
        connectionSourceNode = handleEl.getAttribute('data-node-id');
        connectionSourceHandle = handleEl.getAttribute('data-handle-id');

        // Criar linha temporária de conexão
        tempEdgePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        tempEdgePath.setAttribute('stroke', '#3b82f6');
        tempEdgePath.setAttribute('stroke-width', '3');
        tempEdgePath.setAttribute('fill', 'none');
        tempEdgePath.setAttribute('stroke-dasharray', '5,5');
        tempEdgePath.setAttribute('opacity', '0.8');
        edgesLayer.appendChild(tempEdgePath);

        // Mostrar indicador de conexão
        const connStatus = document.getElementById('pa-connection-status');
        if (connStatus) {
          connStatus.classList.remove('hidden');
          connStatus.innerHTML = '<i data-lucide="link" class="w-3 h-3 inline mr-1"></i>Conectando...';
          if (window.lucide) window.lucide.createIcons();
        }

        // Timeout para esconder mensagem após 3 segundos
        if (connectionTimeoutId) clearTimeout(connectionTimeoutId);
        connectionTimeoutId = setTimeout(() => {
          const connStatus2 = document.getElementById('pa-connection-status');
          if (connStatus2) connStatus2.classList.add('hidden');
          isConnecting = false;
          connectionSourceNode = null;
          connectionSourceHandle = null;
          if (tempEdgePath) {
            tempEdgePath.remove();
            tempEdgePath = null;
          }
        }, 3000);

        e.preventDefault();
        e.stopPropagation();
        return;
      }

      // Iniciar drag do node (inclusive imagens)
      isDraggingNode = true;
      hasDragged = false;
      draggedNodeId = node.id;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      nodeStartX = node.x;
      nodeStartY = node.y;

      // Trazer node para frente
      const idx = state.nodes.findIndex(n => n.id === node.id);
      if (idx > -1) {
        state.nodes.push(state.nodes.splice(idx, 1)[0]);
        nodesLayer.appendChild(el);
      }

      e.stopPropagation();
    });

    // Click → sidebar editor (abre para digitar textos)
    el.addEventListener('click', (e) => {
      // Ignora click em handles e delete button
      if (e.target.classList.contains('pa-handle') || e.target.closest('[data-delete-node]')) {
        return;
      }
      // Se não foi drag, abre o editor
      if (!hasDragged) {
        openNodeEditor(node.id);
      }
      // Reset hasDragged for next interaction
      hasDragged = false;
    });

    nodesLayer.appendChild(el);
  });

  // Delete button handler
  nodesLayer.querySelectorAll('[data-delete-node]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const nodeId = btn.getAttribute('data-delete-node');
      if (confirm('Excluir este card do canvas?')) {
        state.nodes = state.nodes.filter(n => n.id !== nodeId);
        state.edges = state.edges.filter(ed => ed.source_id !== nodeId && ed.target_id !== nodeId);
        renderNodes();
        state.isDirty = true;
      }
    });
  });

  if (window.lucide) window.lucide.createIcons();
  renderEdges();
}

// ═════════════════════════════════════════════════════════════════════════════
//  EDGES — Bezier
// ═════════════════════════════════════════════════════════════════════════════

function getHandlePosition(nodeId, handleId) {
  const node = state.nodes.find(n => n.id === nodeId);
  const el = document.getElementById(`pa-node-${nodeId}`);
  if (!node || !el) return null;
  const w = parseFloat(el.style.width) || 220;
  const h = el.offsetHeight || 80;
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

  state.edges.forEach(edge => {
    const srcPos = getHandlePosition(edge.source_id, edge.source_handle);
    const tgtPos = getHandlePosition(edge.target_id, edge.target_handle);
    if (!srcPos || !tgtPos) return;

    const d = getBezierPath(srcPos.x, srcPos.y, tgtPos.x, tgtPos.y, edge.source_handle, edge.target_handle);

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
    hitPath.addEventListener('dblclick', () => {
      state.edges = state.edges.filter(ed => ed.id !== edge.id);
      renderEdges();
      state.isDirty = true;
    });

    edgesLayer.appendChild(path);
    edgesLayer.appendChild(hitPath);
  });
}

// ═════════════════════════════════════════════════════════════════════════════
//  NODE EDITOR — Inline Sidebar Panel
// ═════════════════════════════════════════════════════════════════════════════

function openNodeEditor(nodeId) {
  console.log('[PA-DEBUG] openNodeEditor called:', { nodeId, sidebarEl: !!sidebarEl, currentView: state.sidebarView });
  const node = state.nodes.find(n => n.id === nodeId);
  if (!node) { console.log('[PA-DEBUG] Node not found!'); return; }

  // Remove highlight from previous node
  if (state.editingNodeId) {
    const prevEl = document.getElementById(`pa-node-${state.editingNodeId}`);
    if (prevEl) {
      prevEl.classList.remove('ring-2', 'ring-blue-500', 'shadow-lg');
    }
  }

  state.sidebarView = 'editor';
  state.editingNodeId = nodeId;

  // Open sidebar if collapsed
  if (state.sidebarCollapsed) {
    state.sidebarCollapsed = false;
    sidebarEl.classList.remove('hidden', 'w-0');
    sidebarEl.classList.add('w-80');
    const label = document.getElementById('pa-sidebar-label');
    if (label) label.textContent = 'Ocultar';
  }

  // On mobile, open the sidebar
  if (window.innerWidth < 768) {
    sidebarEl?.classList.remove('max-md:translate-x-full');
    sidebarEl?.classList.add('max-md:translate-x-0');
    overlayEl?.classList.remove('hidden');
  }

  // Highlight the selected node
  const el = document.getElementById(`pa-node-${nodeId}`);
  if (el) {
    el.classList.add('ring-2', 'ring-blue-500', 'shadow-lg');
  }

  console.log('[PA-DEBUG] Calling renderSidebarContent, sidebarView:', state.sidebarView, 'editingNodeId:', state.editingNodeId);
  renderSidebarContent(sidebarEl);
}

function closeNodeEditor() {
  // Remove highlight
  if (state.editingNodeId) {
    const prevEl = document.getElementById(`pa-node-${state.editingNodeId}`);
    if (prevEl) {
      prevEl.classList.remove('ring-2', 'ring-blue-500', 'shadow-lg');
    }
  }

  state.sidebarView = 'repository';
  state.editingNodeId = null;
  renderSidebarContent(sidebarEl);
}

function renderNodeEditorPanel(sidebar) {
  const node = state.nodes.find(n => n.id === state.editingNodeId);
  if (!node) { closeNodeEditor(); return; }

  const isImage = node.type === 'image';
  const isNote = node.type === 'note';
  const isEvo = node.concept?.mode === 'evolucao';

  let iconName, iconColor, typeBadge;
  if (isImage) {
    iconName = 'image'; iconColor = 'text-purple-600'; typeBadge = 'Imagem';
  } else if (isNote) {
    iconName = 'sticky-note'; iconColor = 'text-amber-600'; typeBadge = 'Anotação';
  } else {
    iconName = isEvo ? 'book-open' : 'activity';
    iconColor = isEvo ? 'text-blue-600' : 'text-emerald-600';
    typeBadge = isEvo ? 'Evolução' : 'Operação';
  }

  let html = `
    <div class="p-4 border-b border-gray-200 bg-gray-50/50 shrink-0">
      <button id="pa-editor-back" class="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-800 transition-colors mb-3 group">
        <i data-lucide="arrow-left" class="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform"></i> Voltar ao Repositório
      </button>
      <div class="flex items-start gap-2.5">
        <div class="p-2 bg-white rounded-xl shadow-sm shrink-0 border border-gray-100">
          <i data-lucide="${iconName}" class="w-5 h-5 ${iconColor}"></i>
        </div>
        <div class="flex-1 min-w-0">
          <h2 class="text-base font-bold text-gray-900 leading-tight">${node.concept?.title || typeBadge}</h2>
          <p class="text-[10px] font-bold uppercase tracking-wider text-gray-400 mt-0.5">${node.concept?.category || typeBadge}${node.concept?.subcategory ? ' • ' + node.concept.subcategory : ''}</p>
        </div>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto p-4 space-y-5">
  `;

  // Read-only concept info section
  if (node.concept && !isImage && !isNote) {
    html += `
      <div class="space-y-2">
        <label class="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
          <i data-lucide="info" class="w-3.5 h-3.5"></i> Informações do Conceito
        </label>
        <div class="bg-gray-50 border border-gray-100 rounded-xl p-3 space-y-2 text-xs text-gray-700">
          ${node.concept.notes ? `<div class="flex gap-2"><span class="font-semibold text-gray-500 shrink-0">Notas:</span><span>${node.concept.notes}</span></div>` : ''}
          ${node.concept.prerequisite ? `<div class="flex gap-2"><span class="font-semibold text-gray-500 shrink-0">Pré-req:</span><span class="px-1.5 py-0.5 bg-gray-200 text-gray-600 rounded text-[10px] font-medium">${node.concept.prerequisite}</span></div>` : ''}
        </div>
      </div>
    `;
  }


  // Rich text editor para boxes de anotação
  if (isNote) {
    html += `
      <div class="space-y-2">
        <label class="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
          <i data-lucide="file-text" class="w-3.5 h-3.5 text-amber-500"></i> Conteúdo do Box
        </label>
        <textarea id="pa-editor-text-content" class="w-full h-48 p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none transition-all text-sm bg-white font-mono" placeholder="Digite seu texto aqui...">${node.data?.text || ''}</textarea>
        <div class="flex gap-2 text-[10px] text-gray-400">
          <span class="px-2 py-1 bg-gray-100 rounded">Use \\n para quebra de linha</span>
        </div>
      </div>
    `;
  }

  // Image URL input (only for non-image nodes)
  if (!isImage) {
    html += `
      <div class="space-y-2">
        <label class="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
          <i data-lucide="image" class="w-3.5 h-3.5 text-green-500"></i> URL da Imagem de Exemplo
        </label>
        <input id="pa-editor-image-url" type="text" class="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all text-sm bg-white" placeholder="https://exemplo.com/imagem.png" value="${node.imageUrl || ''}" />
        <div id="pa-editor-image-preview" class="mt-2 rounded-xl overflow-hidden border border-gray-200 bg-gray-50 aspect-video flex items-center justify-center ${node.imageUrl ? '' : 'hidden'}">
          <img src="${node.imageUrl || ''}" alt="Exemplo" class="max-w-full max-h-full object-contain" onerror="this.style.display='none'" />
        </div>
      </div>
    `;
  } else {
    // For image nodes: show the image and caption
    html += `
      <div class="space-y-2">
        <label class="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
          <i data-lucide="image" class="w-3.5 h-3.5 text-purple-500"></i> Imagem
        </label>
        ${node.imageUrl ? `<div class="rounded-xl overflow-hidden border border-gray-200 bg-white"><img src="${node.imageUrl}" alt="" class="w-full h-auto" style="max-height:240px;object-fit:contain" /></div>` : '<p class="text-xs text-gray-400">Nenhuma imagem</p>'}
        <input id="pa-editor-caption" type="text" class="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all text-sm bg-white" placeholder="Legenda da imagem" value="${node.data?.caption || ''}" />
      </div>
    `;
  }

  html += `</div>`;

  // Action buttons (sticky footer)
  html += `
    <div class="p-4 border-t border-gray-200 bg-gray-50/50 shrink-0 space-y-2">
      <button id="pa-editor-save" class="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors shadow-sm">
        <i data-lucide="save" class="w-4 h-4"></i> Salvar Alterações
      </button>
      <button id="pa-editor-delete" class="w-full flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium text-red-600 bg-white border border-red-200 rounded-xl hover:bg-red-50 transition-colors">
        <i data-lucide="trash-2" class="w-3.5 h-3.5"></i> Excluir Nó
      </button>
    </div>
  `;

  sidebar.innerHTML = html;
  if (window.lucide) window.lucide.createIcons();

  // --- Event Listeners ---

  // Back button
  document.getElementById('pa-editor-back')?.addEventListener('click', closeNodeEditor);

  // Image URL preview (non-image nodes)
  const imgInput = document.getElementById('pa-editor-image-url');
  const imgPreview = document.getElementById('pa-editor-image-preview');
  const imgEl = imgPreview?.querySelector('img');
  imgInput?.addEventListener('input', (e) => {
    const v = e.target.value;
    if (v && imgPreview && imgEl) { imgPreview.classList.remove('hidden'); imgEl.src = v; imgEl.style.display = 'block'; }
    else if (imgPreview) imgPreview.classList.add('hidden');
  });

  // Save button
  document.getElementById('pa-editor-save')?.addEventListener('click', () => {
    if (isNote) {
      // Box de texto - salvar conteúdo
      const textContent = document.getElementById('pa-editor-text-content')?.value || '';
      node.data = {
        ...node.data,
        text: textContent
      };
      node.notes = textContent;
    } else if (isImage) {
      const caption = document.getElementById('pa-editor-caption')?.value || '';
      node.data = { ...node.data, caption };
    } else {
      node.imageUrl = document.getElementById('pa-editor-image-url')?.value || '';
      node.data = { ...node.data, imageUrl: node.imageUrl };
    }

    updateCanvasNode(node.id, { data: node.data });
    renderNodes();

    // Re-highlight the node after re-render
    const el = document.getElementById(`pa-node-${node.id}`);
    if (el) el.classList.add('ring-2', 'ring-blue-500', 'shadow-lg');

    showToast('Alterações salvas!', 'success');
    state.isDirty = true;
  });

  // Delete button
  document.getElementById('pa-editor-delete')?.addEventListener('click', () => {
    if (confirm('Excluir este conceito do canvas?')) {
      state.nodes = state.nodes.filter(n => n.id !== node.id);
      state.edges = state.edges.filter(ed => ed.source_id !== node.id && ed.target_id !== node.id);
      renderNodes();
      closeNodeEditor();
      state.isDirty = true;
    }
  });
}

// ═════════════════════════════════════════════════════════════════════════════
//  SIDEBAR — Repositório de Conceitos (SIDEBAR DIREITA)
// ═════════════════════════════════════════════════════════════════════════════

function initSidebar() {
  if (!sidebarEl) return;
  renderSidebarContent(sidebarEl);

  sidebarEl.addEventListener('click', (e) => {
    const modeBtn = e.target.closest('[data-pa-mode]');
    if (modeBtn) { state.currentMode = modeBtn.getAttribute('data-pa-mode'); renderSidebarContent(sidebarEl); }
    const catBtn = e.target.closest('[data-pa-category]');
    if (catBtn) { const cat = catBtn.getAttribute('data-pa-category'); state.expandedCategories[cat] = !state.expandedCategories[cat]; renderSidebarContent(sidebarEl); }
  });

  sidebarEl.addEventListener('input', (e) => {
    if (e.target.id === 'pa-search-input') {
      state.searchQuery = e.target.value;
      if (state.searchQuery) {
        const groups = getGroupedConcepts();
        Object.keys(groups).forEach(c => state.expandedCategories[c] = true);
      }
      renderSidebarContent(sidebarEl);
    }
  });

  sidebarEl.addEventListener('dragstart', (e) => {
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
    if (c.mode !== state.currentMode) return false;
    if (!state.searchQuery) return true;
    const q = state.searchQuery.toLowerCase();
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
  console.log('[PA-DEBUG] renderSidebarContent:', { sidebarView: state.sidebarView, editingNodeId: state.editingNodeId, sidebarExists: !!sidebar });
  // If we're in editor mode, render the node editor panel instead
  if (state.sidebarView === 'editor' && state.editingNodeId) {
    console.log('[PA-DEBUG] Rendering editor panel!');
    renderNodeEditorPanel(sidebar);
    return;
  }

  const wasFocused = document.activeElement?.id === 'pa-search-input';
  const groups = getGroupedConcepts();
  const hasConcepts = Object.keys(groups).length > 0;

  Object.keys(groups).forEach(cat => { if (state.expandedCategories[cat] === undefined) state.expandedCategories[cat] = true; });

  const evoActive = state.currentMode === 'evolucao';

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
        <input id="pa-search-input" type="text" placeholder="Buscar conceitos..." value="${state.searchQuery}" class="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" />
      </div>
    </div>
    <div class="flex-1 overflow-y-auto p-3 space-y-1">
  `;

  if (!hasConcepts) {
    html += `<div class="text-center py-8 text-gray-500 text-xs">Nenhum conceito encontrado.</div>`;
  } else {
    Object.entries(groups).forEach(([category, subcategories]) => {
      const isExp = state.expandedCategories[category];
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
            const bgCls = state.currentMode === 'evolucao' ? 'bg-blue-50/50 border-blue-100 hover:bg-blue-50 hover:border-blue-200' : 'bg-emerald-50/50 border-emerald-100 hover:bg-emerald-50 hover:border-emerald-200';
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
    overlayEl?.classList.add('hidden');
  });
}
