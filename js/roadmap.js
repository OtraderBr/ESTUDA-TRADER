// js/roadmap.js
import { store } from './state.js';

let expandedMacro = null; // Guarda qual macro está expandida

export function renderRoadmap(container, state) {
  const { concepts } = state;

  // Agrupar conceitos por macro categoria
  const macroGroups = {};
  concepts.forEach(c => {
    const macro = c.macroCategory || 'Fundamentos';
    if (!macroGroups[macro]) {
      macroGroups[macro] = {
        name: macro,
        concepts: [],
        mastered: 0,
        inProgress: 0,
        notStarted: 0
      };
    }
    macroGroups[macro].concepts.push(c);
    
    // Contagem baseada na retenção (masteryPercentage)
    const mastery = c.masteryPercentage || 0;
    if (mastery >= 85) macroGroups[macro].mastered++;
    else if (mastery > 0) macroGroups[macro].inProgress++;
    else macroGroups[macro].notStarted++;
  });

  const sortedMacros = Object.values(macroGroups).sort((a, b) => b.concepts.length - a.concepts.length);

  container.innerHTML = `
    <div class="p-8 h-full flex flex-col bg-zinc-50 overflow-y-auto pb-24" id="roadmap-content">
      <div class="mb-8">
        <h1 class="text-3xl font-bold text-zinc-900 tracking-tight flex items-center gap-3">
          <i data-lucide="target" class="w-8 h-8 text-emerald-500"></i>
          Trilha de Estudo Linear
        </h1>
        <p class="text-zinc-500 mt-2">Uma visão agrupada e direta para dominar os ${concepts.length} conceitos do Motor Brooks.</p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <!-- Legend Cards -->
        <div class="bg-white p-4 rounded-2xl border border-zinc-200 flex items-center gap-3 shadow-sm">
           <div class="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]"></div>
           <div>
              <div class="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Dominado</div>
              <div class="text-sm font-bold text-zinc-800">> 85% Conhecimento</div>
           </div>
        </div>
        <div class="bg-white p-4 rounded-2xl border border-zinc-200 flex items-center gap-3 shadow-sm">
           <div class="w-3 h-3 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]"></div>
           <div>
              <div class="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Em Progresso</div>
              <div class="text-sm font-bold text-zinc-800">1% a 84% Conhecimento</div>
           </div>
        </div>
        <div class="bg-white p-4 rounded-2xl border border-zinc-200 flex items-center gap-3 shadow-sm">
           <div class="w-3 h-3 rounded-full bg-zinc-300"></div>
           <div>
              <div class="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Não Iniciado</div>
              <div class="text-sm font-bold text-zinc-800">0% Conhecimento</div>
           </div>
        </div>
      </div>

      <div class="space-y-4">
        ${sortedMacros.map(macro => {
          const total = macro.concepts.length;
          const progressPercentage = Math.round((macro.mastered / total) * 100);
          const isExpanded = expandedMacro === macro.name;
          
          return `
            <div class="bg-white border ${isExpanded ? 'border-emerald-500 shadow-md ring-4 ring-emerald-50' : 'border-zinc-200 shadow-sm'} rounded-[2rem] overflow-hidden transition-all duration-300">
              
              <!-- Macro Header -->
              <button class="macro-toggle-btn w-full p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:bg-zinc-50/50 transition-colors" data-macro="${macro.name}">
                <div class="flex items-center gap-4 text-left">
                  <div class="w-14 h-14 rounded-2xl ${isExpanded ? 'bg-emerald-500 text-white' : 'bg-emerald-50 text-emerald-600'} flex items-center justify-center shrink-0 transition-colors">
                    <i data-lucide="layers" class="w-7 h-7"></i>
                  </div>
                  <div>
                    <h2 class="text-2xl font-bold text-zinc-900">${macro.name}</h2>
                    <p class="text-sm text-zinc-500 font-medium mt-1">
                      ${macro.mastered} de ${total} estruturados dominados
                    </p>
                  </div>
                </div>
                
                <div class="w-full md:w-64 shrink-0 flex items-center gap-4">
                  <div class="flex-1">
                    <div class="flex justify-between text-xs font-bold text-zinc-700 mb-2">
                       <span>Progresso</span>
                       <span class="${progressPercentage >= 80 ? 'text-emerald-600' : 'text-zinc-500'}">${progressPercentage}%</span>
                    </div>
                    <div class="h-2 w-full bg-zinc-100 rounded-full overflow-hidden flex">
                       <div class="h-full bg-emerald-500 transition-all duration-500" style="width: ${progressPercentage}%"></div>
                       <div class="h-full bg-amber-500 opacity-50 transition-all duration-500" style="width: ${Math.round((macro.inProgress/total)*100)}%"></div>
                    </div>
                  </div>
                  <i data-lucide="chevron-${isExpanded ? 'up' : 'down'}" class="w-6 h-6 text-zinc-400 transition-transform"></i>
                </div>
              </button>

              <!-- Expandable Content (Concepts Grid) -->
              ${isExpanded ? `
                <div class="px-6 pb-6 md:px-8 md:pb-8 border-t border-zinc-100 pt-6 animate-in fade-in slide-in-from-top-4 duration-300">
                   
                   ${Object.entries(groupByCategory(macro.concepts)).map(([category, cats]) => `
                      <div class="mb-6 last:mb-0">
                         <h3 class="text-sm font-bold text-zinc-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <span class="w-6 h-px bg-zinc-200"></span> ${category} <span class="flex-1 h-px bg-zinc-200"></span>
                         </h3>
                         <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                            ${cats.map(c => {
                               const mastery = c.masteryPercentage || 0;
                               let statusDot = '<div class="w-2.5 h-2.5 rounded-full bg-zinc-300 shrink-0"></div>';
                               let borderStatus = 'border-zinc-200 hover:border-zinc-300';
                               if(mastery >= 85) {
                                  statusDot = '<div class="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)] shrink-0"></div>';
                                  borderStatus = 'border-emerald-200 bg-emerald-50/30 hover:border-emerald-400';
                               } else if (mastery > 0) {
                                  statusDot = '<div class="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)] shrink-0"></div>';
                                  borderStatus = 'border-amber-200 bg-amber-50/30 hover:border-amber-400';
                               }

                               return `
                               <button 
                                  class="roadmap-concept-btn flex items-center gap-3 p-3.5 bg-white border ${borderStatus} rounded-xl text-left transition-all hover:shadow-md group"
                                  data-id="${c.id}"
                               >
                                  ${statusDot}
                                  <div class="flex-1 min-w-0">
                                     <div class="text-sm font-bold text-zinc-800 truncate group-hover:text-emerald-700 transition-colors">${c.name}</div>
                                     <div class="flex items-center gap-2 mt-1">
                                       <div class="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">${mastery}% RETENÇÃO</div>
                                       ${c.regrasOperacionais ? '<i data-lucide="lightbulb" class="w-3 h-3 text-amber-500"></i>' : ''}
                                     </div>
                                  </div>
                                  <i data-lucide="arrow-right" class="w-4 h-4 text-zinc-300 group-hover:text-emerald-500 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0"></i>
                               </button>
                               `;
                            }).join('')}
                         </div>
                      </div>
                   `).join('')}

                </div>
              ` : ''}
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;

  if (window.lucide) window.lucide.createIcons();

  // Accordion Toggle Logic
  container.querySelectorAll('.macro-toggle-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const macro = e.currentTarget.getAttribute('data-macro');
      if (expandedMacro === macro) {
        expandedMacro = null; // collapse se ja ta aberto
      } else {
        expandedMacro = macro; // expandir novo
      }
      renderRoadmap(container, state); // Re-renderiza a tela localmente
    });
  });

  // Navigate to concept detail
  container.querySelectorAll('.roadmap-concept-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        store.setState({ selectedConceptId: id });
    });
  });
}

// Utilitário para quebrar os conceitos dentro do Macro em Categorias
function groupByCategory(conceptsArray) {
   const groups = {};
   conceptsArray.forEach(c => {
      const cat = c.category || 'Geral';
      if(!groups[cat]) groups[cat] = [];
      groups[cat].push(c);
   });
   return groups;
}
