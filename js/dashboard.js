// js/dashboard.js
import { store } from './state.js';
import { cn } from './utils.js';

export function renderDashboard(container, state) {
    const { concepts, sessions } = state;
    let searchTerm = store.getState().dashboardSearchTerm || '';

    const unlockedConcepts = concepts.filter(c => {
        if ((c.masteryPercentage || 0) >= 85) return false; // Mastered (Category A)
        if (c.prerequisite === 'Nenhum' || !c.prerequisite) return true;
        const prereq = concepts.find(p => p.name === c.prerequisite);
        return prereq && ((prereq.masteryPercentage || 0) >= 50 || prereq.level >= 7);
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todaysSession = [...unlockedConcepts].filter(c => {
        if (!c.nextReview) return true; // Never studied
        const reviewDate = new Date(c.nextReview);
        reviewDate.setHours(0, 0, 0, 0);
        return reviewDate <= today;
    }).sort((a, b) => {
        const impWeight = { 'Alta': 3, 'Média': 2, 'Baixa': 1, undefined: 2 };
        const weightA = impWeight[a.importance] || 2;
        const weightB = impWeight[b.importance] || 2;
        if (weightA !== weightB) return weightB - weightA;
        return (a.masteryPercentage || 0) - (b.masteryPercentage || 0);
    }).slice(0, 3);

    const masteredCount = concepts.filter(c => (c.masteryPercentage || 0) >= 85).length;
    const inProgressCount = concepts.filter(c => (c.masteryPercentage || 0) > 0 && (c.masteryPercentage || 0) < 85).length;

    const filteredConcepts = concepts.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.macroCategory.toLowerCase().includes(searchTerm.toLowerCase())
    );

    function getCategoryColor(cat) {
        if (cat === 'A') return 'text-emerald-600 bg-emerald-600/10 border-emerald-600/20';
        if (cat === 'B') return 'text-amber-600 bg-amber-600/10 border-amber-600/20';
        return 'text-red-600 bg-red-600/10 border-red-600/20';
    }

    const pendingSessions = sessions.filter(s => !s.completed).length;

    const getPercentageColor = (cat) => {
        if (cat === 'A') return "bg-emerald-500";
        if (cat === 'B') return "bg-amber-500";
        return "bg-red-500";
    };

    container.innerHTML = `
    <div class="p-8 max-w-6xl mx-auto space-y-10 pb-24" id="dashboard-content">
      <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 class="text-3xl font-bold text-zinc-900 tracking-tight">Visão Geral dos Estudos</h1>
          <p class="text-zinc-500 mt-1">Acompanhe seu progresso e planeje suas próximas sessões.</p>
        </div>
      </div>
      
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <div class="bg-white border border-zinc-200 p-6 rounded-3xl flex flex-col justify-between shadow-sm hover:border-zinc-300 transition-colors">
          <div class="flex items-center gap-3 text-emerald-500 mb-6">
            <div class="p-2.5 bg-emerald-600/10 rounded-xl border border-emerald-600/20">
              <i data-lucide="check-circle-2" class="w-5 h-5"></i>
            </div>
            <h3 class="font-semibold text-zinc-700">Dominados (Cat. A)</h3>
          </div>
          <div class="flex items-end justify-between">
            <p class="text-5xl font-bold text-zinc-900 tracking-tight">${masteredCount}</p>
            <span class="text-sm font-medium text-zinc-500 mb-1.5 uppercase tracking-wider">conceitos</span>
          </div>
        </div>
        
        <div class="bg-white border border-zinc-200 p-6 rounded-3xl flex flex-col justify-between shadow-sm hover:border-zinc-300 transition-colors">
          <div class="flex items-center gap-3 text-amber-500 mb-6">
            <div class="p-2.5 bg-amber-600/10 rounded-xl border border-amber-600/20">
              <i data-lucide="activity" class="w-5 h-5"></i>
            </div>
            <h3 class="font-semibold text-zinc-700">Em Progresso (Cat. B)</h3>
          </div>
          <div class="flex items-end justify-between">
            <p class="text-5xl font-bold text-zinc-900 tracking-tight">${inProgressCount}</p>
            <span class="text-sm font-medium text-zinc-500 mb-1.5 uppercase tracking-wider">conceitos</span>
          </div>
        </div>
        
        <div class="bg-white border border-zinc-200 p-6 rounded-3xl flex flex-col justify-between shadow-sm hover:border-zinc-300 transition-colors">
          <div class="flex items-center gap-3 text-red-500 mb-6">
            <div class="p-2.5 bg-red-600/10 rounded-xl border border-red-600/20">
              <i data-lucide="target" class="w-5 h-5"></i>
            </div>
            <h3 class="font-semibold text-zinc-700">Foco Atual (Cat. C)</h3>
          </div>
          <div class="flex items-end justify-between">
            <p class="text-5xl font-bold text-zinc-900 tracking-tight">${unlockedConcepts.length}</p>
            <span class="text-sm font-medium text-zinc-500 mb-1.5 uppercase tracking-wider">conceitos</span>
          </div>
        </div>
        
        <div class="bg-white border border-zinc-200 p-6 rounded-3xl flex flex-col justify-between shadow-sm hover:border-zinc-300 transition-colors">
          <div class="flex items-center gap-3 text-blue-500 mb-6">
            <div class="p-2.5 bg-blue-600/10 rounded-xl border border-blue-600/20">
              <i data-lucide="clock" class="w-5 h-5"></i>
            </div>
            <h3 class="font-semibold text-zinc-700">Sessões Pendentes</h3>
          </div>
          <div class="flex items-end justify-between">
            <p class="text-5xl font-bold text-zinc-900 tracking-tight">${pendingSessions}</p>
            <span class="text-sm font-medium text-zinc-500 mb-1.5 uppercase tracking-wider">sessões</span>
          </div>
        </div>
      </div>

      ${todaysSession.length > 0 ? `
        <div class="relative overflow-hidden bg-white border border-emerald-600/20 p-8 md:p-10 rounded-3xl shadow-lg">
          <div class="absolute top-0 right-0 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>
          <div class="absolute bottom-0 left-0 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/3 pointer-events-none"></div>
          
          <div class="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div>
              <h2 class="text-2xl font-bold text-emerald-600 flex items-center gap-3">
                <i data-lucide="calendar" class="w-7 h-7"></i>
                Sessão Recomendada para Hoje
              </h2>
              <p class="text-emerald-500/70 mt-2 font-medium">
                Baseado no Método ABC e no seu histórico de revisões.
              </p>
            </div>
          </div>
          
          <div class="grid grid-cols-1 md:grid-cols-3 gap-5 relative z-10">
            ${todaysSession.map(concept => `
              <button
                class="concept-card text-left bg-zinc-50/80 border border-emerald-600/20 hover:border-emerald-500/50 hover:bg-zinc-50 p-6 rounded-2xl transition-all group flex flex-col h-full backdrop-blur-md shadow-sm"
                data-id="${concept.id}"
              >
                <div class="flex justify-between items-start mb-4">
                  <div class="flex flex-wrap gap-2">
                    <div class="text-xs font-bold text-emerald-500/80 uppercase tracking-wider bg-emerald-600/10 px-2.5 py-1 rounded-md border border-emerald-600/20">
                      ${concept.macroCategory}
                    </div>
                    ${concept.probabilidade ? `<div class="text-xs font-bold text-blue-500/80 uppercase tracking-wider bg-blue-600/10 px-2.5 py-1 rounded-md border border-blue-600/20"><i data-lucide="percent" class="w-3 h-3 inline"></i> ${concept.probabilidade}</div>` : ''}
                  </div>
                  ${concept.importance === 'Alta' ? `<i data-lucide="alert-circle" class="w-5 h-5 text-red-600"></i>` : ''}
                </div>
                <h3 class="text-xl font-semibold text-zinc-800 group-hover:text-emerald-600 transition-colors mb-6 flex-1">${concept.name}</h3>
                <div class="flex items-center justify-between w-full pt-4 border-t border-zinc-200/50">
                  <div class="text-xs font-bold px-3 py-1.5 rounded-lg border ${getCategoryColor(concept.abcCategory || 'C')}">
                    Cat. ${concept.abcCategory || 'C'}
                  </div>
                  <div class="text-xs text-zinc-500 font-medium flex items-center gap-1.5">
                    ${concept.masteryPercentage || 0}% Retenção
                    <div class="w-6 h-6 rounded-full bg-white border border-zinc-200 flex items-center justify-center group-hover:bg-emerald-600/10 group-hover:border-emerald-500/30 transition-colors ml-1">
                      <i data-lucide="chevron-right" class="w-3 h-3 text-zinc-500 group-hover:text-emerald-600 transition-colors"></i>
                    </div>
                  </div>
                </div>
              </button>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <div>
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <h2 class="text-2xl font-bold text-zinc-900 flex items-center gap-3">
            <i data-lucide="layers" class="w-6 h-6 text-emerald-500"></i>
            Todos os Conceitos
          </h2>
          <div class="relative">
            <i data-lucide="search" class="w-4 h-4 text-zinc-500 absolute left-4 top-1/2 -translate-y-1/2"></i>
            <input 
              type="text" 
              id="dashboard-search"
              placeholder="Buscar conceito..." 
              value="${searchTerm}"
              class="bg-white border border-zinc-200 text-zinc-800 text-sm rounded-xl pl-10 pr-4 py-3 w-full sm:w-72 focus:outline-none focus:border-emerald-500 transition-colors shadow-sm"
            />
          </div>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          ${filteredConcepts.length > 0 ? filteredConcepts.map(concept => `
            <button
              class="concept-card text-left bg-white border border-zinc-200 hover:border-zinc-300 p-6 rounded-3xl transition-all group flex flex-col h-full shadow-sm hover:shadow-md"
              data-id="${concept.id}"
            >
              <div class="flex justify-between items-start mb-4">
                <div class="flex flex-wrap gap-2">
                  <div class="text-xs font-semibold text-zinc-500 uppercase tracking-wider px-2 py-1 bg-zinc-100 rounded-md border border-zinc-200">${concept.macroCategory}</div>
                  <div class="text-xs font-semibold text-zinc-500 uppercase tracking-wider px-2 py-1 bg-zinc-100 rounded-md border border-zinc-200">${concept.category}</div>
                  ${concept.probabilidade ? `<div class="text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-200 uppercase tracking-wider px-2 py-1 rounded-md flex items-center gap-1"><i data-lucide="bar-chart-2" class="w-3 h-3"></i> ${concept.probabilidade}</div>` : ''}
                </div>
                <div class="text-xs font-bold px-3 py-1.5 rounded-lg border ${getCategoryColor(concept.abcCategory || 'C')}">
                  ${concept.abcCategory || 'C'}
                </div>
              </div>
              <h3 class="text-lg font-semibold text-zinc-800 group-hover:text-emerald-600 transition-colors mb-6 flex-1">${concept.name}</h3>
              
              <div class="w-full space-y-3">
                <div class="flex justify-between text-xs font-medium text-zinc-500">
                  <span>Retenção: ${concept.masteryPercentage || 0}%</span>
                  <span>${concept.nextReview ? `Revisar: ${new Date(concept.nextReview).toLocaleDateString()}` : 'Não estudado'}</span>
                </div>
                <div class="h-2 w-full bg-zinc-50 rounded-full overflow-hidden border border-zinc-200">
                  <div 
                    class="h-full transition-all ${getPercentageColor(concept.abcCategory || 'C')}"
                    style="width: ${concept.masteryPercentage || 0}%"
                  ></div>
                </div>
              </div>
            </button>
          `).join('') : `
            <div class="col-span-full text-center py-16 text-zinc-500 bg-white/50 border border-zinc-200 rounded-3xl border-dashed">
              <i data-lucide="book-open" class="w-16 h-16 mx-auto mb-4 text-zinc-500 opacity-50"></i>
              <p class="text-lg font-medium text-zinc-500">Nenhum conceito encontrado.</p>
              <p class="text-sm mt-2">Tente ajustar seus filtros de busca.</p>
            </div>
          `}
        </div>
      </div>
    </div>
  `;

    if (window.lucide) window.lucide.createIcons();

    // Atrela os eventos de clique do componente
    container.querySelectorAll('.concept-card').forEach(card => {
        card.addEventListener('click', (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            store.setState({ selectedConceptId: id });
        });
    });

    const searchInput = document.getElementById('dashboard-search');
    if (searchInput) {
        // Foca caso já tivessemos algo buscando para nao perder foco do usuario a cada render
        let isFocused = document.activeElement === searchInput;
        searchInput.addEventListener('input', (e) => {
            store.setState({ dashboardSearchTerm: e.target.value });
        });
        // O re-render vai acontecer pelo Subscribe mas precisamos devolver foco
        if (isFocused) {
            setTimeout(() => document.getElementById('dashboard-search')?.focus(), 0);
        }
    }
}
