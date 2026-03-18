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
  selectedNodeIds: [],
  sidebarCollapsed: false,
  sidebarPosition: 'right',
  currentMode: 'evolucao', // 'evolucao' | 'operacao'
  searchQuery: '',
  expandedCategories: {},
  maps: [],
  isDirty: false,
  sidebarTab: 'repository', // 'repository' | 'history'
  editingNodeId: null,
  uiHidden: false, // UI principal escondida (fullscreen canvas)
  traderView: 'conceitos', // 'conceitos' | 'timeline' | 'operacional'
  timelineFilter: 'Todos',
  viewMode: 'canvas' // 'canvas' | 'timeline'
};

// Interaction state
let isDraggingNode = false, hasDragged = false, draggedNodeId = null;
let dragStartX = 0, dragStartY = 0, dragInitialPositions = {};
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

function showModal({ title, message, type = 'confirm', confirmText = 'Confirmar', cancelText = 'Cancelar', onConfirm, onCancel, placeholder = '' }) {
  const existing = document.getElementById('pa-custom-modal');
  if (existing) existing.remove();
  const modal = document.createElement('div');
  modal.id = 'pa-custom-modal';
  modal.className = 'fixed inset-0 bg-black/40 backdrop-blur-sm z-[200] flex items-center justify-center p-4 transition-opacity duration-200';
  
  let inputHtml = type === 'prompt' ? `<input type="text" id="pa-modal-input" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 mb-4" placeholder="${placeholder}" value="${placeholder}" />` : '';
  
  modal.innerHTML = `
    <div class="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden transform scale-95 transition-transform duration-200">
      <div class="p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
        <h3 class="font-bold text-gray-900">${title}</h3>
        <button id="pa-modal-close" class="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg>
        </button>
      </div>
      <div class="p-5">
        <p class="text-sm text-gray-600 mb-4">${message}</p>
        ${inputHtml}
        <div class="flex gap-2 justify-end">
          <button id="pa-modal-btn-cancel" class="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">${cancelText}</button>
          <button id="pa-modal-btn-confirm" class="px-4 py-2 text-sm font-medium text-white ${type === 'confirm' && title.includes('Excluir') ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'} rounded-xl transition-colors">${confirmText}</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  
  requestAnimationFrame(() => {
    modal.querySelector('.scale-95')?.classList.remove('scale-95');
  });

  const close = () => {
    modal.classList.add('opacity-0');
    setTimeout(() => modal.remove(), 200);
    if (onCancel) onCancel();
  };

  const confirm = () => {
    let val = true;
    if (type === 'prompt') val = document.getElementById('pa-modal-input').value;
    modal.classList.add('opacity-0');
    setTimeout(() => modal.remove(), 200);
    if (onConfirm) onConfirm(val);
  };

  document.getElementById('pa-modal-close').addEventListener('click', close);
  document.getElementById('pa-modal-btn-cancel').addEventListener('click', close);
  document.getElementById('pa-modal-btn-confirm').addEventListener('click', confirm);
  
  if (type === 'prompt') {
    const input = document.getElementById('pa-modal-input');
    input.focus();
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') confirm();
      if (e.key === 'Escape') close();
    });
  }
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
          <!-- UI Hide Toggle (Fullscreen) -->
          <button id="pa-btn-ui-hide" class="flex items-center gap-2 px-3.5 py-2 bg-white border border-gray-200 rounded-xl shadow-sm hover:bg-gray-50 text-xs font-semibold text-gray-700 transition-colors pointer-events-auto" title="Esconder UI - Fallback: tecla F">
            <i data-lucide="eye-off" class="w-3.5 h-3.5"></i> UI
          </button>

          <!-- Current Map Label -->
          <div class="flex items-center px-3 py-2 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-xl shadow-sm pointer-events-auto max-w-[200px]">
            <svg class="w-3.5 h-3.5 text-gray-500 mr-2 shrink-0" data-lucide="map"></svg>
            <span id="pa-current-map-label" class="text-xs font-semibold text-gray-700 truncate">Sem título</span>
          </div>

          <!-- Timeline Filter Dropdown -->
          <div class="flex items-center bg-white/90 backdrop-blur-sm border border-gray-200 rounded-xl shadow-sm pointer-events-auto overflow-hidden">
             <div class="pl-2 pr-1.5 py-2 border-r border-gray-100 flex items-center bg-gray-50">
               <svg class="w-3.5 h-3.5 text-blue-500 ml-1 mr-1.5" data-lucide="clock"></svg>
               <span class="text-xs font-bold text-gray-600 pr-1">Filtro:</span>
             </div>
             <select id="pa-timeline-filter" class="bg-transparent text-xs font-semibold text-gray-700 px-2 py-1.5 outline-none cursor-pointer">
                <option value="Todos">Todas as Etapas</option>
                <option value="Antes">Antes</option>
                <option value="Durante">Durante</option>
                <option value="Depois">Depois</option>
                <option value="Análise">Análise</option>
                <option value="Em Operação">Em Operação</option>
                <option value="Pós-Operação">Pós-Operação</option>
             </select>
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
          <!-- View Mode Toggle -->
          <button id="pa-btn-view-toggle" class="flex items-center gap-2 px-3.5 py-2 bg-indigo-600 border border-indigo-700 rounded-xl shadow-sm hover:bg-indigo-700 text-xs font-semibold text-white transition-colors pointer-events-auto" title="Alternar entre Canvas e Timeline (G)">
            <i data-lucide="gantt-chart" class="w-3.5 h-3.5"></i> <span id="pa-view-toggle-label">Timeline</span>
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

        <!-- Timeline View Panel (hidden by default) -->
        <div id="pa-timeline-view" class="absolute inset-0 overflow-auto bg-gray-50 opacity-0 pointer-events-none transition-opacity duration-300" style="z-index:10;"></div>

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
  // Close open editor if any
  document.getElementById('pa-editor-modal')?.remove();

  // Reset interaction state
  state.selectedNodeIds = [];
  state.editingNodeId = null;
  state.currentMapId = mapId;

  const [nodes, edges] = await Promise.all([getCanvasNodes(mapId), getCanvasEdges(mapId)]);

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

  // Restore saved viewport
  const map = state.maps.find(m => m.id === mapId);
  if (map) {
    state.scale = map.viewport_scale ?? 1;
    state.panX = map.viewport_x ?? 0;
    state.panY = map.viewport_y ?? 0;
    const label = document.getElementById('pa-current-map-label');
    if (label) label.textContent = map.title.substring(0, 15) + (map.title.length > 15 ? '...' : '');
  }

  state.isDirty = false;
  updateDirtyIndicator();
  updateTransform();
  renderNodes();
  renderEdges();
}

// ── AUTO-SAVE DEBOUNCE ─────────────────────────────────────────────────────
let autoSaveTimeout = null;

function scheduleAutoSave() {
  if (autoSaveTimeout) clearTimeout(autoSaveTimeout);
  autoSaveTimeout = setTimeout(() => saveCurrentMap(true), 2500);
  updateDirtyIndicator();
}

function updateDirtyIndicator() {
  const label = document.getElementById('pa-current-map-label');
  if (!label) return;
  const dot = document.getElementById('pa-dirty-dot');
  if (state.isDirty) {
    if (!dot) {
      const d = document.createElement('span');
      d.id = 'pa-dirty-dot';
      d.title = 'Alterações não salvas';
      d.style.cssText = 'display:inline-block;width:6px;height:6px;border-radius:50%;background:#f59e0b;margin-left:5px;vertical-align:middle;animation:pulse 1.5s infinite;';
      label.parentNode.insertBefore(d, label.nextSibling);
    }
  } else {
    dot?.remove();
  }
}

// ── TEXTAREA AUTO-RESIZE ────────────────────────────────────────────────────
function autoResizeTextarea(el) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 400) + 'px';
}

async function saveCurrentMap(silent = false) {
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
  updateDirtyIndicator();
  if (!silent) showToast('Canvas salvo no banco!');
}

function renderMapsDropdown() {
  if (sidebarEl) renderSidebarContent(sidebarEl);
}

function handleMapAction(action, mapId) {
  const map = state.maps.find(m => m.id === mapId);
  if (!map) return;

  switch (action) {
    case 'rename':
      showModal({
        title: 'Renomear Mapa',
        message: 'Novo nome do mapa:',
        type: 'prompt',
        placeholder: map.title,
        onConfirm: (newTitle) => {
          if (newTitle && newTitle.trim()) {
            updateCanvasMap(mapId, { title: newTitle });
            map.title = newTitle;
            renderMapsDropdown();
            showToast('Mapa renomeado!', 'success');
          }
        }
      });
      break;

    case 'duplicate':
      duplicateMap(map);
      break;

    case 'delete':
      showModal({
        title: 'Excluir Mapa',
        message: `Excluir "${map.title}" permanentemente?`,
        onConfirm: () => {
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
      });
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
    if (state.isDirty) {
      showModal({
        title: 'Alterações não salvas',
        message: 'Perder alterações não salvas?',
        onConfirm: () => createNewMap()
      });
    } else {
      createNewMap();
    }
  });

  document.getElementById('pa-btn-clear')?.addEventListener('click', () => {
    if (!state.currentMapId) return;
    showModal({
      title: 'Limpar Canvas',
      message: 'Limpar todos os nodes e edges deste mapa?',
      onConfirm: () => {
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

  // View Toggle - Canvas / Timeline
  document.getElementById('pa-btn-view-toggle')?.addEventListener('click', toggleViewMode);

  // Timeline Filter Change
  const timelineFilterEl = document.getElementById('pa-timeline-filter');
  if (timelineFilterEl) {
    timelineFilterEl.addEventListener('change', (e) => {
      state.timelineFilter = e.target.value;
      renderNodes(); // Re-render to apply opacity/filter
      showToast(`Filtro atualizado: ${state.timelineFilter}`, 'info');
    });
  }

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
    if (e.key === 'g' || e.key === 'G') {
      toggleViewMode();
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      // Deleta nodes selecionados
      if (state.selectedNodeIds?.length > 0) {
        showModal({
          title: 'Excluir Cards',
          message: `Excluir os ${state.selectedNodeIds.length} cards selecionados?`,
          onConfirm: () => {
            state.nodes = state.nodes.filter(n => !state.selectedNodeIds.includes(n.id));
            state.edges = state.edges.filter(ed => !state.selectedNodeIds.includes(ed.source_id) && !state.selectedNodeIds.includes(ed.target_id));
            state.selectedNodeIds = [];
            renderNodes();
            closeNodeEditor();
            state.isDirty = true;
          }
        });
      } else if (state.editingNodeId) {
        const node = state.nodes.find(n => n.id === state.editingNodeId);
        if (node) {
          showModal({
            title: 'Excluir Card',
            message: 'Excluir este card?',
            onConfirm: () => {
              state.nodes = state.nodes.filter(n => n.id !== node.id);
              state.edges = state.edges.filter(ed => ed.source_id !== node.id && ed.target_id !== node.id);
              renderNodes();
              closeNodeEditor();
              state.isDirty = true;
            }
          });
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

// ═════════════════════════════════════════════════════════════════════════════
//  VIEW MODE TOGGLE — Canvas ↔ Timeline
// ═════════════════════════════════════════════════════════════════════════════

function toggleViewMode() {
  state.viewMode = state.viewMode === 'canvas' ? 'timeline' : 'canvas';

  const timelinePanel = document.getElementById('pa-timeline-view');
  const transformLayer = document.getElementById('pa-canvas-transform');
  const bgDot = document.getElementById('pa-canvas-bg');
  const label = document.getElementById('pa-view-toggle-label');
  const btn = document.getElementById('pa-btn-view-toggle');
  const textBtn = document.getElementById('pa-btn-text');

  if (state.viewMode === 'timeline') {
    // Fade out canvas
    transformLayer.style.transition = 'opacity 200ms ease';
    transformLayer.style.opacity = '0';
    transformLayer.style.pointerEvents = 'none';
    bgDot.style.opacity = '0';
    if (textBtn) textBtn.style.display = 'none';

    // Render and fade in timeline
    renderTimelineView();
    timelinePanel.style.opacity = '0';
    timelinePanel.style.pointerEvents = 'auto';
    requestAnimationFrame(() => {
      timelinePanel.style.opacity = '1';
    });

    // Update button
    if (label) label.textContent = 'Canvas';
    if (btn) {
      btn.classList.remove('bg-indigo-600', 'border-indigo-700', 'hover:bg-indigo-700', 'text-white');
      btn.classList.add('bg-white', 'border-gray-200', 'hover:bg-gray-50', 'text-gray-700');
      btn.querySelector('[data-lucide]')?.setAttribute('data-lucide', 'layout');
      if (window.lucide) window.lucide.createIcons();
    }
    showToast('Visão Timeline ativada', 'info');
  } else {
    // Fade out timeline
    timelinePanel.style.opacity = '0';
    timelinePanel.style.pointerEvents = 'none';
    if (textBtn) textBtn.style.display = '';

    // Fade in canvas
    requestAnimationFrame(() => {
      transformLayer.style.opacity = '1';
      transformLayer.style.pointerEvents = '';
      bgDot.style.opacity = '1';
    });

    // Update button
    if (label) label.textContent = 'Timeline';
    if (btn) {
      btn.classList.add('bg-indigo-600', 'border-indigo-700', 'hover:bg-indigo-700', 'text-white');
      btn.classList.remove('bg-white', 'border-gray-200', 'hover:bg-gray-50', 'text-gray-700');
      btn.querySelector('[data-lucide]')?.setAttribute('data-lucide', 'gantt-chart');
      if (window.lucide) window.lucide.createIcons();
    }
    showToast('Visão Canvas ativada', 'info');
  }
}

function renderTimelineView() {
  const panel = document.getElementById('pa-timeline-view');
  if (!panel) return;

  // Lanes config
  const lanes = [
    { id: 'Antes',        label: 'Antes',        icon: '◷', color: 'bg-blue-600',   light: 'bg-blue-50',   border: 'border-blue-200',   text: 'text-blue-700',   badge: 'bg-blue-100 text-blue-800' },
    { id: 'Durante',      label: 'Durante',       icon: '⚡', color: 'bg-amber-500',  light: 'bg-amber-50',  border: 'border-amber-200',  text: 'text-amber-700',  badge: 'bg-amber-100 text-amber-800' },
    { id: 'Depois',       label: 'Depois',        icon: '✓', color: 'bg-emerald-600',light: 'bg-emerald-50',border: 'border-emerald-200',text: 'text-emerald-700',badge: 'bg-emerald-100 text-emerald-800' },
    { id: 'Análise',      label: 'Análise',       icon: '🔍', color: 'bg-purple-600', light: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', badge: 'bg-purple-100 text-purple-800' },
    { id: 'Em Operação',  label: 'Em Operação',   icon: '▶', color: 'bg-rose-600',   light: 'bg-rose-50',   border: 'border-rose-200',   text: 'text-rose-700',   badge: 'bg-rose-100 text-rose-800' },
    { id: 'Pós-Operação', label: 'Pós-Operação',  icon: '📋', color: 'bg-teal-600',   light: 'bg-teal-50',   border: 'border-teal-200',   text: 'text-teal-700',   badge: 'bg-teal-100 text-teal-800' },
    { id: 'Nenhum',        label: 'Sem Etapa',    icon: '—', color: 'bg-gray-500',   light: 'bg-gray-50',   border: 'border-gray-200',   text: 'text-gray-600',   badge: 'bg-gray-100 text-gray-600' },
  ];

  // Group nodes by stage
  const grouped = {};
  lanes.forEach(l => { grouped[l.id] = []; });
  // Nodes with stage not in lanes go to Nenhum
  state.nodes.forEach(node => {
    const stage = node.data?.timelineStage || 'Nenhum';
    if (grouped[stage] !== undefined) {
      grouped[stage].push(node);
    } else {
      grouped['Nenhum'].push(node);
    }
  });

  // Remove empty lanes except Nenhum if nodes exist
  const visibleLanes = lanes.filter(l => grouped[l.id]?.length > 0 || l.id === 'Nenhum');

  // Gantt progress bar percentages (visual only)
  const progressMap = { 'Antes': 20, 'Durante': 55, 'Depois': 90, 'Análise': 30, 'Em Operação': 60, 'Pós-Operação': 95, 'Nenhum': 0 };

  let html = `
    <div class="min-h-full p-6 pb-12" style="padding-top: 60px;">
      <div class="max-w-full mx-auto">
        <div class="flex items-center gap-3 mb-6">
          <div class="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/></svg>
          </div>
          <div>
            <h2 class="text-base font-bold text-gray-900">Visão Timeline</h2>
            <p class="text-xs text-gray-500">${state.nodes.length} cards organizados por etapa de operação</p>
          </div>
          <div class="ml-auto flex items-center gap-2 text-[11px] text-gray-400">
            <kbd class="px-2 py-0.5 bg-white border border-gray-200 rounded font-mono shadow-sm">G</kbd>
            <span>para voltar ao Canvas</span>
          </div>
        </div>
  `;

  if (state.nodes.length === 0) {
    html += `
      <div class="flex flex-col items-center justify-center py-20 text-gray-400">
        <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="mb-3 opacity-40"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        <p class="text-sm font-medium">Nenhum card no canvas ainda</p>
        <p class="text-xs mt-1">Adicione cards pelo Canvas e defina suas etapas</p>
      </div>`;
  } else {
    visibleLanes.forEach(lane => {
      const nodes = grouped[lane.id] || [];
      const pct = progressMap[lane.id] || 0;
      const isEmpty = nodes.length === 0;

      html += `
        <div class="mb-5 rounded-2xl border ${lane.border} overflow-hidden shadow-sm bg-white">
          <!-- Lane Header -->
          <div class="flex items-center gap-3 px-4 py-3 ${lane.light} border-b ${lane.border}">
            <div class="w-7 h-7 rounded-lg ${lane.color} flex items-center justify-center text-white text-sm font-bold shadow-sm">${lane.icon}</div>
            <div class="flex-1">
              <div class="flex items-center gap-2 mb-1">
                <span class="text-sm font-bold ${lane.text}">${lane.label}</span>
                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${lane.badge}">${nodes.length} card${nodes.length !== 1 ? 's' : ''}</span>
              </div>
              ${pct > 0 ? `
              <div class="flex items-center gap-2">
                <div class="flex-1 h-1.5 bg-white/60 rounded-full overflow-hidden">
                  <div class="h-full ${lane.color} rounded-full transition-all duration-700" style="width:${pct}%"></div>
                </div>
                <span class="text-[10px] ${lane.text} font-medium opacity-70">${pct}%</span>
              </div>` : ''}
            </div>
          </div>

          <!-- Lane Cards Grid -->
          <div class="p-4 ${isEmpty ? 'flex items-center justify-center py-8' : 'grid gap-3'}" style="${!isEmpty ? 'grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));' : ''}">
      `;

      if (isEmpty) {
        html += `<p class="text-xs text-gray-400 italic">Nenhum card com esta etapa definida</p>`;
      } else {
        nodes.forEach(node => {
          const isImage = node.type === 'image';
          const isNote = node.type === 'note';
          const title = node.concept?.title || node.data?.title || (isNote ? 'Anotação' : 'Imagem');
          const subtitle = node.concept?.category
            ? `${node.concept.category}${node.concept.subcategory ? ' · ' + node.concept.subcategory : ''}`
            : (isNote ? (node.data?.text || '').slice(0, 60) : (node.data?.caption || ''));

          // Tags
          const tags = node.data?.tags || [];
          const tagsHtml = tags.length > 0
            ? `<div class="mt-2 flex flex-wrap gap-1">${tags.slice(0, 3).map(t => `<span class="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-[9px] font-bold uppercase">${t}</span>`).join('')}${tags.length > 3 ? `<span class="px-1.5 py-0.5 bg-gray-100 text-gray-400 rounded text-[9px]">+${tags.length - 3}</span>` : ''}</div>`
            : '';

          // Card type indicator strip
          const typeStrip = isImage ? lane.color.replace('bg-', 'bg-purple-') : isNote ? 'bg-amber-500' : lane.color;

          html += `
            <div
              class="pa-timeline-card group relative flex flex-col border ${lane.border} rounded-xl bg-white shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer overflow-hidden"
              data-node-id="${node.id}"
              style="min-height: 80px;"
            >
              <!-- Colored top strip -->
              <div class="h-1 w-full ${typeStrip} flex-shrink-0"></div>
              <div class="p-3 flex-1">
                <h4 class="font-semibold text-[13px] text-gray-900 leading-tight mb-0.5 group-hover:${lane.text} transition-colors">${title}</h4>
                ${subtitle ? `<p class="text-[10px] text-gray-500 leading-snug line-clamp-2">${subtitle}</p>` : ''}
                ${isImage && node.imageUrl ? `<img src="${node.imageUrl}" alt="" class="mt-2 w-full h-16 object-cover rounded-lg border border-gray-100" />` : ''}
                ${node.data?.freeText ? `<p class="text-[10px] text-gray-500 mt-1 line-clamp-2 border-t border-dashed border-gray-100 pt-1">${node.data.freeText}</p>` : ''}
                ${tagsHtml}
              </div>
              <!-- Edit hint -->
              <div class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 rounded-xl backdrop-blur-sm">
                <span class="text-xs font-semibold ${lane.text} flex items-center gap-1">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                  Editar
                </span>
              </div>
            </div>
          `;
        });
      }

      html += `</div></div>`;
    });
  }

  html += `</div></div>`;
  panel.innerHTML = html;

  // Attach click handlers to timeline cards
  panel.querySelectorAll('.pa-timeline-card').forEach(cardEl => {
    cardEl.addEventListener('click', () => {
      const nodeId = cardEl.getAttribute('data-node-id');
      if (nodeId) openNodeEditor(nodeId);
    });
  });
}

function addTextBox() {
  const rect = canvasContainer.getBoundingClientRect();
  const x = Math.round((rect.width / 2 - state.panX) / state.scale);
  const y = Math.round((rect.height / 2 - state.panY) / state.scale);

  const newNode = {
    id: uuid(),
    x: x - 100,
    y: y - 40,
    width: 200,
    height: 80,
    type: 'note',
    data: { text: '', richText: '', title: 'Card Livre' },
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
          <span class="text-sm text-gray-700">Alternar Timeline/Canvas</span>
          <kbd class="px-2 py-1 bg-gray-100 rounded text-xs font-mono">G</kbd>
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
  // touch-action none to prevent native scroll interfering with drag
  canvasContainer.style.touchAction = 'none';

  // Wheel zoom (desktop + trackpad pinch via wheel)
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

  // ── POINTER DOWN (replaces mousedown — works for mouse + touch) ─────────
  canvasContainer.addEventListener('pointerdown', (e) => {
    // Only primary pointer (first finger / left mouse)
    if (e.button > 1) return;
    const target = e.target;
    const isBg = target === canvasContainer || target === transformLayer
      || target.id === 'pa-canvas-bg' || target.id === 'pa-nodes-layer' || target.id === 'pa-edges-layer';

    // Clear selection when tapping background
    if (isBg && !e.ctrlKey && !e.shiftKey) {
      state.selectedNodeIds = [];
      document.querySelectorAll('.absolute.rounded-xl').forEach(el => el.classList.remove('ring-4', 'ring-blue-500', 'shadow-xl'));
    }

    if (e.button === 1 || (isBg)) {
      isPanning = true;
      panStartX = e.clientX - state.panX;
      panStartY = e.clientY - state.panY;
      canvasContainer.style.cursor = 'grabbing';
      canvasContainer.setPointerCapture(e.pointerId);
    }
  });

  // ── POINTER MOVE (replaces mousemove) ─────────────────────────────────
  function onPointerMove(e) {
    if (isPanning) {
      state.panX = e.clientX - panStartX;
      state.panY = e.clientY - panStartY;
      updateTransform();
    }
    if (isDraggingNode && draggedNodeId) {
      const dx = (e.clientX - dragStartX) / state.scale;
      const dy = (e.clientY - dragStartY) / state.scale;
      if (Math.abs(e.clientX - dragStartX) > 3 || Math.abs(e.clientY - dragStartY) > 3) hasDragged = true;

      const draggedIds = state.selectedNodeIds?.includes(draggedNodeId) ? state.selectedNodeIds : [draggedNodeId];

      draggedIds.forEach(id => {
        const node = state.nodes.find(n => n.id === id);
        const startPos = dragInitialPositions[id];
        if (node && startPos) {
          node.x = Math.round(startPos.x + dx);
          node.y = Math.round(startPos.y + dy);
          const el = document.getElementById(`pa-node-${node.id}`);
          if (el) {
            el.style.transform = `translate3d(${node.x}px, ${node.y}px, 0)`;
          }
        }
      });
      renderEdges();
      state.isDirty = true;
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
  addGlobalListener(window, 'pointermove', onPointerMove);

  // ── POINTER UP (replaces mouseup) ─────────────────────────────────────
  function onPointerUp(e) {
    if (isPanning) {
      isPanning = false;
      canvasContainer.style.cursor = 'default';
    }
    if (isDraggingNode) {
      // Persist final positions
      const draggedIds = state.selectedNodeIds?.includes(draggedNodeId) ? state.selectedNodeIds : [draggedNodeId ? draggedNodeId : ''];
      draggedIds.forEach(id => {
        const node = state.nodes.find(n => n.id === id);
        if (node) updateCanvasNode(node.id, { x: node.x, y: node.y });
      });
      isDraggingNode = false;
      draggedNodeId = null;
      if (state.isDirty) scheduleAutoSave();
    }
    if (isConnecting) {
      const targetEl = e.target?.closest?.('.pa-handle');
      if (targetEl) {
        const targetNode = targetEl.getAttribute('data-node-id');
        const targetHandle = targetEl.getAttribute('data-handle-id');

        if (targetNode && targetNode !== connectionSourceNode) {
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
            scheduleAutoSave();
            showToast('Conexão criada!', 'success');
          } else {
            showToast('Conexão já existe!', 'info');
          }
        }
      }

      isConnecting = false;
      connectionSourceNode = null;
      connectionSourceHandle = null;

      if (connectionTimeoutId) {
        clearTimeout(connectionTimeoutId);
        connectionTimeoutId = null;
      }

      if (tempEdgePath) {
        tempEdgePath.remove();
        tempEdgePath = null;
      }

      const connStatus = document.getElementById('pa-connection-status');
      if (connStatus) connStatus.classList.add('hidden');
      const connTimeout = document.getElementById('pa-connection-timeout');
      if (connTimeout) connTimeout.classList.add('hidden');
    }
  }
  addGlobalListener(window, 'pointerup', onPointerUp);

  // Drag & Drop from sidebar
  canvasContainer.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; });
  canvasContainer.addEventListener('drop', (e) => {
    e.preventDefault();
    const conceptStr = e.dataTransfer.getData('application/json');
    if (!conceptStr) return;
    const concept = JSON.parse(conceptStr);
    const rect = canvasContainer.getBoundingClientRect();
    const x = Math.round((e.clientX - rect.left - state.panX) / state.scale);
    const y = Math.round((e.clientY - rect.top - state.panY) / state.scale);

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
    scheduleAutoSave();

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
          const x = Math.round((e.clientX - rect.left - state.panX) / state.scale) - 100;
          const y = Math.round((e.clientY - rect.top - state.panY) / state.scale) - 50;

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
      const x = Math.round((e.clientX - rect.left - state.panX) / state.scale) - 100;
      const y = Math.round((e.clientY - rect.top - state.panY) / state.scale) - 50;

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
    const isSel = state.selectedNodeIds?.includes(node.id);
    const isTimelineMatched = state.timelineFilter === 'Todos' || node.data?.timelineStage === state.timelineFilter;
    const filterOpacity = isTimelineMatched ? 'opacity-100' : 'opacity-30 grayscale pointer-events-none transition-opacity duration-300';
    
    el.id = `pa-node-${node.id}`;
    el.className = `absolute rounded-xl border-2 transition-shadow duration-200 min-w-[200px] max-w-[260px] ${bgClass} cursor-pointer pointer-events-auto hover:shadow-md ${isSel ? 'ring-4 ring-blue-500 shadow-xl' : 'shadow-sm'} ${filterOpacity}`;
    el.style.transform = `translate3d(${Math.round(node.x)}px, ${Math.round(node.y)}px, 0)`;
    el.style.willChange = 'transform';
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

    // Priority badge
    let priorityHtml = '';
    if (node.data?.priority && node.data.priority !== 'Normal') {
      const pColors = { Urgente: 'bg-red-500 text-white', Alta: 'bg-orange-500 text-white', Média: 'bg-blue-500 text-white', Baixa: 'bg-gray-400 text-white' };
      const pColor = pColors[node.data.priority] || 'bg-gray-400 text-white';
      priorityHtml = `<div class="absolute -top-2 right-2 px-1.5 py-0.5 ${pColor} text-[8px] font-bold uppercase tracking-wider rounded-full shadow-sm z-10">${node.data.priority}</div>`;
    }

    // Parent/project label
    const parentHtml = node.data?.parentProject
      ? `<p class="text-[9px] font-semibold text-gray-400 uppercase tracking-widest mb-0.5">${node.data.parentProject}</p>`
      : '';

    // Conteúdo do node com verificação de imagem - SEM ÍCONES
    if (isImage && node.imageUrl) {
      el.innerHTML = `
        ${handles}
        ${stageHtml}
        ${priorityHtml}
        <div class="p-2 cursor-grab active:cursor-grabbing">
          <div style="background:#fff; border-radius:8px; overflow:hidden;">
            <img src="${node.imageUrl}" alt="" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22100%22><rect fill=%22%23ddd%22 width=%22200%22 height=%22100%22/><text fill=%22%23666%22 x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22-3%22 font-size=%2212%22>Imagem não carregou</text></svg>'; this.classList.add('grayscale');" class="w-full h-auto rounded-lg border border-black/10" style="max-height:200px;object-fit:contain;display:block;" loading="lazy draggable="false""/>
          </div>
          <p class="text-[10px] text-gray-500 mt-1.5 text-center">${node.data?.caption || 'Imagem'}</p>
          ${tagsHtml}
        </div>
      `;
    } else if (isNote) {
      el.innerHTML = `
        ${handles}
        ${stageHtml}
        ${priorityHtml}
        <div class="p-3.5 cursor-grab active:cursor-grabbing">
          <div class="flex-1 min-w-0">
            ${parentHtml}
            <h3 class="font-bold text-[13px] leading-tight mb-0.5 pa-editable-title hover:text-blue-600 transition-colors" title="Clique para editar título">${node.data?.title || 'Card Livre'}</h3>
            <p class="text-[10px] opacity-60 line-clamp-3">${node.data?.text || node.notes || ''}</p>
            ${node.data?.richText ? `<div class="mt-2 text-xs text-gray-600 border-t border-dashed pt-2">${node.data.richText}</div>` : ''}
            ${tagsHtml}
          </div>
        </div>
      `;
    } else {
      el.innerHTML = `
        ${handles}
        ${stageHtml}
        ${priorityHtml}
        <div class="p-3.5 cursor-grab active:cursor-grabbing flex flex-col h-full">
          <div class="flex-1 min-w-0">
            ${parentHtml}
            <h3 class="font-bold text-[13px] leading-tight mb-0.5">${node.concept?.title || 'Concept'}</h3>
            <p class="text-[10px] font-bold uppercase tracking-wider opacity-60 truncate">${node.concept?.category || ''}${node.concept?.subcategory ? ' • ' + node.concept.subcategory : ''}</p>
          </div>
          ${node.data && node.data.freeText ? `<div class="mt-2 text-[10px] text-gray-600 border-t border-gray-100/50 pt-1.5 leading-tight line-clamp-3">${node.data.freeText}</div>` : ''}
          ${tagsHtml}
        </div>
      `;
    }

    // Node pointerdown — handles touch + mouse for drag and connection
    // Node pointerdown — handles touch + mouse for drag and connection
    el.addEventListener('pointerdown', (e) => {
      const target = e.target;
      const handleEl = target?.classList?.contains('pa-handle') ? target : target?.closest?.('.pa-handle');
      const deleteBtnEl = target?.closest('[data-delete-node]');

      if (deleteBtnEl) {
        e.stopPropagation();
        return;
      }

      if (handleEl) {
        isConnecting = true;
        connectionSourceNode = handleEl.getAttribute('data-node-id');
        connectionSourceHandle = handleEl.getAttribute('data-handle-id');

        tempEdgePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        tempEdgePath.setAttribute('stroke', '#3b82f6');
        tempEdgePath.setAttribute('stroke-width', '3');
        tempEdgePath.setAttribute('fill', 'none');
        tempEdgePath.setAttribute('stroke-dasharray', '5,5');
        tempEdgePath.setAttribute('opacity', '0.8');
        edgesLayer.appendChild(tempEdgePath);

        const connStatus = document.getElementById('pa-connection-status');
        if (connStatus) {
          connStatus.classList.remove('hidden');
          connStatus.innerHTML = '<i data-lucide="link" class="w-3 h-3 inline mr-1"></i>Conectando...';
          if (window.lucide) window.lucide.createIcons();
        }

        if (connectionTimeoutId) clearTimeout(connectionTimeoutId);
        connectionTimeoutId = setTimeout(() => {
          const connStatus2 = document.getElementById('pa-connection-status');
          if (connStatus2) connStatus2.classList.add('hidden');
          isConnecting = false;
          connectionSourceNode = null;
          connectionSourceHandle = null;
          if (tempEdgePath) { tempEdgePath.remove(); tempEdgePath = null; }
        }, 3000);

        e.preventDefault();
        e.stopPropagation();
        return;
      }

      // Iniciar drag do node
      isDraggingNode = true;
      hasDragged = false;
      draggedNodeId = node.id;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      el.setPointerCapture(e.pointerId);

      if (e.ctrlKey || e.shiftKey) {
        if (!state.selectedNodeIds.includes(node.id)) {
          state.selectedNodeIds.push(node.id);
        } else {
          state.selectedNodeIds = state.selectedNodeIds.filter(id => id !== node.id);
        }
      } else {
        if (!state.selectedNodeIds.includes(node.id)) {
          state.selectedNodeIds = [node.id];
        }
      }

      dragInitialPositions = {};
      const draggedIds = state.selectedNodeIds.includes(node.id) ? state.selectedNodeIds : [node.id];
      draggedIds.forEach(id => {
        const nRef = state.nodes.find(nx => nx.id === id);
        if (nRef) dragInitialPositions[id] = { x: nRef.x, y: nRef.y };
      });

      document.querySelectorAll('.absolute.rounded-xl').forEach(nEl => nEl.classList.remove('ring-4', 'ring-blue-500', 'shadow-xl'));
      state.selectedNodeIds.forEach(id => {
        const selEl = document.getElementById(`pa-node-${id}`);
        if (selEl) selEl.classList.add('ring-4', 'ring-blue-500', 'shadow-xl');
      });

      const idx = state.nodes.findIndex(n => n.id === node.id);
      if (idx > -1) { state.nodes.push(state.nodes.splice(idx, 1)[0]); nodesLayer.appendChild(el); }

      e.stopPropagation();
    });

    // Click → sidebar editor (abre para digitar textos)
    el.addEventListener('click', (e) => {
      // Ignora click em handles e delete button
      if (e.target.classList.contains('pa-handle') || e.target.closest('[data-delete-node]')) {
        return;
      }
      
      // Edição inline de título para Card Livre
      if (e.target.classList.contains('pa-editable-title')) {
        e.stopPropagation();
        const oldTitle = e.target.textContent;
        const input = document.createElement('input');
        input.type = 'text';
        input.value = oldTitle;
        input.className = 'w-full text-[13px] font-bold bg-white border-b-2 border-blue-500 px-1 outline-none text-gray-900 absolute top-0 left-0';
        input.style.zIndex = '50';
        
        const saveTitle = () => {
          const newTitle = input.value.trim() || 'Card Livre';
          node.data = { ...node.data, title: newTitle };
          // Localmente não precisa rebater no DB se salvamento estiver na store final, mas updateCanvasNode debounces it
          updateCanvasNode(node.id, { data: node.data });
          state.isDirty = true;
          e.target.textContent = newTitle;
          e.target.style.visibility = 'visible';
          input.remove();
        };
        
        input.addEventListener('blur', saveTitle);
        input.addEventListener('keydown', (ev) => {
          if (ev.key === 'Enter') { ev.preventDefault(); saveTitle(); }
          if (ev.key === 'Escape') {
            e.target.style.visibility = 'visible';
            input.remove();
          }
        });
        
        const titleWrapper = e.target.parentNode;
        titleWrapper.style.position = 'relative';
        e.target.style.visibility = 'hidden';
        titleWrapper.appendChild(input);
        input.focus();
        input.select();
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

  // Right-click context menu (edit/delete node)
  nodesLayer.querySelectorAll('.absolute.rounded-xl').forEach(nodeEl => {
    nodeEl.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const nodeId = nodeEl.id.replace('pa-node-', '');

      document.getElementById('pa-context-menu')?.remove();

      const menu = document.createElement('div');
      menu.id = 'pa-context-menu';
      menu.className = 'fixed bg-white border border-gray-200 rounded-lg shadow-xl py-1 z-[300] min-w-[140px]';
      menu.style.left = `${e.clientX}px`;
      menu.style.top = `${e.clientY}px`;
      
      const editBtn = document.createElement('button');
      editBtn.className = 'w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 transition-colors';
      editBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg> Editar Textos`;
      editBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        menu.remove();
        openNodeEditor(nodeId);
      });

      const isNodeSelected = state.selectedNodeIds?.includes(nodeId);
      const count = isNodeSelected ? Math.max(1, state.selectedNodeIds.length) : 1;

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors';
      deleteBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg> Excluir ${count > 1 ? count + ' Selecionados' : ''}`;
      
      deleteBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        menu.remove();
        showModal({
          title: count > 1 ? 'Excluir Cards' : 'Excluir Card',
          message: count > 1 ? `Excluir os ${count} cards selecionados do canvas?` : 'Excluir este card do canvas?',
          onConfirm: () => {
            const idsToDelete = (isNodeSelected && count > 1) ? state.selectedNodeIds : [nodeId];
            state.nodes = state.nodes.filter(n => !idsToDelete.includes(n.id));
            state.edges = state.edges.filter(ed => !idsToDelete.includes(ed.source_id) && !idsToDelete.includes(ed.target_id));
            if (isNodeSelected) state.selectedNodeIds = [];
            renderNodes();
            state.isDirty = true;
          }
        });
      });
      
      menu.appendChild(editBtn);
      menu.appendChild(deleteBtn);
      document.body.appendChild(menu);

      const closeMenu = () => { menu.remove(); document.removeEventListener('click', closeMenu); };
      setTimeout(() => document.addEventListener('click', closeMenu), 0);
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
  const node = state.nodes.find(n => n.id === nodeId);
  if (!node) return;

  // Remove highlight from previous node if any
  if (state.editingNodeId) {
    const prevEl = document.getElementById(`pa-node-${state.editingNodeId}`);
    if (prevEl) prevEl.classList.remove('ring-2', 'ring-blue-500', 'shadow-lg');
  }

  state.editingNodeId = nodeId;

  // Highlight the selected node
  const el = document.getElementById(`pa-node-${nodeId}`);
  if (el) el.classList.add('ring-2', 'ring-blue-500', 'shadow-lg');

  const existingModal = document.getElementById('pa-editor-modal');
  if (existingModal) existingModal.remove();

  const isImage = node.type === 'image';
  const isNote = node.type === 'note';
  const isConcept = !isImage && !isNote;
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

  const modal = document.createElement('div');
  modal.id = 'pa-editor-modal';
  modal.className = 'fixed inset-0 bg-black/40 backdrop-blur-sm z-[200] flex items-center justify-center p-4 transition-opacity duration-200';

  let html = `
    <div class="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col transform scale-95 transition-transform duration-200" onclick="event.stopPropagation()">
      <div class="p-4 border-b border-gray-100 bg-gray-50/50 shrink-0 flex items-start gap-3 justify-between">
        <div class="flex items-start gap-3">
          <div class="p-2 bg-white rounded-xl shadow-sm border border-gray-100">
            <svg class="w-5 h-5 ${iconColor}" data-lucide="${iconName}"></svg>
          </div>
          <div class="flex-1 min-w-0">
            <h2 class="text-base font-bold text-gray-900 leading-tight">${node.concept?.title || typeBadge}</h2>
            <p class="text-[10px] font-bold uppercase tracking-wider text-gray-400 mt-0.5">${node.concept?.category || typeBadge}${node.concept?.subcategory ? ' • ' + node.concept.subcategory : ''}</p>
          </div>
        </div>
        <button id="pa-editor-close" class="p-1.5 hover:bg-gray-200 rounded-lg text-gray-400 transition-colors">
          <svg class="w-5 h-5" data-lucide="x"></svg>
        </button>
      </div>

      <div class="flex-1 overflow-y-auto p-5 space-y-5">
  `;

  // Read-only concept info section
  if (node.concept && !isImage && !isNote) {
    html += `
      <div class="space-y-2">
        <label class="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
          <svg class="w-3.5 h-3.5 text-blue-500" data-lucide="info"></svg> Informações do Conceito
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
          <svg class="w-3.5 h-3.5 text-amber-500" data-lucide="file-text"></svg> Conteúdo do Box
        </label>
        <textarea id="pa-editor-text-content" class="w-full h-48 p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none transition-all text-sm bg-white font-mono" placeholder="Digite seu texto aqui...">${node.data?.text || ''}</textarea>
        <div class="flex gap-2 text-[10px] text-gray-400">
          <span class="px-2 py-1 bg-gray-100 rounded">Use \\n para quebra de linha</span>
        </div>
      </div>
    `;
  }

  // Free text input for concept nodes (replaces old image URL)
  if (isConcept) {
    html += `
      <div class="space-y-2">
        <label class="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
          <svg class="w-3.5 h-3.5 text-blue-500" data-lucide="align-left"></svg> Anotação / Texto Livre
        </label>
        <textarea id="pa-editor-free-text" class="w-full h-24 p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none transition-all text-sm bg-white" placeholder="Digite uma anotação livre sobre esse card...">${node.data?.freeText || ''}</textarea>
      </div>
    `;
  } else if (isNote) {
    // For image nodes: show the image and caption
    html += `
      <div class="space-y-2">
        <label class="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
          <svg class="w-3.5 h-3.5 text-purple-500" data-lucide="image"></svg> Imagem
        </label>
        ${node.imageUrl ? `<div class="rounded-xl overflow-hidden border border-gray-200 bg-white"><img src="${node.imageUrl}" alt="" class="w-full h-auto" style="max-height:240px;object-fit:contain" /></div>` : '<p class="text-xs text-gray-400">Nenhuma imagem</p>'}
        <input id="pa-editor-caption" type="text" class="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all text-sm bg-white" placeholder="Legenda da imagem" value="${node.data?.caption || ''}" />
      </div>
    `;
  }

  // Tags input (for all types of nodes)
  const currentTags = node.data?.tags ? node.data.tags.join(', ') : '';
  const currentStage = node.data?.timelineStage || 'Nenhum';
  const currentPriority = node.data?.priority || 'Normal';
  const currentParent = node.data?.parentProject || '';
  const stages = ['Nenhum', 'Antes', 'Durante', 'Depois', 'Análise', 'Em Operação', 'Pós-Operação'];
  const stageOptions = stages.map(st => `<option value="${st}" ${st === currentStage ? 'selected' : ''}>${st}</option>`).join('');
  const priorities = ['Normal', 'Baixa', 'Média', 'Alta', 'Urgente'];
  const priorityOptions = priorities.map(p => `<option value="${p}" ${p === currentPriority ? 'selected' : ''}>${p}</option>`).join('');

  html += `
    <div class="space-y-2">
      <label class="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
        <svg class="w-3.5 h-3.5 text-purple-500" data-lucide="tags"></svg> Tags (separadas por vírgula)
      </label>
      <input id="pa-editor-tags" type="text" class="w-full p-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all text-sm bg-white" placeholder="ex: Sinal, Compra, Padrão" value="${currentTags}" />
    </div>

    <div class="grid grid-cols-2 gap-3">
      <div class="space-y-2">
        <label class="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
          <svg class="w-3.5 h-3.5 text-blue-500" data-lucide="clock"></svg> Etapa
        </label>
        <select id="pa-editor-timeline-stage" class="w-full p-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm bg-white cursor-pointer font-medium text-gray-700">
          ${stageOptions}
        </select>
      </div>
      <div class="space-y-2">
        <label class="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
          <svg class="w-3.5 h-3.5 text-orange-500" data-lucide="alert-triangle"></svg> Prioridade
        </label>
        <select id="pa-editor-priority" class="w-full p-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all text-sm bg-white cursor-pointer font-medium text-gray-700">
          ${priorityOptions}
        </select>
      </div>
    </div>

    <div class="space-y-2">
      <label class="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
        <svg class="w-3.5 h-3.5 text-teal-500" data-lucide="folder"></svg> Projeto / Domínio
      </label>
      <input id="pa-editor-parent-project" type="text" class="w-full p-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all text-sm bg-white" placeholder="ex: Swing Trade, Price Action, Gestão" value="${currentParent}" />
    </div>
  `;

  html += `</div>`;

  // Action buttons (sticky footer)
  html += `
      <div class="p-4 border-t border-gray-100 bg-gray-50/50 shrink-0 flex justify-end gap-2">
        <button id="pa-editor-delete" class="px-4 py-2.5 text-sm font-medium text-red-600 bg-white border border-red-200 rounded-xl hover:bg-red-50 transition-colors flex items-center justify-center gap-2 flex-none" title="Excluir Nó">
          <svg class="w-4 h-4" data-lucide="trash-2"></svg>
        </button>
        <button id="pa-editor-save" class="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors shadow-sm">
          <svg class="w-4 h-4" data-lucide="save"></svg> Salvar Alterações
        </button>
      </div>
    </div>
  `;

  modal.innerHTML = html;
  document.body.appendChild(modal);
  if (window.lucide) window.lucide.createIcons();

  // Auto-resize all textareas in the modal
  modal.querySelectorAll('textarea').forEach(ta => {
    autoResizeTextarea(ta);
    ta.addEventListener('input', () => autoResizeTextarea(ta));
  });

  // Safe-area padding for mobile keyboard
  const scrollArea = modal.querySelector('.overflow-y-auto');
  if (scrollArea) scrollArea.style.paddingBottom = 'calc(env(safe-area-inset-bottom, 0px) + 80px)';

  requestAnimationFrame(() => modal.querySelector('.scale-95')?.classList.remove('scale-95'));

  const closeNodeEditor = () => {
    modal.classList.add('opacity-0');
    if (el) el.classList.remove('ring-2', 'ring-blue-500', 'shadow-lg');
    state.editingNodeId = null;
    setTimeout(() => modal.remove(), 200);
  };

  document.getElementById('pa-editor-close').addEventListener('click', closeNodeEditor);
  modal.addEventListener('click', closeNodeEditor);

  // Image URL preview
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
    const tagsStr = document.getElementById('pa-editor-tags')?.value || '';
    const tagsArray = tagsStr.split(',').map(t => t.trim()).filter(t => t.length > 0);
    const timelineStage = document.getElementById('pa-editor-timeline-stage')?.value || 'Nenhum';
    const priority = document.getElementById('pa-editor-priority')?.value || 'Normal';
    const parentProject = document.getElementById('pa-editor-parent-project')?.value.trim() || '';

    if (isNote) {
      const textContent = document.getElementById('pa-editor-text-content')?.value || '';
      node.data = { ...node.data, text: textContent, tags: tagsArray, timelineStage, priority, parentProject };
      node.notes = textContent;
    } else if (isImage) {
      const caption = document.getElementById('pa-editor-caption')?.value || '';
      node.data = { ...node.data, caption, tags: tagsArray, timelineStage, priority, parentProject };
    } else {
      const freeText = document.getElementById('pa-editor-free-text')?.value || '';
      node.data = { ...node.data, freeText, tags: tagsArray, timelineStage, priority, parentProject };
      if ('imageUrl' in node) delete node.imageUrl;
      if (node.data && 'imageUrl' in node.data) delete node.data.imageUrl;
    }
    updateCanvasNode(node.id, { data: node.data });
    renderNodes();

    // maintain highlight
    const updatedEl = document.getElementById(`pa-node-${node.id}`);
    updatedEl?.classList.add('ring-2', 'ring-blue-500', 'shadow-lg');

    showToast('Alterações salvas!', 'success');
    state.isDirty = true;
    scheduleAutoSave();
    closeNodeEditor();
  });

  // Delete button via showModal
  document.getElementById('pa-editor-delete')?.addEventListener('click', () => {
    closeNodeEditor();
    showModal({
      title: 'Excluir Conceito',
      message: 'Excluir este conceito do canvas?',
      onConfirm: () => {
        state.nodes = state.nodes.filter(n => n.id !== node.id);
        state.edges = state.edges.filter(ed => ed.source_id !== node.id && ed.target_id !== node.id);
        renderNodes();
        renderEdges();
        state.isDirty = true;
        scheduleAutoSave();
      }
    });
  });
}

function closeNodeEditor() {
  if (state.editingNodeId) {
    const prevEl = document.getElementById(`pa-node-${state.editingNodeId}`);
    if (prevEl) prevEl.classList.remove('ring-2', 'ring-blue-500', 'shadow-lg');
  }
  state.editingNodeId = null;
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
    
    const tabBtn = e.target.closest('[data-pa-tab]');
    if (tabBtn) { state.sidebarTab = tabBtn.getAttribute('data-pa-tab'); renderSidebarContent(sidebarEl); }

    const mapActionBtn = e.target.closest('[data-map-action]');
    if (mapActionBtn) {
      const mapId = mapActionBtn.getAttribute('data-map-id');
      const action = mapActionBtn.getAttribute('data-map-action');
      if (action === 'load') {
        loadMap(mapId);
      } else {
        handleMapAction(action, mapId);
      }
    }
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
  const wasFocused = document.activeElement?.id === 'pa-search-input';
  
  // Tabs Header
  let html = `
    <div class="px-4 pt-4 border-b border-gray-200 bg-gray-50/50 shrink-0">
      <div class="flex items-center justify-between mb-3">
        <div class="flex bg-gray-100 p-1 rounded-lg w-full gap-1">
          <button data-pa-tab="repository" class="flex-1 py-1.5 px-2 text-xs font-semibold rounded-md transition-all ${state.sidebarTab !== 'history' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}">Repositório</button>
          <button data-pa-tab="history" class="flex-1 py-1.5 px-2 text-xs font-semibold rounded-md transition-all ${state.sidebarTab === 'history' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}">Histórico</button>
        </div>
        <button id="pa-sidebar-close" class="md:hidden ml-2 p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors shrink-0">
          <svg class="w-4 h-4" data-lucide="x"></svg>
        </button>
      </div>
    </div>
  `;

  if (state.sidebarTab === 'history') {
    // History Tab Content
    html += `<div class="flex-1 overflow-y-auto p-4 space-y-3">
      <div class="flex items-center justify-between mb-2">
        <h3 class="text-xs font-bold text-gray-500 uppercase tracking-wider">Seus Mapas</h3>
      </div>
      <div class="space-y-2">
    `;
    
    if (state.maps.length === 0) {
      html += `<div class="text-center py-6 text-xs text-gray-400">Nenhum mapa salvo.</div>`;
    } else {
      const sortedMaps = [...state.maps].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
      sortedMaps.forEach(map => {
        const isActive = state.currentMapId === map.id;
        const date = new Date(map.updated_at).toLocaleDateString();
        html += `
          <div class="group relative flex flex-col p-3 rounded-xl border ${isActive ? 'bg-blue-50 border-blue-200 shadow-sm' : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'} transition-all">
            <div class="flex items-center justify-between min-w-0 w-full mb-2">
              <button class="flex-1 text-left min-w-0" data-map-action="load" data-map-id="${map.id}">
                <div class="text-sm font-semibold ${isActive ? 'text-blue-700' : 'text-gray-800'} truncate">${map.title || 'Sem título'}</div>
                <div class="text-[10px] text-gray-500 mt-0.5">Atualizado ${date}</div>
              </button>
              <div class="flex items-center gap-1 shrink-0 ml-2">
                <button data-map-action="rename" data-map-id="${map.id}" class="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors" title="Renomear">
                  <svg class="w-3.5 h-3.5" data-lucide="edit-2"></svg>
                </button>
                <button data-map-action="duplicate" data-map-id="${map.id}" class="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors" title="Duplicar">
                  <svg class="w-3.5 h-3.5" data-lucide="copy"></svg>
                </button>
                <button data-map-action="delete" data-map-id="${map.id}" class="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors" title="Excluir">
                  <svg class="w-3.5 h-3.5" data-lucide="trash-2"></svg>
                </button>
              </div>
            </div>
          </div>
        `;
      });
    }
    
    html += `</div></div>`;
  } else {
    // Repository Tab Content
    const groups = getGroupedConcepts();
    const hasConcepts = Object.keys(groups).length > 0;

    Object.keys(groups).forEach(cat => { if (state.expandedCategories[cat] === undefined) state.expandedCategories[cat] = true; });

    const evoActive = state.currentMode === 'evolucao';

    html += `
      <div class="px-4 pb-4 border-b border-gray-200 bg-gray-50/50 shrink-0">
        <p class="text-[11px] text-gray-500 mb-3 mt-1">Arraste os conceitos para o canvas</p>
        <div class="flex p-1 bg-gray-100 rounded-lg mb-3">
          <button data-pa-mode="evolucao" class="flex-1 flex items-center justify-center gap-1.5 py-2 px-2 text-xs font-semibold rounded-md transition-all ${evoActive ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}">
            <svg class="w-3.5 h-3.5" data-lucide="book-open"></svg> Evolução
          </button>
          <button data-pa-mode="operacao" class="flex-1 flex items-center justify-center gap-1.5 py-2 px-2 text-xs font-semibold rounded-md transition-all ${!evoActive ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}">
            <svg class="w-3.5 h-3.5" data-lucide="activity"></svg> Operações
          </button>
        </div>
        <div class="relative">
          <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" data-lucide="search"></svg>
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
            <svg class="w-3.5 h-3.5 text-gray-400 group-hover:text-gray-600" data-lucide="${isExp ? 'chevron-down' : 'chevron-right'}"></svg>
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
                  <svg class="w-3.5 h-3.5 text-gray-400 mr-1.5 shrink-0 mt-0.5" data-lucide="grip-vertical"></svg>
                  <div class="flex-1 min-w-0">
                    <span class="text-xs font-medium text-gray-800 block truncate">${concept.title}</span>
                    ${concept.prerequisite ? `<span class="inline-block mt-0.5 px-1.5 py-0.5 bg-gray-200 text-gray-600 text-[9px] rounded font-medium">Pré: ${concept.prerequisite}</span>` : ''}
                  </div>
                  ${concept.notes ? `<div class="shrink-0 ml-1.5 text-gray-400 group-hover:text-gray-600" title="${concept.notes}"><svg class="w-3.5 h-3.5" data-lucide="info"></svg></div>` : ''}
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
  }

  sidebar.innerHTML = html;
  if (window.lucide) window.lucide.createIcons();

  // Re-focus search
  if (wasFocused && state.sidebarTab !== 'history') {
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
