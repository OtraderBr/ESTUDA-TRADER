// js/dashboard.js
import { store } from './state.js';
import { cn } from './utils.js';
import { fetchDailyPlan, fetchGapAnalysis } from './daily-plan.js';

export async function renderDashboard(container, state) {
    const { concepts, sessions } = state;
    let searchTerm = store.getState().dashboardSearchTerm || '';

    const unlockedConcepts = concepts.filter(c => {
        if ((c.masteryPercentage || 0) >= 85) return false;
        if (c.prerequisite === 'Nenhum' || !c.prerequisite) return true;
        const prereq = concepts.find(p => p.name === c.prerequisite);
        return prereq && ((prereq.masteryPercentage || 0) >= 50 || prereq.level >= 7);
    });

    // E = excluído de tudo; D = contado como dominado automaticamente
    const activeConcepts = concepts.filter(c => c.abcCategory !== 'E' && !(c.tags || []).includes('knowledge_only'));
    const masteredCount = activeConcepts.filter(c => c.abcCategory === 'D' || (c.masteryPercentage || 0) >= 85).length;
    const inProgressCount = activeConcepts.filter(c => c.abcCategory !== 'D' && (c.masteryPercentage || 0) > 0 && (c.masteryPercentage || 0) < 85).length;
    const pendingSessions = sessions.filter(s => !s.completed).length;

    const filteredConcepts = concepts.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.macroCategory.toLowerCase().includes(searchTerm.toLowerCase())
    );

    function getCategoryColor(cat) {
        if (cat === 'A') return 'text-indigo-600 bg-indigo-50 border-indigo-200';
        if (cat === 'B') return 'text-emerald-600 bg-emerald-50 border-emerald-200';
        if (cat === 'C') return 'text-amber-600 bg-amber-50 border-amber-200';
        if (cat === 'D') return 'text-violet-600 bg-violet-50 border-violet-200';
        if (cat === 'E') return 'text-zinc-500 bg-zinc-100 border-zinc-300';
        return 'text-emerald-600 bg-emerald-50 border-emerald-200';
    }

    const getBarColor = (cat) => {
        if (cat === 'A') return "bg-indigo-500";
        if (cat === 'B') return "bg-emerald-500";
        if (cat === 'C') return "bg-amber-500";
        if (cat === 'D') return "bg-violet-500";
        if (cat === 'E') return "bg-zinc-400";
        return "bg-emerald-500";
    };

    const [dailyPlan, gapAnalysis] = await Promise.all([
        fetchDailyPlan(),
        fetchGapAnalysis()
    ]);

    const reasonLabels = {
        sm2_due: { label: 'Revisão SM-2', color: 'bg-blue-50 text-blue-700 border-blue-200' },
        gap_critical: { label: 'Gap Crítico', color: 'bg-red-50 text-red-700 border-red-200' },
        new_concept: { label: 'Conceito Novo', color: 'bg-purple-50 text-purple-700 border-purple-200' },
        needs_review_tag: { label: 'Revisar Urgente', color: 'bg-red-50 text-red-700 border-red-200' }
    };

    container.innerHTML = `
    <div class="p-6 max-w-6xl mx-auto space-y-6 pb-20" id="dashboard-content">
      <div>
        <h1 class="text-2xl font-bold text-zinc-900 tracking-tight">Visão Geral</h1>
      </div>
      
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div class="bg-white border border-zinc-200 p-4 rounded-xl">
          <div class="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">Dominados (A)</div>
          <div class="flex items-baseline gap-2">
            <span class="text-2xl font-bold text-zinc-900">${masteredCount}</span>
            <span class="text-xs text-zinc-400">conceitos</span>
          </div>
        </div>
        <div class="bg-white border border-zinc-200 p-4 rounded-xl">
          <div class="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">Em Progresso (B)</div>
          <div class="flex items-baseline gap-2">
            <span class="text-2xl font-bold text-zinc-900">${inProgressCount}</span>
            <span class="text-xs text-zinc-400">conceitos</span>
          </div>
        </div>
        <div class="bg-white border border-zinc-200 p-4 rounded-xl">
          <div class="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">Foco Atual (C)</div>
          <div class="flex items-baseline gap-2">
            <span class="text-2xl font-bold text-zinc-900">${unlockedConcepts.length}</span>
            <span class="text-xs text-zinc-400">conceitos</span>
          </div>
        </div>
        <div class="bg-white border border-zinc-200 p-4 rounded-xl">
          <div class="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">Sessões Pendentes</div>
          <div class="flex items-baseline gap-2">
            <span class="text-2xl font-bold text-zinc-900">${pendingSessions}</span>
            <span class="text-xs text-zinc-400">sessões</span>
          </div>
        </div>
      </div>

      ${gapAnalysis ? `
        <div class="bg-white border border-zinc-200 rounded-xl p-5">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-sm font-semibold text-zinc-800">Saúde do Aprendizado</h2>
            <span class="text-2xl font-bold ${gapAnalysis.overallHealth >= 70 ? 'text-emerald-600' : gapAnalysis.overallHealth >= 40 ? 'text-amber-600' : 'text-red-600'}">${gapAnalysis.overallHealth}%</span>
          </div>
          ${gapAnalysis.weakCategories && gapAnalysis.weakCategories.length > 0 ? `
            <div class="space-y-2">
              ${gapAnalysis.weakCategories.map(cat => `
                <div class="flex items-center gap-3">
                  <div class="text-xs font-medium text-zinc-600 w-28 truncate shrink-0">${cat.name}</div>
                  <div class="flex-1 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                    <div class="h-full ${cat.healthScore >= 50 ? 'bg-amber-500' : 'bg-red-500'} rounded-full" style="width: ${cat.healthScore}%"></div>
                  </div>
                  <div class="text-xs font-semibold ${cat.healthScore >= 50 ? 'text-amber-600' : 'text-red-600'} w-8 text-right shrink-0">${cat.healthScore}%</div>
                </div>
              `).join('')}
            </div>
          ` : '<p class="text-xs text-emerald-600 font-medium">Nenhuma categoria crítica.</p>'}
        </div>
      ` : ''}

      ${dailyPlan && dailyPlan.plan && dailyPlan.plan.length > 0 ? `
        <div class="bg-white border border-zinc-200 rounded-xl p-5">
          <div class="flex items-center justify-between mb-4">
            <div>
              <h2 class="text-sm font-semibold text-zinc-800">Plano de Hoje</h2>
              <p class="text-xs text-zinc-400 mt-0.5">${dailyPlan.plan.length} conceitos · ~${dailyPlan.totalEstimatedMinutes} min</p>
            </div>
          </div>
          <div class="space-y-2">
            ${dailyPlan.plan.map((item, idx) => {
                const concept = concepts.find(c => c.name === item.conceito_name);
                const reasonInfo = reasonLabels[item.reason] || { label: item.reason, color: 'bg-zinc-100 text-zinc-600 border-zinc-300' };
                return `
                <button
                  class="concept-card w-full text-left bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 px-4 py-3 rounded-lg transition-colors flex items-center gap-3"
                  data-id="${concept?.id || item.conceito_name}"
                >
                  <div class="w-6 h-6 rounded-md bg-zinc-200 text-zinc-600 flex items-center justify-center font-semibold text-xs shrink-0">${idx + 1}</div>
                  <div class="flex-1 min-w-0">
                    <div class="font-medium text-sm text-zinc-800 truncate">${item.conceito_name}</div>
                  </div>
                  <span class="text-[10px] font-semibold px-2 py-0.5 rounded border ${reasonInfo.color} shrink-0">${reasonInfo.label}</span>
                  <div class="text-xs font-semibold text-zinc-500 shrink-0">${item.mastery}%</div>
                  <i data-lucide="chevron-right" class="w-4 h-4 text-zinc-300 shrink-0"></i>
                </button>
              `;
            }).join('')}
          </div>
        </div>
      ` : ''}

      <div>
        <div class="flex items-center justify-between gap-4 mb-4">
          <h2 class="text-sm font-semibold text-zinc-800">Todos os Conceitos</h2>
          <div class="relative">
            <i data-lucide="search" class="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2"></i>
            <input 
              type="text" 
              id="dashboard-search"
              placeholder="Buscar..." 
              value="${searchTerm}"
              class="bg-white border border-zinc-200 text-zinc-800 text-xs rounded-lg pl-8 pr-3 py-2 w-56 focus:outline-none focus:border-zinc-400 transition-colors"
            />
          </div>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          ${filteredConcepts.length > 0 ? filteredConcepts.map(concept => `
            <button
              class="concept-card text-left bg-white border border-zinc-200 hover:border-zinc-300 p-4 rounded-xl transition-all group flex flex-col h-full"
              data-id="${concept.id}"
            >
              <div class="flex justify-between items-start mb-3">
                <div class="flex flex-wrap gap-1.5">
                  <span class="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider px-1.5 py-0.5 bg-zinc-100 rounded">${concept.macroCategory}</span>
                  <span class="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider px-1.5 py-0.5 bg-zinc-50 rounded">${concept.category}</span>
                </div>
                <span class="text-[10px] font-bold px-2 py-0.5 rounded border ${getCategoryColor(concept.abcCategory || 'B')}">
                  ${concept.abcCategory || 'B'}
                </span>
              </div>
              <h3 class="text-sm font-semibold text-zinc-800 group-hover:text-zinc-900 transition-colors mb-3 flex-1">${concept.name}</h3>
              <div class="w-full space-y-1.5">
                <div class="flex justify-between text-[10px] font-medium text-zinc-400">
                  <span>${concept.abcCategory === 'D' ? 100 : (concept.masteryPercentage || 0)}% retenção</span>
                  <span>${concept.nextReview ? new Date(concept.nextReview).toLocaleDateString() : 'Não estudado'}</span>
                </div>
                <div class="h-1 w-full bg-zinc-100 rounded-full overflow-hidden">
                  <div class="h-full transition-all ${getBarColor(concept.abcCategory || 'B')}" style="width: ${concept.abcCategory === 'D' ? 100 : (concept.masteryPercentage || 0)}%"></div>
                </div>
              </div>
            </button>
          `).join('') : `
            <div class="col-span-full text-center py-12 text-zinc-400 bg-zinc-50 border border-zinc-200 rounded-xl border-dashed">
              <p class="text-sm font-medium">Nenhum conceito encontrado.</p>
            </div>
          `}
        </div>
      </div>
    </div>
  `;

    if (window.lucide) window.lucide.createIcons();

    container.querySelectorAll('.concept-card').forEach(card => {
        card.addEventListener('click', (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            store.setState({ selectedConceptId: id });
        });
    });

    const searchInput = document.getElementById('dashboard-search');
    if (searchInput) {
        let isFocused = document.activeElement === searchInput;
        searchInput.addEventListener('input', (e) => {
            store.setState({ dashboardSearchTerm: e.target.value });
        });
        if (isFocused) {
            setTimeout(() => document.getElementById('dashboard-search')?.focus(), 0);
        }
    }
}
