import { state } from './state';
import { createIcons, X, MessageSquare, Image as ImageIcon, Save, Trash2 } from 'lucide';

export function initModal() {
  const modal = document.getElementById('modal');
  const modalContent = document.getElementById('modal-content');
  if (!modal || !modalContent) return;

  // Close modal when clicking outside
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });
}

let closeTimeout: number | null = null;

export function openModal(nodeId: string) {
  if (closeTimeout) {
    clearTimeout(closeTimeout);
    closeTimeout = null;
  }
  
  const node = state.nodes.find(n => n.id === nodeId);
  if (!node) return;

  const modal = document.getElementById('modal');
  const modalContent = document.getElementById('modal-content');
  if (!modal || !modalContent) return;

  modalContent.innerHTML = `
    <div class="flex justify-between items-center p-6 border-b border-gray-100">
      <div>
        <h2 class="text-2xl font-bold text-gray-900">${node.concept.title}</h2>
        <p class="text-sm font-medium text-gray-500 uppercase tracking-wider mt-1">${node.concept.category} &bull; ${node.concept.subcategory}</p>
      </div>
      <button id="modal-close" class="text-gray-400 hover:text-gray-600 transition-colors p-2 rounded-full hover:bg-gray-100">
        <i data-lucide="x" class="w-6 h-6"></i>
      </button>
    </div>

    <div class="p-6 space-y-6">
      <div class="space-y-2">
        <label class="flex items-center gap-2 text-sm font-semibold text-gray-700">
          <i data-lucide="message-square" class="w-4 h-4 text-blue-500"></i>
          Comentários e Anotações
        </label>
        <textarea
          id="modal-comments"
          class="w-full h-32 p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none transition-all"
          placeholder="Adicione suas anotações sobre este conceito..."
        >${node.comments || ''}</textarea>
      </div>

      <div class="space-y-2">
        <label class="flex items-center gap-2 text-sm font-semibold text-gray-700">
          <i data-lucide="image" class="w-4 h-4 text-green-500"></i>
          URL da Imagem de Exemplo
        </label>
        <input
          id="modal-image-url"
          type="text"
          class="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
          placeholder="https://exemplo.com/imagem.png"
          value="${node.imageUrl || ''}"
        />
        <div id="modal-image-preview" class="mt-4 rounded-xl overflow-hidden border border-gray-200 bg-gray-50 aspect-video flex items-center justify-center ${node.imageUrl ? '' : 'hidden'}">
          <img src="${node.imageUrl || ''}" alt="Exemplo" class="max-w-full max-h-full object-contain" onerror="this.style.display='none'" />
        </div>
      </div>
    </div>

    <div class="p-6 border-t border-gray-100 bg-gray-50 flex justify-between gap-3">
      <button id="modal-delete" class="px-5 py-2.5 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-xl hover:bg-red-100 transition-colors flex items-center gap-2">
        <i data-lucide="trash-2" class="w-4 h-4"></i>
        Excluir Nó
      </button>
      <div class="flex gap-3">
        <button id="modal-cancel" class="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors">
          Cancelar
        </button>
        <button id="modal-save" class="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-sm">
          <i data-lucide="save" class="w-4 h-4"></i>
          Salvar Alterações
        </button>
      </div>
    </div>
  `;

  createIcons({
    icons: {
      X,
      MessageSquare,
      Image: ImageIcon,
      Save,
      Trash2
    }
  });

  // Event Listeners
  document.getElementById('modal-close')?.addEventListener('click', closeModal);
  document.getElementById('modal-cancel')?.addEventListener('click', closeModal);
  
  document.getElementById('modal-delete')?.addEventListener('click', () => {
    if (confirm('Tem certeza que deseja excluir este conceito do canvas?')) {
      state.nodes = state.nodes.filter(n => n.id !== nodeId);
      state.edges = state.edges.filter(e => e.source !== nodeId && e.target !== nodeId);
      state.onNodesChange();
      state.onEdgesChange();
      closeModal();
    }
  });
  
  const imageUrlInput = document.getElementById('modal-image-url') as HTMLInputElement;
  const imagePreview = document.getElementById('modal-image-preview');
  const imageImg = imagePreview?.querySelector('img');
  
  imageUrlInput?.addEventListener('input', (e) => {
    const val = (e.target as HTMLInputElement).value;
    if (val && imagePreview && imageImg) {
      imagePreview.classList.remove('hidden');
      imageImg.src = val;
      imageImg.style.display = 'block';
    } else if (imagePreview) {
      imagePreview.classList.add('hidden');
    }
  });

  document.getElementById('modal-save')?.addEventListener('click', () => {
    const comments = (document.getElementById('modal-comments') as HTMLTextAreaElement).value;
    const imageUrl = (document.getElementById('modal-image-url') as HTMLInputElement).value;
    
    node.comments = comments;
    node.imageUrl = imageUrl;
    
    state.onNodesChange();
    closeModal();
  });

  modal.classList.remove('hidden');
  // Small delay to allow display:block to apply before animating opacity
  setTimeout(() => {
    modal.classList.remove('opacity-0');
    modalContent.classList.remove('scale-95');
  }, 10);
}

export function closeModal() {
  const modal = document.getElementById('modal');
  const modalContent = document.getElementById('modal-content');
  if (!modal || !modalContent) return;

  modal.classList.add('opacity-0');
  modalContent.classList.add('scale-95');
  
  closeTimeout = window.setTimeout(() => {
    modal.classList.add('hidden');
    closeTimeout = null;
  }, 200);
}
