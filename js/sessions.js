// js/sessions.js
import { store } from './state.js';
import { addSessionAction, toggleSessionComplete, deleteSession } from './engine.js';
import { cn } from './utils.js';

let isCreating = false;
let selectedConceptIds = [];

export function renderSessions(container, state) {
    const { sessions, concepts } = state;
    let conceptSearch = store.getState().sessionConceptSearch || '';

    const sortedSessions = [...sessions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const filteredConcepts = concepts.filter(c =>
        c.name.toLowerCase().includes(conceptSearch.toLowerCase()) ||
        c.category.toLowerCase().includes(conceptSearch.toLowerCase())
    );

    const getSessionTypeColor = (type) => {
        if (type === 'Estudo') return "bg-blue-600/10 text-blue-600 border-blue-600/20";
        if (type === 'Revisão') return "bg-amber-600/10 text-amber-600 border-amber-600/20";
        return "bg-purple-600/10 text-purple-600 border-purple-600/20";
    };

    container.innerHTML = `
    <div class="p-8 max-w-5xl mx-auto h-full overflow-y-auto pb-24" id="sessions-content">
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 class="text-3xl font-bold text-zinc-900">Sessões de Estudo</h1>
          <p class="text-zinc-500 mt-1">Planeje e acompanhe suas sessões de estudo, revisão e prática.</p>
        </div>
        <button 
          id="newSessionBtn"
          class="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl font-medium transition-colors shadow-sm"
        >
          <i data-lucide="plus" class="w-5 h-5"></i>
          Nova Sessão
        </button>
      </div>

      ${isCreating ? `
        <div class="bg-white border border-zinc-200 rounded-3xl p-6 md:p-8 mb-8 shadow-sm">
          <h2 class="text-xl font-semibold text-zinc-900 mb-6">Criar Nova Sessão</h2>
          
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div>
              <label class="block text-sm font-medium text-zinc-700 mb-2">Título da Sessão</label>
              <input 
                type="text" 
                id="newSessionTitle"
                placeholder="Ex: Revisão de Tendências"
                class="w-full bg-zinc-50 border border-zinc-200 text-zinc-800 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-zinc-700 mb-2">Data</label>
              <input 
                type="date" 
                id="newSessionDate"
                class="w-full bg-zinc-50 border border-zinc-200 text-zinc-800 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-zinc-700 mb-2">Tipo de Sessão</label>
              <select 
                id="newSessionType"
                class="w-full bg-zinc-50 border border-zinc-200 text-zinc-800 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 transition-colors"
              >
                <option value="Estudo">Estudo (Novo Conteúdo)</option>
                <option value="Revisão">Revisão (Flashcards/Resumo)</option>
                <option value="Prática">Prática (Simulados/Gráficos)</option>
              </select>
            </div>
          </div>

          <div class="mb-8">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <label class="block text-sm font-medium text-zinc-700">
                Conceitos Vinculados <span class="text-emerald-500 ml-1">(${selectedConceptIds.length} selecionados)</span>
              </label>
              <div class="relative">
                <i data-lucide="search" class="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2"></i>
                <input 
                  type="text" 
                  id="conceptSearchInput"
                  placeholder="Buscar conceito..." 
                  value="${conceptSearch}"
                  class="bg-zinc-50 border border-zinc-200 text-zinc-800 text-sm rounded-xl pl-9 pr-4 py-2 focus:outline-none focus:border-emerald-500 w-full sm:w-64 transition-colors"
                />
              </div>
            </div>
            <div class="h-64 overflow-y-auto bg-zinc-50 border border-zinc-200 rounded-2xl p-3 space-y-1.5 custom-scrollbar">
              ${filteredConcepts.map(concept => {
        const isSelected = selectedConceptIds.includes(concept.id);
        return `
                  <button
                    class="concept-toggle-btn w-full text-left px-4 py-3 rounded-xl text-sm flex items-center justify-between transition-all ${isSelected ? "bg-emerald-600/10 text-emerald-600 border border-emerald-600/20" : "text-zinc-500 hover:bg-zinc-50 border border-transparent hover:border-zinc-200"}"
                    data-id="${concept.id}"
                  >
                    <div class="flex flex-col">
                      <span class="font-medium truncate">${concept.name}</span>
                      <span class="text-xs opacity-70 mt-0.5">${concept.category}</span>
                    </div>
                    ${isSelected ? `<i data-lucide="check-circle-2" class="w-5 h-5 shrink-0"></i>` : ''}
                  </button>
                `;
    }).join('')}
              ${filteredConcepts.length === 0 ? `
                <div class="text-center text-zinc-500 py-8 text-sm flex flex-col items-center">
                  <i data-lucide="book-open" class="w-8 h-8 mb-2 opacity-50"></i>
                  Nenhum conceito encontrado.
                </div>
              ` : ''}
            </div>
          </div>

          <div class="flex justify-end gap-3 pt-4 border-t border-zinc-200">
            <button 
              id="cancelSessionBtn"
              class="px-6 py-2.5 rounded-xl text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 font-medium transition-colors"
            >
              Cancelar
            </button>
            <button 
              id="saveSessionBtn"
              class="bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-200 disabled:text-zinc-500 text-white px-6 py-2.5 rounded-xl font-medium transition-colors shadow-sm"
              disabled
            >
              Salvar Sessão
            </button>
          </div>
        </div>
      ` : ''}

      <div class="space-y-4">
        ${sortedSessions.length === 0 ? `
          <div class="text-center py-16 text-zinc-500 bg-white/50 border border-zinc-200 rounded-3xl border-dashed">
            <i data-lucide="calendar-days" class="w-16 h-16 mx-auto mb-4 text-zinc-500"></i>
            <p class="text-lg font-medium text-zinc-500">Nenhuma sessão programada.</p>
            <p class="text-sm mt-2">Crie sua primeira sessão para organizar seus estudos.</p>
          </div>
        ` : `
          ${sortedSessions.map(session => {
        const isPast = new Date(session.date).getTime() < new Date().setHours(0, 0, 0, 0);
        const sessionConcepts = concepts.filter(c => session.conceptIds.includes(c.id));

        const borderClass = session.completed ? "border-emerald-500/30 opacity-75 bg-emerald-950/5" : isPast ? "border-red-500/30 bg-red-950/5" : "border-zinc-200 hover:border-zinc-300";

        return `
              <div class="bg-white border rounded-2xl p-5 md:p-6 flex flex-col sm:flex-row gap-5 transition-all hover:shadow-md ${borderClass}">
                <div class="flex items-start gap-4 flex-1">
                  <button 
                    class="toggle-complete-btn mt-1 shrink-0 transition-colors ${session.completed ? "text-emerald-500" : "text-zinc-500 hover:text-emerald-600"}"
                    data-id="${session.id}"
                  >
                    ${session.completed ? `<i data-lucide="check-circle-2" class="w-7 h-7"></i>` : `<i data-lucide="circle" class="w-7 h-7"></i>`}
                  </button>
                  
                  <div class="flex-1">
                    <div class="flex flex-wrap items-center gap-3 mb-2">
                      <h3 class="text-lg font-semibold ${session.completed ? "text-zinc-500 line-through" : "text-zinc-900"}">
                        ${session.title}
                      </h3>
                      <span class="text-xs font-semibold px-2.5 py-1 rounded-lg border ${getSessionTypeColor(session.type)}">
                        ${session.type}
                      </span>
                    </div>
                    <div class="text-sm text-zinc-500 mb-4 flex items-center gap-2 font-medium">
                      <i data-lucide="calendar-days" class="w-4 h-4 text-zinc-500"></i>
                      ${new Date(session.date).toLocaleDateString()}
                      ${isPast && !session.completed ? '<span class="text-red-600 ml-2 bg-red-600/10 px-2 py-0.5 rounded-md border border-red-600/20 text-xs">Atrasada</span>' : ''}
                    </div>
                    
                    <div class="flex flex-wrap gap-2">
                      ${sessionConcepts.map(c => `
                        <div class="flex items-center gap-1.5 bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-1.5 text-xs text-zinc-700 font-medium">
                          <i data-lucide="book-open" class="w-3.5 h-3.5 text-zinc-500"></i>
                          ${c.name}
                        </div>
                      `).join('')}
                    </div>
                  </div>
                </div>
                
                <div class="flex items-start justify-end sm:flex-col gap-2 shrink-0">
                  <button 
                    class="delete-session-btn p-2.5 text-zinc-500 hover:text-red-600 hover:bg-red-600/10 rounded-xl transition-colors"
                    title="Excluir Sessão"
                    data-id="${session.id}"
                  >
                    <i data-lucide="trash-2" class="w-5 h-5"></i>
                  </button>
                </div>
              </div>
            `;
    }).join('')}
        `}
      </div>
    </div>
  `;

    if (window.lucide) window.lucide.createIcons();

    // Create Toggle
    document.getElementById('newSessionBtn')?.addEventListener('click', () => {
        isCreating = true;
        renderSessions(container, state);
    });

    if (isCreating) {
        const cancelBtn = document.getElementById('cancelSessionBtn');
        cancelBtn?.addEventListener('click', () => {
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

        // Attempt re-hydration of values if re-rendering while creating
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

    // Session Actions
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
