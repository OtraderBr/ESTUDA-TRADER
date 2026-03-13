// js/roadmap.js
import { store } from './state.js';

let expandedMacro = null;

export function renderRoadmap(container, state) {
  const { concepts } = state;

  const macroGroups = {};
  concepts.forEach(c => {
    const macro = c.macroCategory || 'Fundamentos';
    if (!macroGroups[macro]) {
      macroGroups[macro] = { name: macro, concepts: [], mastered: 0, inProgress: 0, notStarted: 0 };
    }
    macroGroups[macro].concepts.push(c);
    const mastery = c.masteryPercentage || 0;
    if (mastery >= 85) macroGroups[macro].mastered++;
    else if (mastery > 0) macroGroups[macro].inProgress++;
    else macroGroups[macro].notStarted++;
  });

  const sortedMacros = Object.values(macroGroups).sort((a, b) => b.concepts.length - a.concepts.length);

  container.innerHTML = `
    <div class="p-6 h-full flex flex-col overflow-y-auto pb-20" id="roadmap-content">
      <div class="mb-5">
        <h1 class="text-xl font-bold text-zinc-900 tracking-tight">Trilha de Estudo</h1>
        <p class="text-xs text-zinc-400 mt-1">${concepts.length} conceitos organizados por classe</p>
      </div>

      <div class="space-y-2">
        ${sortedMacros.map(macro => {
          const total = macro.concepts.length;
          const progressPercentage = Math.round((macro.mastered / total) * 100);
          const isExpanded = expandedMacro === macro.name;
          
          return `
            <div class="bg-white border ${isExpanded ? 'border-zinc-400' : 'border-zinc-200'} rounded-xl overflow-hidden transition-all duration-200">
              
              <button class="macro-toggle-btn w-full px-5 py-4 flex items-center justify-between gap-4 hover:bg-zinc-50 transition-colors" data-macro="${macro.name}">
                <div class="flex items-center gap-3 text-left">
                  <div class="w-8 h-8 rounded-lg ${isExpanded ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600'} flex items-center justify-center shrink-0 transition-colors">
                    <i data-lucide="layers" class="w-4 h-4"></i>
                  </div>
                  <div>
                    <h2 class="text-sm font-semibold text-zinc-900">${macro.name}</h2>
                    <p class="text-[10px] text-zinc-400 font-medium mt-0.5">
                      ${macro.mastered}/${total} dominados
                    </p>
                  </div>
                </div>
                
                <div class="flex items-center gap-3 shrink-0">
                  <div class="w-32 hidden sm:block">
                    <div class="flex justify-between text-[10px] font-semibold text-zinc-500 mb-1">
                       <span>${progressPercentage}%</span>
                    </div>
                    <div class="h-1.5 w-full bg-zinc-100 rounded-full overflow-hidden flex">
                       <div class="h-full bg-emerald-500 transition-all duration-500" style="width: ${progressPercentage}%"></div>
                       <div class="h-full bg-amber-400 transition-all duration-500" style="width: ${Math.round((macro.inProgress/total)*100)}%"></div>
                    </div>
                  </div>
                  <i data-lucide="chevron-${isExpanded ? 'up' : 'down'}" class="w-4 h-4 text-zinc-400"></i>
                </div>
              </button>

              ${isExpanded ? `
                <div class="px-5 pb-5 border-t border-zinc-100 pt-4">
                   ${Object.entries(groupByCategory(macro.concepts)).map(([category, cats]) => `
                      <div class="mb-4 last:mb-0">
                         <h3 class="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">${category}</h3>
                         <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
                            ${cats.map(c => {
                               const mastery = c.masteryPercentage || 0;
                               let dotColor = 'bg-zinc-300';
                               let borderStatus = 'border-zinc-200 hover:border-zinc-300';
                               if(mastery >= 85) {
                                  dotColor = 'bg-emerald-500';
                                  borderStatus = 'border-emerald-200 hover:border-emerald-300';
                               } else if (mastery > 0) {
                                  dotColor = 'bg-amber-500';
                                  borderStatus = 'border-amber-200 hover:border-amber-300';
                               }

                               return `
                               <button 
                                  class="roadmap-concept-btn flex items-center gap-2.5 px-3 py-2.5 bg-white border ${borderStatus} rounded-lg text-left transition-all hover:bg-zinc-50 group"
                                  data-id="${c.id}"
                               >
                                  <div class="w-2 h-2 rounded-full ${dotColor} shrink-0"></div>
                                  <div class="flex-1 min-w-0">
                                     <div class="text-xs font-medium text-zinc-700 truncate group-hover:text-zinc-900">${c.name}</div>
                                     <div class="text-[10px] text-zinc-400 mt-0.5">${mastery}%</div>
                                  </div>
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

  container.querySelectorAll('.macro-toggle-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const macro = e.currentTarget.getAttribute('data-macro');
      expandedMacro = expandedMacro === macro ? null : macro;
      renderRoadmap(container, state);
    });
  });

  container.querySelectorAll('.roadmap-concept-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        store.setState({ selectedConceptId: id });
    });
  });
}

function groupByCategory(conceptsArray) {
   const groups = {};
   conceptsArray.forEach(c => {
      const cat = c.category || 'Geral';
      if(!groups[cat]) groups[cat] = [];
      groups[cat].push(c);
   });
   return groups;
}
