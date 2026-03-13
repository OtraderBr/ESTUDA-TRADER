// js/concept-detail.js
import { store } from './state.js';
import { addNote, addEvaluation, updateImportance, updateABC, updateMacroCategory } from './engine.js';
import { cn } from './utils.js';

let activeTab = 'anotacoes';

export function renderConceptDetail(container, concept) {
    const mastery = concept.masteryPercentage || 0;
    const category = concept.abcCategory || 'C';

    let categoryColor = 'text-red-600';
    let categoryBg = 'bg-red-600/10 border-red-600/20';
    if (category === 'A') {
        categoryColor = 'text-emerald-600';
        categoryBg = 'bg-emerald-600/10 border-emerald-600/20';
    } else if (category === 'B') {
        categoryColor = 'text-amber-600';
        categoryBg = 'bg-amber-600/10 border-amber-600/20';
    }

    const renderNotesTab = () => `
    <div class="space-y-8">
      <div class="bg-white border border-zinc-200 rounded-3xl p-6 md:p-8">
        <h3 class="text-xl font-semibold text-zinc-900 mb-6">Nova Anotação</h3>
        
        <div class="mb-6">
          <select id="noteType" class="bg-zinc-50 border border-zinc-200 text-zinc-800 text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 transition-colors w-full md:w-auto">
            <option value="Anotação">Anotação Geral</option>
            <option value="Dúvida">Dúvida</option>
            <option value="Pergunta">Pergunta para Mentoria</option>
            <option value="Questionamento">Questionamento</option>
            <option value="Observação de Tela">Observação de Tela (Screen Time)</option>
          </select>
        </div>

        <textarea
          id="noteText"
          placeholder="Escreva aqui suas observações, dúvidas ou insights sobre este conceito..."
          class="w-full h-40 bg-zinc-50 border border-zinc-200 rounded-2xl p-5 text-zinc-700 focus:outline-none focus:border-emerald-500 resize-none mb-6 placeholder:text-zinc-500"
        ></textarea>

        <div class="flex justify-end">
          <button id="saveNoteBtn" class="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-200 disabled:text-zinc-500 text-white px-6 py-3 rounded-xl font-medium transition-colors">
            <i data-lucide="save" class="w-5 h-5"></i>
            Salvar no Histórico
          </button>
        </div>
      </div>

      ${concept.notesList && concept.notesList.length > 0 ? `
        <div>
          <h3 class="text-xl font-semibold text-zinc-900 mb-6 flex items-center gap-3">
            <i data-lucide="history" class="w-6 h-6 text-emerald-500"></i>
            Histórico de Anotações
          </h3>
          <div class="space-y-4">
            ${concept.notesList.map((note) => {
        let badgeColor = "bg-zinc-100 text-zinc-700 border border-zinc-300";
        if (note.type === 'Dúvida') badgeColor = "bg-red-600/10 text-red-600 border border-red-600/20";
        if (note.type === 'Pergunta') badgeColor = "bg-amber-600/10 text-amber-600 border border-amber-600/20";
        if (note.type === 'Observação de Tela') badgeColor = "bg-blue-600/10 text-blue-600 border border-blue-600/20";

        return `
                <div class="bg-white/50 border border-zinc-200 rounded-2xl p-6">
                  <div class="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-4">
                    <span class="text-xs font-semibold px-3 py-1.5 rounded-lg w-fit ${badgeColor}">
                      ${note.type}
                    </span>
                    <span class="text-sm text-zinc-500 flex items-center gap-1.5">
                      <i data-lucide="calendar-clock" class="w-4 h-4"></i>
                      ${new Date(note.date).toLocaleString()}
                    </span>
                  </div>
                  <p class="text-zinc-700 text-sm whitespace-pre-wrap leading-relaxed">${note.text}</p>
                </div>
              `;
    }).join('')}
          </div>
        </div>
      ` : ''}
    </div>
  `;

    const renderEvalTab = () => `
    <div class="space-y-8">
      <div class="bg-white border border-zinc-200 rounded-3xl p-6 md:p-8">
        <div class="mb-8">
          <h3 class="text-xl font-semibold text-zinc-900 mb-2">Registrar Sessão de Estudo</h3>
          <p class="text-zinc-500 text-sm">Insira os resultados das suas ferramentas externas (Flashcards, Quizzes) e explique o conceito com suas próprias palavras. O sistema calculará seu nível de conhecimento automaticamente.</p>
        </div>
        
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
          <div>
            <label class="block text-sm font-medium text-zinc-700 mb-2">Acertos nos Flashcards (%)</label>
            <input 
              id="flashcardScore"
              type="number" min="0" max="100"
              placeholder="Ex: 85"
              class="w-full bg-zinc-50 border border-zinc-200 text-zinc-800 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-zinc-700 mb-2">Acertos no Questionário (%)</label>
            <input 
              id="quizScore"
              type="number" min="0" max="100"
              placeholder="Ex: 90"
              class="w-full bg-zinc-50 border border-zinc-200 text-zinc-800 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        <div class="mb-8">
          <label class="block text-sm font-medium text-zinc-700 mb-2">Explicação (Técnica de Feynman)</label>
          <textarea
            id="explanationText"
            placeholder="Explique o conceito com suas próprias palavras como se estivesse ensinando alguém..."
            class="w-full h-40 bg-zinc-50 border border-zinc-200 rounded-2xl p-5 text-zinc-700 focus:outline-none focus:border-emerald-500 resize-none placeholder:text-zinc-500"
          ></textarea>
        </div>

        <div class="flex justify-end">
          <button id="saveEvalBtn" class="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-200 disabled:text-zinc-500 text-white px-6 py-3 rounded-xl font-medium transition-colors">
            <i data-lucide="save" class="w-5 h-5"></i>
            Salvar Avaliação
          </button>
        </div>
      </div>

      ${concept.evaluations && concept.evaluations.length > 0 ? `
        <div>
          <h3 class="text-xl font-semibold text-zinc-900 mb-6 flex items-center gap-3">
            <i data-lucide="history" class="w-6 h-6 text-emerald-500"></i>
            Histórico de Avaliações
          </h3>
          <div class="space-y-4">
            ${concept.evaluations.map((evalItem) => {
        const avg = Math.round((evalItem.flashcardScore + evalItem.quizScore) / 2);
        return `
                <div class="bg-white/50 border border-zinc-200 rounded-3xl p-6">
                  <div class="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-6">
                    <span class="text-sm text-zinc-500 flex items-center gap-1.5">
                      <i data-lucide="calendar-clock" class="w-4 h-4"></i>
                      ${new Date(evalItem.date).toLocaleString()}
                    </span>
                    <div class="flex flex-wrap gap-3">
                      <div class="text-xs bg-zinc-100 text-zinc-700 px-3 py-1.5 rounded-lg border border-zinc-300 flex items-center gap-2">
                        Flashcards: <span class="font-bold text-zinc-900 text-sm">${evalItem.flashcardScore}%</span>
                      </div>
                      <div class="text-xs bg-zinc-100 text-zinc-700 px-3 py-1.5 rounded-lg border border-zinc-300 flex items-center gap-2">
                        Quiz: <span class="font-bold text-zinc-900 text-sm">${evalItem.quizScore}%</span>
                      </div>
                      <div class="text-xs bg-emerald-600/10 text-emerald-600 px-3 py-1.5 rounded-lg border border-emerald-600/20 flex items-center gap-2">
                        Média: <span class="font-bold text-sm">${avg}%</span>
                      </div>
                    </div>
                  </div>
                  <div class="bg-zinc-50 border border-zinc-200/50 rounded-2xl p-5">
                    <div class="text-xs text-zinc-500 mb-3 uppercase tracking-wider font-semibold">Sua Explicação</div>
                    <p class="text-zinc-700 text-sm whitespace-pre-wrap leading-relaxed">${evalItem.explanation}</p>
                  </div>
                </div>
              `;
    }).join('')}
          </div>
        </div>
      ` : ''}
    </div>
  `;

    container.innerHTML = `
    <div class="p-8 max-w-5xl mx-auto h-full overflow-y-auto pb-24" id="concept-detail-content">
      <div class="bg-white border border-zinc-200 rounded-3xl p-6 md:p-8 mb-8">
        <div class="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-8">
          <div>
            <div class="flex items-center gap-2 mb-3 flex-wrap">
              <span class="text-xs font-medium text-emerald-600 uppercase tracking-wider bg-emerald-600/10 px-2.5 py-1 rounded-lg border border-emerald-600/20">
                ${concept.macroCategory || 'Fundamento'}
              </span>
              <span class="text-zinc-400">&gt;</span>
              <span class="text-xs font-medium text-zinc-600 uppercase tracking-wider bg-zinc-100 px-2.5 py-1 rounded-lg border border-zinc-200">
                ${concept.category}
              </span>
              ${concept.subcategory ? `<span class="text-zinc-400">&gt;</span><span class="text-xs font-medium text-zinc-600 uppercase tracking-wider bg-zinc-100 px-2.5 py-1 rounded-lg border border-zinc-200">${concept.subcategory}</span>` : ''}
            </div>
            <h1 class="text-3xl md:text-4xl font-bold text-zinc-900 tracking-tight">${concept.name}</h1>
            <div class="flex items-center gap-3 mt-4 flex-wrap">
              ${concept.moduloCurso ? `<div class="text-xs font-medium text-zinc-600 bg-white border border-zinc-200 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm"><i data-lucide="book-open" class="w-3.5 h-3.5 text-zinc-400"></i> Módulos Brooks: ${concept.moduloCurso}</div>` : ''}
              ${concept.mercadoAplicavel && concept.mercadoAplicavel !== 'Universal' ? `<div class="text-xs font-medium text-purple-600 bg-purple-50 border border-purple-200 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm"><i data-lucide="globe" class="w-3.5 h-3.5"></i> Mercado: ${concept.mercadoAplicavel}</div>` : ''}
              ${concept.probabilidade ? `<div class="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm"><i data-lucide="percent" class="w-3.5 h-3.5"></i> Win Rate: ${concept.probabilidade}</div>` : ''}
            </div>
          </div>
          
          <div class="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <div class="flex-1 md:flex-none flex items-center gap-2 bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2">
              <i data-lucide="layers" class="w-4 h-4 text-zinc-500 shrink-0"></i>
              <select id="macroSelect" class="bg-transparent text-sm text-zinc-700 focus:outline-none cursor-pointer w-full">
                <option value="Fundamento" ${concept.macroCategory === 'Fundamento' ? 'selected' : ''}>Classe: Fundamento</option>
                <option value="Operacional" ${concept.macroCategory === 'Operacional' ? 'selected' : ''}>Classe: Operacional</option>
                <option value="Regras" ${concept.macroCategory === 'Regras' ? 'selected' : ''}>Classe: Regras</option>
                <option value="Probabilidades" ${concept.macroCategory === 'Probabilidades' ? 'selected' : ''}>Classe: Probabilidades</option>
                <option value="Outros" ${concept.macroCategory === 'Outros' ? 'selected' : ''}>Classe: Outros</option>
              </select>
            </div>

            <div class="flex-1 md:flex-none flex items-center gap-2 bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2">
              <i data-lucide="tag" class="w-4 h-4 text-zinc-500 shrink-0"></i>
              <select id="importanceSelect" class="bg-transparent text-sm text-zinc-700 focus:outline-none cursor-pointer w-full">
                <option value="Baixa" ${concept.importance === 'Baixa' ? 'selected' : ''}>Importância: Baixa</option>
                <option value="Média" ${concept.importance === 'Média' ? 'selected' : ''}>Importância: Média</option>
                <option value="Alta" ${concept.importance === 'Alta' ? 'selected' : ''}>Importância: Alta</option>
              </select>
            </div>
            
            <div class="flex-1 md:flex-none flex items-center gap-2 bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2">
              <div class="w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold shrink-0 bg-white border border-zinc-200 ${categoryColor}">
                ${category}
              </div>
              <select id="abcSelect" class="bg-transparent text-sm text-zinc-700 focus:outline-none cursor-pointer w-full">
                <option value="A" ${category === 'A' ? 'selected' : ''}>Categoria ABC: A</option>
                <option value="B" ${category === 'B' ? 'selected' : ''}>Categoria ABC: B</option>
                <option value="C" ${category === 'C' ? 'selected' : ''}>Categoria ABC: C</option>
              </select>
            </div>
          </div>
        </div>
        
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div class="border rounded-2xl p-5 flex items-start gap-4 sm:col-span-3 ${categoryBg}">
            <div class="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-xl shrink-0 border border-zinc-200/50 bg-zinc-50 ${categoryColor}">
              ${category}
            </div>
            <div>
              <div class="text-xs text-zinc-500 uppercase tracking-wider font-semibold mb-1">Método ABC - Como Estudar</div>
              <div class="font-medium mb-2 ${categoryColor}">
                ${category === 'A' ? 'Domínio Alto (Acertos > 85%)' : category === 'B' ? 'Em Desenvolvimento (Acertos 50% - 84%)' : 'Prioridade Máxima (Acertos < 50% ou Novo)'}
              </div>
              <div class="text-sm text-zinc-500 space-y-1.5">
                ${category === 'A' ? `
                  <p><strong class="text-zinc-700">Ação:</strong> Revisar com simulados e questões, sem repetir videoaulas ou PDFs.</p>
                  <p><strong class="text-zinc-700">Objetivo:</strong> Manter o domínio e identificar falhas de interpretação ou atenção.</p>
                ` : ''}
                ${category === 'B' ? `
                  <p><strong class="text-zinc-700">Ação:</strong> Revisar com PDFs, videoaulas pontuais e questões focadas nos pontos fracos.</p>
                  <p><strong class="text-zinc-700">Dica:</strong> Reservar 30 minutos por dia para esses tópicos.</p>
                ` : ''}
                ${category === 'C' ? `
                  <p><strong class="text-zinc-700">Ação:</strong> Estudar com videoaulas, PDFs e resumos como se fosse o primeiro contato.</p>
                  <p><strong class="text-zinc-700">Prioridade:</strong> Máxima no cronograma inicial.</p>
                ` : ''}
              </div>
            </div>
          </div>

          <div class="bg-zinc-50 border border-zinc-200 rounded-2xl p-5 flex items-center gap-4">
            <div class="w-12 h-12 rounded-xl flex items-center justify-center bg-emerald-600/10 text-emerald-600 border border-emerald-600/20">
              <i data-lucide="trending-up" class="w-6 h-6"></i>
            </div>
            <div>
              <div class="text-xs text-zinc-500 uppercase tracking-wider font-semibold mb-1">Nível de Conhecimento</div>
              <div class="font-medium text-zinc-800 text-lg">${mastery}% <span class="text-zinc-500 text-sm font-normal">retenção</span></div>
            </div>
          </div>

          <div class="bg-zinc-50 border border-zinc-200 rounded-2xl p-5 flex items-center gap-4">
            <div class="w-12 h-12 rounded-xl flex items-center justify-center bg-blue-600/10 text-blue-600 border border-blue-600/20 shrink-0">
              <i data-lucide="calendar-clock" class="w-6 h-6"></i>
            </div>
            <div>
              <div class="text-xs text-zinc-500 uppercase tracking-wider font-semibold mb-1">Próxima Revisão</div>
              <div class="font-medium text-zinc-800 text-lg">
                ${concept.nextReview ? new Date(concept.nextReview).toLocaleDateString() : 'Não agendada'}
              </div>
            </div>
          </div>
        </div>

        ${(concept.regrasOperacionais || concept.notasBD) ? `
        <div class="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          ${concept.regrasOperacionais ? `
          <div class="bg-amber-50/50 border border-amber-200/60 rounded-3xl p-6 shadow-sm relative overflow-hidden h-full">
            <div class="absolute top-0 right-0 w-32 h-32 bg-amber-400/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>
            <div class="flex items-center gap-2 text-amber-600 font-bold mb-4 relative z-10 text-lg">
              <i data-lucide="lightbulb" class="w-6 h-6 text-amber-500"></i>
              Regras Operacionais
            </div>
            <div class="space-y-3 relative z-10">
              ${concept.regrasOperacionais.split('|').map(r => `
                <div class="flex items-start gap-3 bg-white/60 border border-amber-200/30 p-3 rounded-xl">
                  <i data-lucide="check-circle-2" class="w-5 h-5 text-amber-500 shrink-0 mt-0.5"></i>
                  <span class="text-amber-900/90 text-sm font-medium leading-relaxed">${r.trim()}</span>
                </div>
              `).join('')}
            </div>
          </div>
          ` : ''}

          ${concept.notasBD ? `
          <div class="bg-zinc-50 border border-zinc-200 rounded-3xl p-6 shadow-sm h-full ${!concept.regrasOperacionais ? 'md:col-span-2' : ''}">
            <div class="flex items-center gap-2 text-zinc-800 font-bold mb-4 text-lg">
              <i data-lucide="book-marked" class="w-6 h-6 text-emerald-600"></i>
              Notas do Autor (Al Brooks)
            </div>
            <div class="bg-white border border-zinc-200 p-4 rounded-2xl">
              <p class="text-zinc-600 text-sm leading-relaxed whitespace-pre-line font-medium italic">
                "${concept.notasBD}"
              </p>
            </div>
          </div>
          ` : ''}
        </div>
        ` : ''}

      </div>

      <div class="flex gap-6 mb-8 border-b border-zinc-200 pb-px">
        <button
          id="tab-anotacoes"
          class="pb-4 px-2 text-sm font-medium transition-colors relative ${activeTab === 'anotacoes' ? 'text-emerald-600' : 'text-zinc-500 hover:text-zinc-900'}"
        >
          <div class="flex items-center gap-2"><i data-lucide="book-open" class="w-4 h-4"></i> Anotações & Dúvidas</div>
          ${activeTab === 'anotacoes' ? '<div class="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500 rounded-t-full"></div>' : ''}
        </button>
        <button
          id="tab-autoavaliacao"
          class="pb-4 px-2 text-sm font-medium transition-colors relative ${activeTab === 'autoavaliacao' ? 'text-emerald-600' : 'text-zinc-500 hover:text-zinc-900'}"
        >
          <div class="flex items-center gap-2"><i data-lucide="brain-circuit" class="w-4 h-4"></i> Autoavaliação & Controle de Nível</div>
          ${activeTab === 'autoavaliacao' ? '<div class="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500 rounded-t-full"></div>' : ''}
        </button>
      </div>

      <div class="min-h-[400px]" id="tab-content-area">
        ${activeTab === 'anotacoes' ? renderNotesTab() : renderEvalTab()}
      </div>
    </div>
  `;

    if (window.lucide) window.lucide.createIcons();

    // Ataching Action Listeners
    document.getElementById('macroSelect')?.addEventListener('change', (e) => {
        updateMacroCategory(concept.name, e.target.value);
    });
    document.getElementById('importanceSelect')?.addEventListener('change', (e) => {
        updateImportance(concept.name, e.target.value);
    });
    document.getElementById('abcSelect')?.addEventListener('change', (e) => {
        updateABC(concept.name, e.target.value);
    });

    // Tabs
    document.getElementById('tab-anotacoes')?.addEventListener('click', () => {
        activeTab = 'anotacoes';
        // Re-render local state
        renderConceptDetail(container, store.getState().concepts.find(c => c.id === concept.id));
    });
    document.getElementById('tab-autoavaliacao')?.addEventListener('click', () => {
        activeTab = 'autoavaliacao';
        renderConceptDetail(container, store.getState().concepts.find(c => c.id === concept.id));
    });

    // Note form
    const saveNoteBtn = document.getElementById('saveNoteBtn');
    if (saveNoteBtn) {
        const noteTextEl = document.getElementById('noteText');

        const updateBtnState = () => {
            saveNoteBtn.disabled = !noteTextEl.value.trim();
        };
        noteTextEl.addEventListener('input', updateBtnState);
        updateBtnState(); // verificação inicial

        saveNoteBtn.addEventListener('click', () => {
            const text = noteTextEl.value.trim();
            const type = document.getElementById('noteType').value;
            if (text) {
                addNote(concept.name, type, text);
                // UI feedback handled by global state re-render
            }
        });
    }

    // Eval Form
    const saveEvalBtn = document.getElementById('saveEvalBtn');
    if (saveEvalBtn) {
        const fsEl = document.getElementById('flashcardScore');
        const qsEl = document.getElementById('quizScore');
        const expEl = document.getElementById('explanationText');

        const updateEvalBtnState = () => {
            saveEvalBtn.disabled = !expEl.value.trim() || !fsEl.value || !qsEl.value;
        };

        fsEl.addEventListener('input', updateEvalBtnState);
        qsEl.addEventListener('input', updateEvalBtnState);
        expEl.addEventListener('input', updateEvalBtnState);
        updateEvalBtnState();

        saveEvalBtn.addEventListener('click', () => {
            const fs = parseInt(fsEl.value);
            const qs = parseInt(qsEl.value);
            const expl = expEl.value.trim();
            if (!isNaN(fs) && !isNaN(qs) && expl) {
                addEvaluation(concept.name, fs, qs, expl);
            }
        });
    }

}
