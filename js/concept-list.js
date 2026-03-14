// js/concept-list.js
import { store } from './state.js';
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
        const matchesABC = filterABC === 'Todos' || (c.abcCategory || 'B') === filterABC;
        const matchesTag = filterTag === 'Todos' || (c.tags || []).includes(filterTag);
        return matchesSearch && matchesMacro && matchesABC && matchesTag;
    });

    const getCategoryColor = (cat) => {
        if (cat === 'A') return 'text-indigo-600 bg-indigo-50 border-indigo-200';
        if (cat === 'B') return 'text-emerald-600 bg-emerald-50 border-emerald-200';
        if (cat === 'C') return 'text-amber-600 bg-amber-50 border-amber-200';
        if (cat === 'D') return 'text-violet-600 bg-violet-50 border-violet-200';
        if (cat === 'E') return 'text-zinc-500 bg-zinc-100 border-zinc-300';
        return 'text-emerald-600 bg-emerald-50 border-emerald-200';
    };

    const getMasteryDisplay = (c) => c.abcCategory === 'D' ? 100 : (c.masteryPercentage || 0);

    const macroCategories = ['Fundamento', 'Operacional', 'Regras', 'Probabilidades', 'Outros'];

    container.innerHTML = `
    <div class="p-4 md:p-6 max-w-5xl mx-auto h-full flex flex-col" id="concept-list-content">
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-5">
        <h1 class="text-xl font-bold text-zinc-900">Conceitos</h1>

        <div class="flex flex-wrap gap-2 w-full sm:w-auto">
          <div class="relative flex-1 min-w-[140px]">
            <i data-lucide="search" class="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2"></i>
            <input
              type="text"
              id="concept-search"
              placeholder="Buscar..."
              value="${searchTerm}"
              class="bg-white border border-zinc-200 text-zinc-800 text-xs rounded-lg pl-8 pr-3 py-2 w-full focus:outline-none focus:border-zinc-400 transition-colors shadow-sm"
            />
          </div>
          <select id="macro-filter" class="bg-white border border-zinc-200 text-zinc-600 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-zinc-400 cursor-pointer shadow-sm">
            <option value="Todos" ${filterMacro === 'Todos' ? 'selected' : ''}>Todas Classes</option>
            ${macroCategories.map(m => `<option value="${m}" ${filterMacro === m ? 'selected' : ''}>${m}</option>`).join('')}
          </select>
          <select id="abc-filter" class="bg-white border border-zinc-200 text-zinc-600 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-zinc-400 cursor-pointer shadow-sm">
            <option value="Todos" ${filterABC === 'Todos' ? 'selected' : ''}>Categoria</option>
            <option value="A" ${filterABC === 'A' ? 'selected' : ''}>A — Prioritário</option>
            <option value="B" ${filterABC === 'B' ? 'selected' : ''}>B — Em Progresso</option>
            <option value="C" ${filterABC === 'C' ? 'selected' : ''}>C — Suporte</option>
            <option value="D" ${filterABC === 'D' ? 'selected' : ''}>D — Validado</option>
            <option value="E" ${filterABC === 'E' ? 'selected' : ''}>E — Inativo</option>
          </select>
          <select id="tag-filter" class="bg-white border border-zinc-200 text-zinc-600 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-zinc-400 cursor-pointer shadow-sm">
            <option value="Todos" ${filterTag === 'Todos' ? 'selected' : ''}>Tags</option>
            ${AVAILABLE_TAGS.map(t => `<option value="${t.id}" ${filterTag === t.id ? 'selected' : ''}>${t.label}</option>`).join('')}
          </select>
        </div>
      </div>

      <div class="text-xs text-zinc-400 mb-3">${filteredConcepts.length} conceito${filteredConcepts.length !== 1 ? 's' : ''}</div>

      <div class="flex-1 overflow-y-auto space-y-1.5 pb-20">
        ${filteredConcepts.map(concept => {
            const mastery = getMasteryDisplay(concept);
            const abc = concept.abcCategory || 'B';
            const barColor = abc === 'A' ? 'bg-indigo-500' : abc === 'B' ? 'bg-emerald-500' : abc === 'C' ? 'bg-amber-500' : abc === 'D' ? 'bg-violet-500' : 'bg-zinc-400';
            const masteryColor = mastery >= 85 ? 'text-emerald-600' : mastery >= 50 ? 'text-amber-500' : mastery > 0 ? 'text-red-500' : 'text-zinc-400';
            return `
          <button
            class="concept-list-item w-full text-left bg-white border border-zinc-200 hover:border-zinc-300 hover:shadow-md px-4 py-3 rounded-xl transition-all flex items-center gap-4 group shadow-sm"
            data-id="${concept.id}"
          >
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-1.5 mb-1">
                <span class="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">${concept.macroCategory || 'Fundamento'}</span>
                <span class="text-zinc-300">·</span>
                <span class="text-[10px] text-zinc-400">${concept.category}</span>
              </div>
              <h3 class="text-sm font-medium text-zinc-800 group-hover:text-zinc-900 truncate leading-snug">${concept.name}</h3>
              <!-- Barra de progresso -->
              <div class="mt-2 h-1 w-full bg-zinc-100 rounded-full overflow-hidden">
                <div class="h-full ${barColor} rounded-full transition-all" style="width:${mastery}%"></div>
              </div>
            </div>

            <div class="flex items-center gap-3 shrink-0">
              <span class="hidden sm:block text-xs font-bold ${masteryColor}">${mastery}%</span>
              <span class="text-[10px] font-bold px-2 py-0.5 rounded border ${getCategoryColor(abc)}">${abc}</span>
              ${concept.notesList?.length > 0 ? `<span class="hidden sm:flex items-center gap-1 text-[10px] text-zinc-400"><i data-lucide="message-square" class="w-3 h-3"></i>${concept.notesList.length}</span>` : ''}
              <i data-lucide="chevron-right" class="w-3.5 h-3.5 text-zinc-300 group-hover:text-zinc-500 transition-colors"></i>
            </div>
          </button>
        `}).join('')}

        ${filteredConcepts.length === 0 ? `
          <div class="text-center py-16 text-zinc-400 bg-white border border-zinc-200 rounded-xl shadow-sm">
            <i data-lucide="search-x" class="w-10 h-10 mx-auto mb-3 opacity-30"></i>
            <p class="text-sm font-medium">Nenhum conceito encontrado.</p>
          </div>
        ` : ''}
      </div>
    </div>
  `;

    if (window.lucide) window.lucide.createIcons();

    container.querySelectorAll('.concept-list-item').forEach(btn => {
        btn.addEventListener('click', (e) => {
            store.setState({ selectedConceptId: e.currentTarget.getAttribute('data-id') });
        });
    });

    const searchInput = document.getElementById('concept-search');
    const macroSelect = document.getElementById('macro-filter');
    const abcSelect = document.getElementById('abc-filter');
    const tagSelect = document.getElementById('tag-filter');

    const isFocused = document.activeElement === searchInput;

    searchInput?.addEventListener('input', (e) => store.setState({ conceptSearchTerm: e.target.value }));
    macroSelect?.addEventListener('change', (e) => store.setState({ conceptFilterMacro: e.target.value }));
    abcSelect?.addEventListener('change', (e) => store.setState({ conceptFilterABC: e.target.value }));
    tagSelect?.addEventListener('change', (e) => store.setState({ conceptFilterTag: e.target.value }));

    if (isFocused) setTimeout(() => document.getElementById('concept-search')?.focus(), 0);
}
