import { CONCEPTS } from './data/concepts';
import { Concept, ConceptMode } from './types';
import { createIcons, BookOpen, Activity, Search, ChevronDown, ChevronRight, GripVertical, Info } from 'lucide';

let currentMode: ConceptMode = 'evolucao';
let searchQuery = '';
let expandedCategories: Record<string, boolean> = {};

export function initSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;

  renderSidebar(sidebar);

  // Event Delegation for Sidebar
  sidebar.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    
    // Mode Toggle
    const modeBtn = target.closest('[data-mode]');
    if (modeBtn) {
      currentMode = modeBtn.getAttribute('data-mode') as ConceptMode;
      renderSidebar(sidebar);
    }

    // Category Toggle
    const categoryBtn = target.closest('[data-category]');
    if (categoryBtn) {
      const cat = categoryBtn.getAttribute('data-category')!;
      expandedCategories[cat] = !expandedCategories[cat];
      renderSidebar(sidebar);
    }
  });

  sidebar.addEventListener('input', (e) => {
    const target = e.target as HTMLInputElement;
    if (target.id === 'search-input') {
      searchQuery = target.value;
      if (searchQuery) {
        // Expand all on search
        const groups = getGroupedConcepts();
        Object.keys(groups).forEach(cat => expandedCategories[cat] = true);
      }
      renderSidebar(sidebar);
    }
  });

  sidebar.addEventListener('dragstart', (e) => {
    const target = e.target as HTMLElement;
    const conceptItem = target.closest('[data-concept-id]');
    if (conceptItem && e.dataTransfer) {
      const conceptId = conceptItem.getAttribute('data-concept-id');
      const concept = CONCEPTS.find(c => c.id === conceptId);
      if (concept) {
        e.dataTransfer.setData('application/json', JSON.stringify(concept));
        e.dataTransfer.effectAllowed = 'move';
      }
    }
  });
}

function getFilteredConcepts() {
  return CONCEPTS.filter(c => {
    if (c.mode !== currentMode) return false;
    if (!searchQuery) return true;
    
    const query = searchQuery.toLowerCase();
    return (
      c.title.toLowerCase().includes(query) ||
      c.category.toLowerCase().includes(query) ||
      c.subcategory.toLowerCase().includes(query) ||
      (c.notes && c.notes.toLowerCase().includes(query))
    );
  });
}

function getGroupedConcepts() {
  const filtered = getFilteredConcepts();
  const groups: Record<string, Record<string, Concept[]>> = {};
  
  filtered.forEach(concept => {
    if (!groups[concept.category]) groups[concept.category] = {};
    if (!groups[concept.category][concept.subcategory]) groups[concept.category][concept.subcategory] = [];
    groups[concept.category][concept.subcategory].push(concept);
  });
  
  return groups;
}

function renderSidebar(sidebar: HTMLElement) {
  const wasSearchFocused = document.activeElement?.id === 'search-input';
  const groups = getGroupedConcepts();
  const hasConcepts = Object.keys(groups).length > 0;

  // Initialize expanded state if not set
  Object.keys(groups).forEach(cat => {
    if (expandedCategories[cat] === undefined) {
      expandedCategories[cat] = true;
    }
  });

  let html = `
    <div class="p-4 border-b border-gray-200 bg-gray-50/50">
      <h2 class="text-lg font-bold text-gray-900 mb-1">Repositório</h2>
      <p class="text-xs text-gray-500 mb-4">Arraste os conceitos para o canvas</p>
      
      <!-- Mode Toggle -->
      <div class="flex p-1 bg-gray-100 rounded-lg mb-4">
        <button data-mode="evolucao" class="flex-1 flex items-center justify-center gap-2 py-2 px-3 text-sm font-medium rounded-md transition-all ${currentMode === 'evolucao' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}">
          <i data-lucide="book-open" class="w-4 h-4"></i> Evolução
        </button>
        <button data-mode="operacao" class="flex-1 flex items-center justify-center gap-2 py-2 px-3 text-sm font-medium rounded-md transition-all ${currentMode === 'operacao' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}">
          <i data-lucide="activity" class="w-4 h-4"></i> Operações
        </button>
      </div>

      <!-- Search Bar -->
      <div class="relative">
        <i data-lucide="search" class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"></i>
        <input id="search-input" type="text" placeholder="Buscar conceitos..." value="${searchQuery}" class="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" />
      </div>
    </div>

    <div class="flex-1 overflow-y-auto p-3 space-y-1">
  `;

  if (!hasConcepts) {
    html += `<div class="text-center py-8 text-gray-500 text-sm">Nenhum conceito encontrado.</div>`;
  } else {
    Object.entries(groups).forEach(([category, subcategories]) => {
      const isExpanded = expandedCategories[category];
      html += `
        <div class="mb-2">
          <button data-category="${category}" class="w-full flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg transition-colors group">
            <span class="font-semibold text-gray-800 text-sm">${category}</span>
            <i data-lucide="${isExpanded ? 'chevron-down' : 'chevron-right'}" class="w-4 h-4 text-gray-400 group-hover:text-gray-600"></i>
          </button>
      `;

      if (isExpanded) {
        html += `<div class="pl-2 pr-1 mt-1 space-y-4 pb-2">`;
        Object.entries(subcategories).forEach(([subcategory, concepts]) => {
          html += `
            <div>
              <h4 class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 pl-2">${subcategory}</h4>
              <div class="space-y-1.5">
          `;
          concepts.forEach(concept => {
            const bgClass = currentMode === 'evolucao' ? 'bg-blue-50/50 border-blue-100 hover:bg-blue-50 hover:border-blue-200' : 'bg-emerald-50/50 border-emerald-100 hover:bg-emerald-50 hover:border-emerald-200';
            html += `
              <div data-concept-id="${concept.id}" draggable="true" class="group relative flex flex-col p-2.5 rounded-lg border cursor-grab transition-all hover:shadow-sm ${bgClass}">
                <div class="flex items-start">
                  <i data-lucide="grip-vertical" class="w-4 h-4 text-gray-400 mr-2 shrink-0 mt-0.5"></i>
                  <div class="flex-1 min-w-0">
                    <span class="text-sm font-medium text-gray-800 block truncate">${concept.title}</span>
                    ${concept.prerequisite ? `<span class="inline-block mt-1 px-1.5 py-0.5 bg-gray-200 text-gray-600 text-[10px] rounded font-medium">Pré: ${concept.prerequisite}</span>` : ''}
                  </div>
                  ${concept.notes ? `<div class="shrink-0 ml-2 text-gray-400 group-hover:text-gray-600" title="${concept.notes}"><i data-lucide="info" class="w-4 h-4"></i></div>` : ''}
                </div>
              </div>
            `;
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
  
  // Re-initialize icons for newly added HTML
  createIcons({
    icons: {
      BookOpen,
      Activity,
      Search,
      ChevronDown,
      ChevronRight,
      GripVertical,
      Info,
    }
  });
  
  // Re-focus input if it was focused
  const searchInput = document.getElementById('search-input') as HTMLInputElement;
  if (searchInput && wasSearchFocused) {
    searchInput.focus();
    const len = searchInput.value.length;
    searchInput.setSelectionRange(len, len);
  }
}
