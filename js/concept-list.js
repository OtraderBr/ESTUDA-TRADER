// js/concept-list.js
import { store } from './state.js';
import { cn } from './utils.js';

export function renderConceptList(container, state) {
    const { concepts } = state;
    let searchTerm = store.getState().conceptSearchTerm || '';
    let filterMacro = store.getState().conceptFilterMacro || 'Todos';
    let filterABC = store.getState().conceptFilterABC || 'Todos';

    const filteredConcepts = concepts.filter(c => {
        const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.category.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesMacro = filterMacro === 'Todos' || c.macroCategory === filterMacro;
        const matchesABC = filterABC === 'Todos' || (c.abcCategory || 'C') === filterABC;
        return matchesSearch && matchesMacro && matchesABC;
    });

    const getCategoryColor = (cat) => {
        if (cat === 'A') return 'text-emerald-600 bg-emerald-600/10 border-emerald-600/20';
        if (cat === 'B') return 'text-amber-600 bg-amber-600/10 border-amber-600/20';
        return 'text-red-600 bg-red-600/10 border-red-600/20';
    };

    const macroCategories = ['Fundamento', 'Operacional', 'Regras', 'Probabilidades', 'Outros'];

    container.innerHTML = `
    <div class="p-8 max-w-6xl mx-auto h-full flex flex-col" id="concept-list-content">
      <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
        <div>
          <h1 class="text-3xl font-bold text-zinc-900">Gestão de Conceitos</h1>
          <p class="text-zinc-500 mt-1">Navegue, filtre e acesse todos os conceitos do seu currículo.</p>
        </div>
        
        <div class="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <div class="relative flex-1 sm:w-72">
            <i data-lucide="search" class="w-4 h-4 text-zinc-500 absolute left-4 top-1/2 -translate-y-1/2"></i>
            <input 
              type="text" 
              id="concept-search"
              placeholder="Buscar conceito..." 
              value="${searchTerm}"
              class="bg-white border border-zinc-200 text-zinc-800 text-sm rounded-xl pl-10 pr-4 py-3 w-full focus:outline-none focus:border-emerald-500 transition-colors shadow-sm"
            />
          </div>
          <div class="flex gap-2">
            <div class="relative">
              <select 
                id="macro-filter"
                class="appearance-none bg-white border border-zinc-200 text-zinc-700 text-sm rounded-xl pl-4 pr-10 py-3 focus:outline-none focus:border-emerald-500 cursor-pointer shadow-sm transition-colors"
              >
                <option value="Todos" ${filterMacro === 'Todos' ? 'selected' : ''}>Todas as Classes</option>
                ${macroCategories.map(m => `<option value="${m}" ${filterMacro === m ? 'selected' : ''}>${m}</option>`).join('')}
              </select>
              <i data-lucide="filter" class="w-4 h-4 text-zinc-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"></i>
            </div>
            <div class="relative">
              <select 
                id="abc-filter"
                class="appearance-none bg-white border border-zinc-200 text-zinc-700 text-sm rounded-xl pl-4 pr-10 py-3 focus:outline-none focus:border-emerald-500 cursor-pointer shadow-sm transition-colors"
              >
                <option value="Todos" ${filterABC === 'Todos' ? 'selected' : ''}>Todos ABC</option>
                <option value="A" ${filterABC === 'A' ? 'selected' : ''}>Categoria A</option>
                <option value="B" ${filterABC === 'B' ? 'selected' : ''}>Categoria B</option>
                <option value="C" ${filterABC === 'C' ? 'selected' : ''}>Categoria C</option>
              </select>
              <i data-lucide="filter" class="w-4 h-4 text-zinc-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"></i>
            </div>
          </div>
        </div>
      </div>

      <div class="flex-1 overflow-y-auto pr-2 space-y-3 pb-24 custom-scrollbar">
        ${filteredConcepts.map(concept => `
          <button
            class="concept-list-item w-full text-left bg-white border border-zinc-200 hover:border-emerald-500/50 p-5 rounded-2xl transition-all group flex items-center gap-5 hover:shadow-md hover:bg-zinc-100/50"
            data-id="${concept.id}"
          >
            <div class="hidden sm:flex w-14 h-14 rounded-2xl bg-zinc-50 border border-zinc-200 items-center justify-center shrink-0 group-hover:bg-emerald-950/30 group-hover:border-emerald-500/30 transition-colors">
              <i data-lucide="layers" class="w-6 h-6 text-zinc-500 group-hover:text-emerald-600 transition-colors"></i>
            </div>
            
            <div class="flex-1 min-w-0">
              <div class="flex flex-wrap items-center gap-2 mb-1.5">
                <span class="text-xs font-semibold text-emerald-500 uppercase tracking-wider bg-emerald-600/10 px-2 py-0.5 rounded-md border border-emerald-600/20">
                  ${concept.macroCategory || 'Fundamento'}
                </span>
                <span class="text-xs font-medium text-zinc-500 px-2 py-0.5 rounded-md border border-zinc-200 bg-zinc-50">${concept.category}</span>
                ${concept.moduloCurso ? `<span class="text-xs font-medium text-zinc-400 border border-dashed border-zinc-200 px-2 py-0.5 rounded-md">Módulos: ${concept.moduloCurso}</span>` : ''}
              </div>
              <div class="flex items-center gap-2">
                <h3 class="text-lg font-semibold text-zinc-800 group-hover:text-emerald-600 transition-colors truncate">
                  ${concept.name}
                </h3>
                ${concept.probabilidade ? `<span class="text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-200 uppercase tracking-wider px-2 py-0.5 rounded-md flex items-center gap-1 shrink-0"><i data-lucide="bar-chart-2" class="w-3 h-3"></i> ${concept.probabilidade}</span>` : ''}
              </div>
            </div>

            <div class="flex items-center gap-6 shrink-0">
              <div class="hidden md:flex flex-col items-end">
                <div class="text-xs font-medium text-zinc-500 mb-1 uppercase tracking-wider">Retenção</div>
                <div class="text-sm font-bold text-zinc-700 bg-zinc-50 px-2.5 py-1 rounded-lg border border-zinc-200">
                  ${concept.masteryPercentage || 0}%
                </div>
              </div>
              
              <div class="${cn("text-xs font-bold px-3 py-1.5 rounded-lg border", getCategoryColor(concept.abcCategory || 'C'))}">
                Cat. ${concept.abcCategory || 'C'}
              </div>

              <div class="w-8 h-8 rounded-full bg-zinc-50 border border-zinc-200 flex items-center justify-center group-hover:bg-emerald-600/10 group-hover:border-emerald-500/30 transition-colors">
                <i data-lucide="chevron-right" class="w-4 h-4 text-zinc-500 group-hover:text-emerald-600 transition-colors"></i>
              </div>
            </div>
          </button>
        `).join('')}
        
        ${filteredConcepts.length === 0 ? `
          <div class="text-center py-16 text-zinc-500 bg-white/50 border border-zinc-200 rounded-3xl border-dashed">
            <i data-lucide="book-open" class="w-16 h-16 mx-auto mb-4 text-zinc-500 opacity-50"></i>
            <p class="text-lg font-medium text-zinc-500">Nenhum conceito encontrado.</p>
            <p class="text-sm mt-2">Tente ajustar seus filtros de busca.</p>
          </div>
        ` : ''}
      </div>
    </div>
  `;

    if (window.lucide) window.lucide.createIcons();

    // Atrela eventos de clique
    container.querySelectorAll('.concept-list-item').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            store.setState({ selectedConceptId: id });
        });
    });

    // Filters Event Listeners (with focus management)
    const searchInput = document.getElementById('concept-search');
    const macroSelect = document.getElementById('macro-filter');
    const abcSelect = document.getElementById('abc-filter');

    let isFocused = document.activeElement === searchInput;

    searchInput?.addEventListener('input', (e) => {
        store.setState({ conceptSearchTerm: e.target.value });
    });
    macroSelect?.addEventListener('change', (e) => {
        store.setState({ conceptFilterMacro: e.target.value });
    });
    abcSelect?.addEventListener('change', (e) => {
        store.setState({ conceptFilterABC: e.target.value });
    });

    if (isFocused) {
        setTimeout(() => document.getElementById('concept-search')?.focus(), 0);
    }
}
