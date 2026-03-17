import './index.css';
import { initSidebar } from './sidebar';
import { initCanvas, updateTransform } from './canvas';
import { initModal } from './modal';
import { createIcons, Save, Upload, Trash2 } from 'lucide';
import { state } from './state';

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div class="flex h-screen w-full bg-gray-50 overflow-hidden font-sans text-gray-900">
    <aside id="sidebar" class="w-80 bg-white border-r border-gray-200 flex flex-col h-full shadow-sm z-20"></aside>
    <main id="canvas-container" class="flex-1 h-full relative overflow-hidden bg-gray-50">
      <!-- Grid Background -->
      <div id="canvas-bg" class="absolute inset-0 pointer-events-none" style="background-image: radial-gradient(#cbd5e1 1px, transparent 1px); background-size: 24px 24px;"></div>
      
      <!-- Transform Layer -->
      <div id="canvas-transform" class="absolute inset-0 origin-top-left will-change-transform">
        <svg id="edges-layer" class="absolute inset-0 overflow-visible pointer-events-none w-full h-full"></svg>
        <div id="nodes-layer" class="absolute inset-0 w-full h-full pointer-events-none"></div>
      </div>

      <!-- UI Controls -->
      <div class="absolute top-4 right-4 flex gap-2 z-20">
        <button id="btn-save" class="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl shadow-sm hover:bg-gray-50 text-sm font-medium text-gray-700 transition-colors pointer-events-auto">
          <i data-lucide="save" class="w-4 h-4 text-blue-600"></i> Salvar
        </button>
        <button id="btn-restore" class="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl shadow-sm hover:bg-gray-50 text-sm font-medium text-gray-700 transition-colors pointer-events-auto">
          <i data-lucide="upload" class="w-4 h-4 text-green-600"></i> Restaurar
        </button>
        <button id="btn-clear" class="flex items-center gap-2 px-4 py-2 bg-white border border-red-200 rounded-xl shadow-sm hover:bg-red-50 text-sm font-medium text-red-700 transition-colors pointer-events-auto">
          <i data-lucide="trash-2" class="w-4 h-4"></i> Limpar
        </button>
      </div>
    </main>
    
    <!-- Modal -->
    <div id="modal" class="hidden fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm opacity-0 transition-opacity duration-200">
      <div class="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden transform scale-95 transition-transform duration-200" id="modal-content">
        <!-- Modal content injected via JS -->
      </div>
    </div>
  </div>
`;

// Auto-restore on load
const dataStr = localStorage.getItem('vanilla-flow-study');
if (dataStr) {
  try {
    const data = JSON.parse(dataStr);
    state.nodes = data.nodes || [];
    state.edges = data.edges || [];
    state.scale = data.scale || 1;
    state.panX = data.panX || 0;
    state.panY = data.panY || 0;
  } catch (e) {
    console.error('Failed to restore state', e);
  }
}

initModal();
initCanvas();
initSidebar();
createIcons({
  icons: {
    Save,
    Upload,
    Trash2
  }
});

// Setup global buttons
document.getElementById('btn-save')?.addEventListener('click', () => {
  const data = { 
    nodes: state.nodes, 
    edges: state.edges,
    panX: state.panX,
    panY: state.panY,
    scale: state.scale
  };
  localStorage.setItem('vanilla-flow-study', JSON.stringify(data));
  alert('Estudo salvo no navegador!');
});

document.getElementById('btn-restore')?.addEventListener('click', () => {
  const dataStr = localStorage.getItem('vanilla-flow-study');
  if (dataStr) {
    const data = JSON.parse(dataStr);
    state.nodes = data.nodes || [];
    state.edges = data.edges || [];
    state.scale = data.scale || 1;
    state.panX = data.panX || 0;
    state.panY = data.panY || 0;
    
    updateTransform();
    state.onNodesChange();
    state.onEdgesChange();
  } else {
    alert('Nenhum estudo salvo encontrado.');
  }
});

document.getElementById('btn-clear')?.addEventListener('click', () => {
  if (confirm('Tem certeza que deseja limpar o canvas?')) {
    state.nodes = [];
    state.edges = [];
    state.scale = 1;
    state.panX = 0;
    state.panY = 0;
    
    updateTransform();
    state.onNodesChange();
    state.onEdgesChange();
  }
});
