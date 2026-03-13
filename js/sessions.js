// js/sessions.js
import { store } from './state.js';
import { addSessionAction, toggleSessionComplete, deleteSession } from './engine.js';
import { cn } from './utils.js';

let isCreating = false;
let selectedConceptIds = [];

export function renderSessions(container, state) {
    const { sessions, concepts } = state;
    let conceptSearch = store.getState().sessionConceptSearch || '';
    let filterModulo = store.getState().sessionFilterModulo || 'Todos';

    const sortedSessions = [...sessions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const filteredConcepts = concepts.filter(c =>
        (c.name.toLowerCase().includes(conceptSearch.toLowerCase()) ||
        c.category.toLowerCase().includes(conceptSearch.toLowerCase())) &&
        (filterModulo === 'Todos' || c.moduloCurso === filterModulo)
    );

    const getSessionTypeColor = (type) => {
        if (type === 'Estudo') return "bg-blue-50 text-blue-700 border-blue-200";
        if (type === 'Revisão') return "bg-amber-50 text-amber-700 border-amber-200";
        return "bg-purple-50 text-purple-700 border-purple-200";
    };

    container.innerHTML = `
    <div class="p-6 max-w-4xl mx-auto h-full overflow-y-auto pb-20" id="sessions-content">
      <div class="flex items-center justify-between gap-4 mb-5">
        <h1 class="text-xl font-bold text-zinc-900">Sessões de Estudo</h1>
        <button 
          id="newSessionBtn"
          class="flex items-center gap-1.5 bg-zinc-900 hover:bg-zinc-800 text-white px-4 py-2 rounded-lg text-xs font-medium transition-colors"
        >
          <i data-lucide="plus" class="w-3.5 h-3.5"></i>
          Nova Sessão
        </button>
      </div>

      ${isCreating ? `
        <div class="bg-white border border-zinc-200 rounded-xl p-5 mb-5">
          <h2 class="text-sm font-semibold text-zinc-800 mb-4">Criar Nova Sessão</h2>
          
          <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            <div>
              <label class="block text-[10px] font-medium text-zinc-500 mb-1">Título</label>
              <input type="text" id="newSessionTitle" placeholder="Ex: Revisão de Tendências"
                class="w-full bg-white border border-zinc-200 text-zinc-700 rounded-md px-3 py-2 text-xs focus:outline-none focus:border-zinc-400" />
            </div>
            <div>
              <label class="block text-[10px] font-medium text-zinc-500 mb-1">Data</label>
              <input type="date" id="newSessionDate"
                class="w-full bg-white border border-zinc-200 text-zinc-700 rounded-md px-3 py-2 text-xs focus:outline-none focus:border-zinc-400" />
            </div>
            <div>
              <label class="block text-[10px] font-medium text-zinc-500 mb-1">Tipo</label>
              <select id="newSessionType" class="w-full bg-white border border-zinc-200 text-zinc-700 rounded-md px-3 py-2 text-xs focus:outline-none focus:border-zinc-400">
                <option value="Estudo">Estudo</option>
                <option value="Revisão">Revisão</option>
                <option value="Prática">Prática</option>
              </select>
            </div>
          </div>

          <div class="mb-4">
            <div class="flex items-center justify-between mb-2">
              <label class="text-[10px] font-medium text-zinc-500">
                Conceitos <span class="text-zinc-800 font-semibold">(${selectedConceptIds.length})</span>
              </label>
              <div class="flex gap-2">
                <select id="moduloFilterInput" class="bg-white border border-zinc-200 text-zinc-600 text-[10px] rounded px-2 py-1 focus:outline-none">
                  <option value="Todos" ${filterModulo === 'Todos' ? 'selected' : ''}>Todos</option>
                  <option value="01-07" ${filterModulo === '01-07' ? 'selected' : ''}>01-07</option>
                  <option value="08-11" ${filterModulo === '08-11' ? 'selected' : ''}>08-11</option>
                  <option value="12-18" ${filterModulo === '12-18' ? 'selected' : ''}>12-18</option>
                  <option value="19-29" ${filterModulo === '19-29' ? 'selected' : ''}>19-29</option>
                  <option value="30-36" ${filterModulo === '30-36' ? 'selected' : ''}>30-36</option>
                  <option value="37-42" ${filterModulo === '37-42' ? 'selected' : ''}>37-42</option>
                  <option value="43-46" ${filterModulo === '43-46' ? 'selected' : ''}>43-46</option>
                  <option value="47-50" ${filterModulo === '47-50' ? 'selected' : ''}>47-50</option>
                </select>
                <div class="relative w-48">
                  <i data-lucide="search" class="w-3 h-3 text-zinc-400 absolute left-2 top-1/2 -translate-y-1/2"></i>
                  <input type="text" id="conceptSearchInput" placeholder="Buscar..." value="${conceptSearch}"
                    class="bg-white border border-zinc-200 text-zinc-700 text-[10px] rounded pl-6 pr-2 py-1 focus:outline-none w-full" />
                </div>
              </div>
            </div>
            <div class="flex justify-end gap-2 mb-1.5">
                <button id="addAllBtn" class="text-[10px] font-semibold text-zinc-500 hover:text-zinc-800 transition-colors">Vincular Todos</button>
                <span class="text-zinc-300 text-[10px]">|</span>
                <button id="clearAllBtn" class="text-[10px] font-semibold text-red-500 hover:text-red-700 transition-colors">Limpar</button>
            </div>
            <div class="h-48 overflow-y-auto bg-zinc-50 border border-zinc-200 rounded-lg p-2 space-y-0.5">
              ${filteredConcepts.map(concept => {
        const isSelected = selectedConceptIds.includes(concept.id);
        return `
                  <button
                    class="concept-toggle-btn w-full text-left px-3 py-2 rounded-md text-xs flex items-center justify-between transition-all ${isSelected ? "bg-zinc-200 text-zinc-800 font-medium" : "text-zinc-500 hover:bg-zinc-100"}"
                    data-id="${concept.id}"
                  >
                    <span class="truncate">${concept.name}</span>
                    ${isSelected ? `<i data-lucide="check" class="w-3.5 h-3.5 shrink-0 text-zinc-600"></i>` : ''}
                  </button>
                `;
    }).join('')}
              ${filteredConcepts.length === 0 ? `
                <div class="text-center text-zinc-400 py-6 text-xs">Nenhum conceito encontrado.</div>
              ` : ''}
            </div>
          </div>

          <div class="flex justify-end gap-2 pt-3 border-t border-zinc-100">
            <button id="cancelSessionBtn" class="px-4 py-2 rounded-lg text-xs text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 font-medium transition-colors">Cancelar</button>
            <button id="saveSessionBtn" class="bg-zinc-900 hover:bg-zinc-800 disabled:bg-zinc-200 disabled:text-zinc-400 text-white px-4 py-2 rounded-lg text-xs font-medium transition-colors" disabled>Salvar</button>
          </div>
        </div>
      ` : ''}

      <div class="space-y-2">
        ${sortedSessions.length === 0 ? `
          <div class="text-center py-12 text-zinc-400 bg-zinc-50 border border-zinc-200 rounded-xl border-dashed">
            <p class="text-sm font-medium">Nenhuma sessão programada.</p>
            <p class="text-xs mt-1">Crie sua primeira sessão.</p>
          </div>
        ` : `
          ${sortedSessions.map(session => {
        const isPast = new Date(session.date).getTime() < new Date().setHours(0, 0, 0, 0);
        const sessionConcepts = concepts.filter(c => session.conceptIds.includes(c.id));
        const borderClass = session.completed ? "border-emerald-200 bg-emerald-50/30 opacity-70" : isPast ? "border-red-200 bg-red-50/30" : "border-zinc-200 hover:border-zinc-300";

        return `
              <div class="bg-white border rounded-lg px-4 py-3 flex items-center gap-4 transition-all ${borderClass}">
                <button class="toggle-complete-btn shrink-0 ${session.completed ? "text-emerald-500" : "text-zinc-300 hover:text-zinc-500"}" data-id="${session.id}">
                  ${session.completed ? `<i data-lucide="check-circle-2" class="w-5 h-5"></i>` : `<i data-lucide="circle" class="w-5 h-5"></i>`}
                </button>
                
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 mb-0.5">
                    <h3 class="text-sm font-medium ${session.completed ? "text-zinc-400 line-through" : "text-zinc-800"} truncate">${session.title}</h3>
                    <span class="text-[10px] font-semibold px-1.5 py-0.5 rounded border shrink-0 ${getSessionTypeColor(session.type)}">${session.type}</span>
                    ${isPast && !session.completed ? '<span class="text-[10px] font-semibold text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-200 shrink-0">Atrasada</span>' : ''}
                  </div>
                  <div class="flex items-center gap-2 text-[10px] text-zinc-400">
                    <span>${new Date(session.date).toLocaleDateString()}</span>
                    <span>·</span>
                    <span>${sessionConcepts.length} conceitos</span>
                  </div>
                </div>
                
                <button class="delete-session-btn p-1.5 text-zinc-300 hover:text-red-500 rounded transition-colors shrink-0" title="Excluir" data-id="${session.id}">
                  <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
              </div>
            `;
    }).join('')}
        `}
      </div>
    </div>
  `;

    if (window.lucide) window.lucide.createIcons();

    document.getElementById('newSessionBtn')?.addEventListener('click', () => {
        isCreating = true;
        renderSessions(container, state);
    });

    if (isCreating) {
        document.getElementById('cancelSessionBtn')?.addEventListener('click', () => {
            isCreating = false;
            selectedConceptIds = [];
            renderSessions(container, state);
        });

        const searchInput = document.getElementById('conceptSearchInput');
        let isFocused = document.activeElement === searchInput;
        searchInput?.addEventListener('input', (e) => {
            store.setState({ sessionConceptSearch: e.target.value });
        });
        if (isFocused) setTimeout(() => document.getElementById('conceptSearchInput')?.focus(), 0);

        document.getElementById('moduloFilterInput')?.addEventListener('change', (e) => {
            store.setState({ sessionFilterModulo: e.target.value });
        });

        document.getElementById('addAllBtn')?.addEventListener('click', () => {
            const idsToAdd = filteredConcepts.map(c => c.id);
            const uniqueIds = new Set([...selectedConceptIds, ...idsToAdd]);
            selectedConceptIds = Array.from(uniqueIds);
            renderSessions(container, state);
        });

        document.getElementById('clearAllBtn')?.addEventListener('click', () => {
            selectedConceptIds = [];
            renderSessions(container, state);
        });

        container.querySelectorAll('.concept-toggle-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                if (selectedConceptIds.includes(id)) {
                    selectedConceptIds = selectedConceptIds.filter(cId => cId !== id);
                } else {
                    selectedConceptIds.push(id);
                }
                renderSessions(container, state);
            });
        });

        const saveBtn = document.getElementById('saveSessionBtn');
        const titleInput = document.getElementById('newSessionTitle');
        const dateInput = document.getElementById('newSessionDate');
        const typeInput = document.getElementById('newSessionType');

        const updateSaveBtnState = () => {
            saveBtn.disabled = !titleInput.value.trim() || !dateInput.value || selectedConceptIds.length === 0;
        };

        titleInput?.addEventListener('input', updateSaveBtnState);
        dateInput?.addEventListener('input', updateSaveBtnState);

        if (store.getState()._tempTitle) titleInput.value = store.getState()._tempTitle;
        if (store.getState()._tempDate) dateInput.value = store.getState()._tempDate;
        if (store.getState()._tempType) typeInput.value = store.getState()._tempType;

        titleInput?.addEventListener('input', (e) => store.setState({ _tempTitle: e.target.value }));
        dateInput?.addEventListener('input', (e) => store.setState({ _tempDate: e.target.value }));
        typeInput?.addEventListener('change', (e) => store.setState({ _tempType: e.target.value }));

        updateSaveBtnState();

        saveBtn?.addEventListener('click', () => {
            if (!titleInput.value.trim() || !dateInput.value || selectedConceptIds.length === 0) return;
            addSessionAction(titleInput.value.trim(), typeInput.value, dateInput.value, [...selectedConceptIds]);
            isCreating = false;
            selectedConceptIds = [];
            store.setState({ _tempTitle: '', _tempDate: '', _tempType: '', sessionConceptSearch: '' });
        });
    }

    container.querySelectorAll('.toggle-complete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            toggleSessionComplete(e.currentTarget.getAttribute('data-id'));
        });
    });

    container.querySelectorAll('.delete-session-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            deleteSession(e.currentTarget.getAttribute('data-id'));
        });
    });
}
