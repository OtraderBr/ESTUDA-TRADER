// js/concept-detail.js
import { store } from './state.js';
import { addNote, addEvaluation, updateImportance, updateABC, updateMacroCategory, updateTags } from './engine.js';
import { upsertConceptDescription } from './dataService.js';
import { cn } from './utils.js';
import { renderTagPills, attachTagListeners } from './tags.js';
import { createRichEditor, attachFloatingToolbar } from './rich-editor.js';

let activeTab = 'descricao';

export function renderConceptDetail(container, concept) {
    const mastery = concept.masteryPercentage || 0;
    const category = concept.abcCategory || 'C';

    const catColor = category === 'A' ? 'text-emerald-600' : category === 'B' ? 'text-amber-600' : 'text-red-600';
    const catBg = category === 'A' ? 'bg-emerald-50 border-emerald-200' : category === 'B' ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200';

    // ── TAB: Descrição (Editor Tiptap) ──
    const renderDescTab = () => `
    <div class="p-5">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Descrição do Conceito</h3>
        <div class="flex items-center gap-2">
          <span id="save-indicator" class="text-[10px] text-emerald-600 font-medium opacity-0 transition-opacity duration-300">Salvo</span>
          <button id="desc-focus-btn" title="Modo foco"
            class="p-1 rounded hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 transition-colors">
            <i data-lucide="maximize-2" class="w-3.5 h-3.5"></i>
          </button>
        </div>
      </div>
      <div class="relative">
        <div class="rich-toolbar" id="rich-toolbar" style="display: none;">
          <button data-action="bold" title="Negrito"><i data-lucide="bold" class="w-3.5 h-3.5 text-inherit"></i></button>
          <button data-action="italic" title="Itálico"><i data-lucide="italic" class="w-3.5 h-3.5 text-inherit"></i></button>
          <button data-action="strike" title="Tachado"><i data-lucide="strikethrough" class="w-3.5 h-3.5 text-inherit"></i></button>
          <div class="toolbar-sep"></div>
          <button data-action="h1" title="Título 1"><i data-lucide="heading-1" class="w-4 h-4 text-inherit"></i></button>
          <button data-action="h2" title="Título 2"><i data-lucide="heading-2" class="w-4 h-4 text-inherit"></i></button>
          <div class="toolbar-sep"></div>
          <button data-action="highlight" title="Destaque"><i data-lucide="highlighter" class="w-3.5 h-3.5 text-inherit"></i></button>
          <button data-action="bulletList" title="Lista"><i data-lucide="list" class="w-3.5 h-3.5 text-inherit"></i></button>
          <button data-action="orderedList" title="Lista numerada"><i data-lucide="list-ordered" class="w-3.5 h-3.5 text-inherit"></i></button>
        </div>
        <div id="rich-editor-container" class="min-h-[200px] bg-zinc-50 border border-zinc-200 rounded-lg p-4"></div>
      </div>

      ${(concept.regrasOperacionais || concept.notasBD) ? `
      <div class="mt-5 space-y-3">
        ${concept.regrasOperacionais ? `
        <div class="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <h4 class="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-2">Regras Operacionais</h4>
          <div class="space-y-1.5">
            ${concept.regrasOperacionais.split('|').map(r => `
              <div class="flex items-start gap-2">
                <i data-lucide="check" class="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5"></i>
                <span class="text-xs text-amber-900 font-medium leading-relaxed">${r.trim()}</span>
              </div>
            `).join('')}
          </div>
        </div>
        ` : ''}
        ${concept.notasBD ? `
        <div class="bg-zinc-50 border border-zinc-200 rounded-lg p-4">
          <h4 class="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Notas do Autor</h4>
          <p class="text-xs text-zinc-600 leading-relaxed italic">"${concept.notasBD}"</p>
        </div>
        ` : ''}
      </div>
      ` : ''}
    </div>
    `;

    // ── TAB: Anotações ──
    const renderNotesTab = () => `
    <div class="p-5 space-y-5">
      <div class="bg-zinc-50 border border-zinc-200 rounded-lg p-4">
        <div class="flex items-center gap-3 mb-3">
          <select id="noteType" class="bg-white border border-zinc-200 text-zinc-700 text-xs rounded-md px-3 py-1.5 focus:outline-none focus:border-zinc-400">
            <option value="Anotação">Anotação Geral</option>
            <option value="Dúvida">Dúvida</option>
            <option value="Pergunta">Pergunta para Mentoria</option>
            <option value="Questionamento">Questionamento</option>
            <option value="Observação de Tela">Observação de Tela</option>
          </select>
        </div>
        <textarea
          id="noteText"
          placeholder="Escreva suas observações, dúvidas ou insights..."
          class="w-full h-28 bg-white border border-zinc-200 rounded-lg p-3 text-xs text-zinc-700 focus:outline-none focus:border-zinc-400 resize-none placeholder:text-zinc-400"
        ></textarea>
        <div class="flex justify-end mt-2">
          <button id="saveNoteBtn" class="flex items-center gap-1.5 bg-zinc-900 hover:bg-zinc-800 disabled:bg-zinc-200 disabled:text-zinc-400 text-white px-4 py-2 rounded-lg text-xs font-medium transition-colors">
            <i data-lucide="save" class="w-3.5 h-3.5"></i> Salvar
          </button>
        </div>
      </div>

      ${concept.notesList && concept.notesList.length > 0 ? `
        <div>
          <h4 class="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Histórico</h4>
          <div class="space-y-2">
            ${concept.notesList.map((note) => {
        let badgeColor = "bg-zinc-100 text-zinc-600 border-zinc-200";
        if (note.type === 'Dúvida') badgeColor = "bg-red-50 text-red-600 border-red-200";
        if (note.type === 'Pergunta') badgeColor = "bg-amber-50 text-amber-600 border-amber-200";
        if (note.type === 'Observação de Tela') badgeColor = "bg-blue-50 text-blue-600 border-blue-200";

        const noteDate = note.created_at || note.date;
        const noteContent = note.content_html
            ? `<div class="text-zinc-600 text-xs leading-relaxed tiptap-render">${note.content_html}</div>`
            : `<p class="text-zinc-600 text-xs whitespace-pre-wrap leading-relaxed">${note.content_text || ''}</p>`;

        return `
                <div class="bg-white border border-zinc-200 rounded-lg p-4">
                  <div class="flex justify-between items-center mb-2">
                    <span class="text-[10px] font-semibold px-2 py-0.5 rounded border ${badgeColor}">${note.type}</span>
                    <span class="text-[10px] text-zinc-400">${noteDate ? new Date(noteDate).toLocaleString() : ''}</span>
                  </div>
                  ${noteContent}
                </div>
              `;
    }).join('')}
          </div>
        </div>
      ` : ''}
    </div>
    `;

    // ── TAB: Avaliação ──
    const renderEvalTab = () => `
    <div class="p-5 space-y-5">
      <div class="bg-zinc-50 border border-zinc-200 rounded-lg p-4">
        <h4 class="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Registrar Sessão de Estudo</h4>
        <div class="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label class="block text-[10px] font-medium text-zinc-500 mb-1">Flashcards (%)</label>
            <input id="flashcardScore" type="number" min="0" max="100" placeholder="85"
              class="w-full bg-white border border-zinc-200 text-zinc-700 rounded-md px-3 py-2 text-xs focus:outline-none focus:border-zinc-400" />
          </div>
          <div>
            <label class="block text-[10px] font-medium text-zinc-500 mb-1">Feynman (%)</label>
            <input id="selfScore" type="number" min="0" max="100" placeholder="90"
              class="w-full bg-white border border-zinc-200 text-zinc-700 rounded-md px-3 py-2 text-xs focus:outline-none focus:border-zinc-400" />
          </div>
        </div>
        <textarea
          id="explanationText"
          placeholder="Explique o conceito com suas próprias palavras..."
          class="w-full h-24 bg-white border border-zinc-200 rounded-lg p-3 text-xs text-zinc-700 focus:outline-none focus:border-zinc-400 resize-none placeholder:text-zinc-400"
        ></textarea>
        <div class="flex justify-end mt-2">
          <button id="saveEvalBtn" class="flex items-center gap-1.5 bg-zinc-900 hover:bg-zinc-800 disabled:bg-zinc-200 disabled:text-zinc-400 text-white px-4 py-2 rounded-lg text-xs font-medium transition-colors">
            <i data-lucide="save" class="w-3.5 h-3.5"></i> Salvar Avaliação
          </button>
        </div>
      </div>

      ${concept.evaluations && concept.evaluations.length > 0 ? `
        <div>
          <h4 class="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Histórico</h4>
          <div class="space-y-2">
            ${concept.evaluations.map((evalItem) => {
        const fs = evalItem.flashcard_score ?? evalItem.flashcardScore ?? 0;
        const ss = evalItem.self_score ?? evalItem.selfScore ?? evalItem.quizScore ?? 0;
        const avg = Math.round((fs + ss) / 2);
        const evalDate = evalItem.created_at || evalItem.date;
        return `
                <div class="bg-white border border-zinc-200 rounded-lg p-4">
                  <div class="flex flex-wrap items-center gap-2 mb-2">
                    <span class="text-[10px] text-zinc-400">${evalDate ? new Date(evalDate).toLocaleString() : ''}</span>
                    <span class="text-[10px] font-semibold bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded border border-zinc-200">FC: ${fs}%</span>
                    <span class="text-[10px] font-semibold bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded border border-zinc-200">FN: ${ss}%</span>
                    <span class="text-[10px] font-semibold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200">${avg}%</span>
                  </div>
                  <p class="text-xs text-zinc-600 whitespace-pre-wrap leading-relaxed">${evalItem.explanation}</p>
                </div>
              `;
    }).join('')}
          </div>
        </div>
      ` : ''}
    </div>
    `;

    // ── TAB: Configuração ──
    const renderConfigTab = () => `
    <div class="p-5 space-y-4">
      <div>
        <h4 class="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Tags</h4>
        <div class="flex flex-wrap items-center gap-2" id="tag-pills-container">
          ${renderTagPills(concept.tags || [])}
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label class="block text-[10px] font-medium text-zinc-500 mb-1.5">Macro Classe</label>
          <select id="macroSelect" class="w-full bg-white border border-zinc-200 text-zinc-700 text-xs rounded-md px-3 py-2 focus:outline-none focus:border-zinc-400 cursor-pointer">
            <option value="Fundamento" ${concept.macroCategory === 'Fundamento' ? 'selected' : ''}>Fundamento</option>
            <option value="Operacional" ${concept.macroCategory === 'Operacional' ? 'selected' : ''}>Operacional</option>
            <option value="Regras" ${concept.macroCategory === 'Regras' ? 'selected' : ''}>Regras</option>
            <option value="Probabilidades" ${concept.macroCategory === 'Probabilidades' ? 'selected' : ''}>Probabilidades</option>
            <option value="Outros" ${concept.macroCategory === 'Outros' ? 'selected' : ''}>Outros</option>
          </select>
        </div>
        <div>
          <label class="block text-[10px] font-medium text-zinc-500 mb-1.5">Importância</label>
          <select id="importanceSelect" class="w-full bg-white border border-zinc-200 text-zinc-700 text-xs rounded-md px-3 py-2 focus:outline-none focus:border-zinc-400 cursor-pointer">
            <option value="Baixa" ${concept.importance === 'Baixa' ? 'selected' : ''}>Baixa</option>
            <option value="Média" ${concept.importance === 'Média' ? 'selected' : ''}>Média</option>
            <option value="Alta" ${concept.importance === 'Alta' ? 'selected' : ''}>Alta</option>
          </select>
        </div>
        <div>
          <label class="block text-[10px] font-medium text-zinc-500 mb-1.5">Categoria ABC</label>
          <select id="abcSelect" class="w-full bg-white border border-zinc-200 text-zinc-700 text-xs rounded-md px-3 py-2 focus:outline-none focus:border-zinc-400 cursor-pointer">
            <option value="A" ${category === 'A' ? 'selected' : ''}>A — Domínio Alto</option>
            <option value="B" ${category === 'B' ? 'selected' : ''}>B — Em Desenvolvimento</option>
            <option value="C" ${category === 'C' ? 'selected' : ''}>C — Prioridade Máxima</option>
          </select>
        </div>
      </div>

      <div class="bg-zinc-50 border border-zinc-200 rounded-lg p-4">
        <h4 class="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Método ABC — Como Estudar</h4>
        <div class="text-xs text-zinc-600 space-y-1">
          ${category === 'A' ? `
            <p><strong class="text-zinc-800">Ação:</strong> Revisar com simulados e questões, sem repetir videoaulas ou PDFs.</p>
            <p><strong class="text-zinc-800">Objetivo:</strong> Manter o domínio e identificar falhas de interpretação.</p>
          ` : ''}
          ${category === 'B' ? `
            <p><strong class="text-zinc-800">Ação:</strong> Revisar com PDFs, videoaulas pontuais e questões focadas.</p>
            <p><strong class="text-zinc-800">Dica:</strong> Reservar 30 minutos por dia para esses tópicos.</p>
          ` : ''}
          ${category === 'C' ? `
            <p><strong class="text-zinc-800">Ação:</strong> Estudar com videoaulas, PDFs e resumos como primeiro contato.</p>
            <p><strong class="text-zinc-800">Prioridade:</strong> Máxima no cronograma inicial.</p>
          ` : ''}
        </div>
      </div>
    </div>
    `;

    const tabs = [
        { id: 'descricao', label: 'Descrição', icon: 'file-text' },
        { id: 'anotacoes', label: 'Anotações', icon: 'message-square' },
        { id: 'autoavaliacao', label: 'Avaliação', icon: 'bar-chart-2' },
        { id: 'configuracao', label: 'Configuração', icon: 'settings' },
    ];

    const tabRenderers = {
        descricao: renderDescTab,
        anotacoes: renderNotesTab,
        autoavaliacao: renderEvalTab,
        configuracao: renderConfigTab,
    };

    container.innerHTML = `
    <div class="p-6 max-w-4xl mx-auto h-full overflow-y-auto pb-20" id="concept-detail-content">
      
      <!-- Header -->
      <div class="mb-4">
        <div class="flex items-center gap-1.5 mb-1 text-[10px] text-zinc-400 font-medium uppercase tracking-wider">
          <span>${concept.macroCategory || 'Fundamento'}</span>
          <span>/</span>
          <span>${concept.category}</span>
          ${concept.subcategory ? `<span>/</span><span>${concept.subcategory}</span>` : ''}
        </div>
        <h1 class="text-xl font-bold text-zinc-900 tracking-tight">${concept.name}</h1>
      </div>

      <!-- Metrics Bar -->
      <div class="flex flex-wrap items-center gap-3 mb-5 pb-5 border-b border-zinc-200">
        <div class="flex items-center gap-1.5 text-xs">
          <span class="text-zinc-400 font-medium">Retenção:</span>
          <span class="font-semibold text-zinc-800">${mastery}%</span>
        </div>
        <div class="w-px h-4 bg-zinc-200"></div>
        <div class="flex items-center gap-1.5 text-xs">
          <span class="text-zinc-400 font-medium">Categoria:</span>
          <span class="font-bold px-1.5 py-0.5 rounded border text-[10px] ${catBg} ${catColor}">${category}</span>
        </div>
        <div class="w-px h-4 bg-zinc-200"></div>
        <div class="flex items-center gap-1.5 text-xs">
          <span class="text-zinc-400 font-medium">Próxima Revisão:</span>
          <span class="font-semibold text-zinc-800">${concept.nextReview ? new Date(concept.nextReview).toLocaleDateString() : 'Não agendada'}</span>
        </div>
        ${concept.probabilidade ? `
          <div class="w-px h-4 bg-zinc-200"></div>
          <div class="flex items-center gap-1.5 text-xs">
            <span class="text-zinc-400 font-medium">Win Rate:</span>
            <span class="font-semibold text-zinc-800">${concept.probabilidade}</span>
          </div>
        ` : ''}
        ${(concept.moduloCurso || concept.aulaCurso) ? `
          <div class="w-px h-4 bg-zinc-200"></div>
          <button
            id="course-badge-btn"
            class="flex items-center gap-1.5 text-xs group hover:opacity-80 transition-opacity"
            title="Ver todos os conceitos deste módulo"
          >
            <i data-lucide="book-open" class="w-3 h-3 text-indigo-400 shrink-0"></i>
            <span class="text-zinc-400 font-medium">Módulo:</span>
            <span class="font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded text-[10px] group-hover:bg-indigo-100 transition-colors truncate max-w-[200px]"
              title="${concept.aulaCurso || concept.moduloCurso}">
              ${concept.aulaCurso || concept.moduloCurso}
            </span>
          </button>
        ` : ''}
      </div>

      <!-- Tabs -->
      <div class="bg-white border border-zinc-200 rounded-xl overflow-hidden">
        <div class="tabs">
          ${tabs.map(t => `
            <button class="tab ${activeTab === t.id ? 'active' : ''}" data-tab-id="${t.id}">
              <i data-lucide="${t.icon}" class="w-3.5 h-3.5"></i>
              ${t.label}
            </button>
          `).join('')}
        </div>
        ${tabs.map(t => `
          <div class="tab-panel ${activeTab === t.id ? 'active' : ''}" data-panel-id="${t.id}">
            ${tabRenderers[t.id]()}
          </div>
        `).join('')}
      </div>
    </div>
  `;

    if (window.lucide) window.lucide.createIcons();

    // ── Editor Rico (Tab Descrição) ──
    if (activeTab === 'descricao') {
        const editorContainer = document.getElementById('rich-editor-container');
        if (editorContainer) {
            const initialHtml = concept.description?.content_html || '';
            const toolbarEl = document.getElementById('rich-toolbar');

            (async () => {
                const editor = await createRichEditor('rich-editor-container', initialHtml, async (html, text) => {
                    await upsertConceptDescription(concept.name, html, text);
                    const indicator = document.getElementById('save-indicator');
                    if (indicator) {
                        indicator.style.opacity = '1';
                        setTimeout(() => { indicator.style.opacity = '0'; }, 2000);
                    }
                });

                // ── Modo Foco ──
                document.getElementById('desc-focus-btn')?.addEventListener('click', () => {
                    const editorContainer = document.getElementById('rich-editor-container');
                    const isFocus = editorContainer?.classList.toggle('desc-focus-mode');
                    if (isFocus) {
                        editorContainer.style.cssText = [
                            'position:fixed', 'inset:0', 'z-index:50',
                            'background:white', 'padding:2rem',
                            'overflow-y:auto', 'max-width:100%',
                            'border-radius:0', 'border:none', 'box-shadow:none'
                        ].join(';');
                        const btn = document.getElementById('desc-focus-btn');
                        btn?.querySelector('[data-lucide]')?.setAttribute('data-lucide', 'minimize-2');
                        if (window.lucide) window.lucide.createIcons({ nodes: btn?.querySelectorAll('[data-lucide]') });
                    } else {
                        editorContainer.style.cssText = '';
                        const btn = document.getElementById('desc-focus-btn');
                        btn?.querySelector('[data-lucide]')?.setAttribute('data-lucide', 'maximize-2');
                        if (window.lucide) window.lucide.createIcons({ nodes: btn?.querySelectorAll('[data-lucide]') });
                    }
                    editor?.commands.focus();
                });

                if (editor && toolbarEl) {
                    attachFloatingToolbar(editor, toolbarEl);
                    if (window.lucide) window.lucide.createIcons({ nodes: toolbarEl.querySelectorAll('[data-lucide]') });

                    toolbarEl.querySelectorAll('button[data-action]').forEach(btn => {
                        btn.addEventListener('mousedown', (e) => {
                            e.preventDefault();
                            const action = btn.getAttribute('data-action');
                            switch (action) {
                                case 'bold':        editor.chain().focus().toggleBold().run(); break;
                                case 'italic':      editor.chain().focus().toggleItalic().run(); break;
                                case 'strike':      editor.chain().focus().toggleStrike().run(); break;
                                case 'h1':          editor.chain().focus().toggleHeading({ level: 1 }).run(); break;
                                case 'h2':          editor.chain().focus().toggleHeading({ level: 2 }).run(); break;
                                case 'highlight':   editor.chain().focus().toggleHighlight().run(); break;
                                case 'bulletList':  editor.chain().focus().toggleBulletList().run(); break;
                                case 'orderedList': editor.chain().focus().toggleOrderedList().run(); break;
                            }
                        });
                    });
                }
            })();
        }
    }

    // ── Tab Switching ──
    container.querySelectorAll('.tab').forEach(tabBtn => {
        tabBtn.addEventListener('click', () => {
            activeTab = tabBtn.getAttribute('data-tab-id');
            renderConceptDetail(container, store.getState().concepts.find(c => c.id === concept.id));
        });
    });

    // ── Badge Módulo/Aula → navega para lista filtrada ──
    document.getElementById('course-badge-btn')?.addEventListener('click', () => {
        store.setState({
            selectedConceptId: null,
            currentPage: 'concepts',
            conceptSearchTerm: concept.moduloCurso || ''
        });
    });

    // ── Config Tab Listeners ──
    document.getElementById('macroSelect')?.addEventListener('change', (e) => {
        updateMacroCategory(concept.name, e.target.value);
    });
    document.getElementById('importanceSelect')?.addEventListener('change', (e) => {
        updateImportance(concept.name, e.target.value);
    });
    document.getElementById('abcSelect')?.addEventListener('change', (e) => {
        updateABC(concept.name, e.target.value);
    });

    // Tags
    const tagPillsContainer = document.getElementById('tag-pills-container');
    if (tagPillsContainer) {
        attachTagListeners(tagPillsContainer, concept.name, concept.tags || []);
    }

    // Note form
    const saveNoteBtn = document.getElementById('saveNoteBtn');
    if (saveNoteBtn) {
        const noteTextEl = document.getElementById('noteText');
        const updateBtnState = () => {
            saveNoteBtn.disabled = !noteTextEl.value.trim();
        };
        noteTextEl.addEventListener('input', updateBtnState);
        updateBtnState();

        saveNoteBtn.addEventListener('click', () => {
            const text = noteTextEl.value.trim();
            const type = document.getElementById('noteType').value;
            if (text) addNote(concept.name, type, text);
        });
    }

    // Eval Form
    const saveEvalBtn = document.getElementById('saveEvalBtn');
    if (saveEvalBtn) {
        const fsEl = document.getElementById('flashcardScore');
        const qsEl = document.getElementById('selfScore');
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
            if (!isNaN(fs) && !isNaN(qs) && expl) addEvaluation(concept.name, fs, qs, expl);
        });
    }
}
