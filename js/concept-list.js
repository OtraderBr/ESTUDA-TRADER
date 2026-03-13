// js/concept-list.js
import { store } from './state.js';
import { cn } from './utils.js';
import { AVAILABLE_TAGS } from './tags.js';

export function renderConceptList(container, state) {
    const { concepts } = state;
    let searchTerm = store.getState().conceptSearchTerm || '';
    let filterMacro = store.getState().conceptFilterMacro || 'Todos';
    let filterABC = store.getState().conceptFilterABC || 'Todos';
    let filterTag = store.getState().conceptFilterTag || 'Todos';

    const filteredConcepts = concepts.filter(c => {
        const lower = searchTerm.toLowerCase();
        const matchesSearch = !lower ||
            c.name.toLowerCase().includes(lower) ||
            c.category.toLowerCase().includes(lower) ||
            (c.moduloCurso || '').toLowerCase().includes(lower) ||
            (c.aulaCurso || '').toLowerCase().includes(lower);
        const matchesMacro = filterMacro === 'Todos' || c.macroCategory === filterMacro;
        const matchesABC = filterABC === 'Todos' || (c.abcCategory || 'C') === filterABC;
        const matchesTag = filterTag === 'Todos' || (c.tags || []).includes(filterTag);
        return matchesSearch && matchesMacro && matchesABC && matchesTag;
    });

    const getCategoryColor = (cat) => {
        if (cat === 'A') return 'text-emerald-600 bg-emerald-50 border-emerald-200';
        if (cat === 'B') return 'text-amber-600 bg-amber-50 border-amber-200';
        return 'text-red-600 bg-red-50 border-red-200';
    };

    const macroCategories = ['Fundamento', 'Operacional', 'Regras', 'Probabilidades', 'Outros'];

    container.innerHTML = `
    <div class="p-6 max-w-5xl mx-auto h-full flex flex-col" id="concept-list-content">
      <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-5">
        <h1 class="text-xl font-bold text-zinc-900">Conceitos</h1>
        
        <div class="flex flex-wrap gap-2 w-full md:w-auto">
          <div class="relative flex-1 sm:w-56">
            <i data-lucide="search" class="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2"></i>
            <input 
              type="text" 
              id="concept-search"
              placeholder="Buscar..." 
              value="${searchTerm}"
              class="bg-white border border-zinc-200 text-zinc-800 text-xs rounded-lg pl-8 pr-3 py-2 w-full focus:outline-none focus:border-zinc-400 transition-colors"
            />
          </div>
          <select id="macro-filter" class="bg-white border border-zinc-200 text-zinc-600 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-zinc-400 cursor-pointer">
            <option value="Todos" ${filterMacro === 'Todos' ? 'selected' : ''}>Todas Classes</option>
            ${macroCategories.map(m => `<option value="${m}" ${filterMacro === m ? 'selected' : ''}>${m}</option>`).join('')}
          </select>
          <select id="abc-filter" class="bg-white border border-zinc-200 text-zinc-600 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-zinc-400 cursor-pointer">
            <option value="Todos" ${filterABC === 'Todos' ? 'selected' : ''}>Todos ABC</option>
            <option value="A" ${filterABC === 'A' ? 'selected' : ''}>Cat. A</option>
            <option value="B" ${filterABC === 'B' ? 'selected' : ''}>Cat. B</option>
            <option value="C" ${filterABC === 'C' ? 'selected' : ''}>Cat. C</option>
          </select>
          <select id="tag-filter" class="bg-white border border-zinc-200 text-zinc-600 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-zinc-400 cursor-pointer">
            <option value="Todos" ${filterTag === 'Todos' ? 'selected' : ''}>Todas Tags</option>
            ${AVAILABLE_TAGS.map(t => `<option value="${t.id}" ${filterTag === t.id ? 'selected' : ''}>${t.label}</option>`).join('')}
          </select>
        </div>
      </div>

      <div class="flex-1 overflow-y-auto space-y-1 pb-20">
        ${filteredConcepts.map(concept => `
          <button
            class="concept-list-item w-full text-left bg-white border border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50 px-4 py-3 rounded-lg transition-all flex items-center gap-4 group"
            data-id="${concept.id}"
          >
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-0.5">
                <span class="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">${concept.macroCategory || 'Fundamento'}</span>
                <span class="text-zinc-300">/</span>
                <span class="text-[10px] font-medium text-zinc-400">${concept.category}</span>
              </div>
              <h3 class="text-sm font-medium text-zinc-800 group-hover:text-zinc-900 truncate">${concept.name}</h3>
            </div>

            <div class="flex items-center gap-4 shrink-0">
              <div class="hidden md:block text-right">
                <div class="text-xs font-semibold text-zinc-600">${concept.masteryPercentage || 0}%</div>
              </div>
              <span class="text-[10px] font-bold px-2 py-0.5 rounded border ${getCategoryColor(concept.abcCategory || 'C')}">${concept.abcCategory || 'C'}</span>
              <i data-lucide="chevron-right" class="w-3.5 h-3.5 text-zinc-300 group-hover:text-zinc-500 transition-colors"></i>
            </div>
          </button>
        `).join('')}
        
        ${filteredConcepts.length === 0 ? `
          <div class="text-center py-12 text-zinc-400 bg-zinc-50 border border-zinc-200 rounded-xl border-dashed">
            <p class="text-sm font-medium">Nenhum conceito encontrado.</p>
          </div>
        ` : ''}
      </div>
    </div>
  `;

    if (window.lucide) window.lucide.createIcons();

    container.querySelectorAll('.concept-list-item').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            store.setState({ selectedConceptId: id });
        });
    });

    const searchInput = document.getElementById('concept-search');
    const macroSelect = document.getElementById('macro-filter');
    const abcSelect = document.getElementById('abc-filter');
    const tagSelect = document.getElementById('tag-filter');

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
    tagSelect?.addEventListener('change', (e) => {
        store.setState({ conceptFilterTag: e.target.value });
    });

    if (isFocused) {
        setTimeout(() => document.getElementById('concept-search')?.focus(), 0);
    }
}
