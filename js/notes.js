// js/notes.js
// View principal /notes: sidebar de hierarquia de páginas + editor Tiptap full-page

import { store } from './state.js';
import {
    getAllFreeNotes, getFreeNoteById, createFreeNote,
    updateFreeNoteMetadata, saveFreeNoteContent, deleteFreeNote
} from './dataService.js';
import { createRichEditor, attachFloatingToolbar } from './rich-editor.js';

// ─── Estado local ──────────────────────────────────────────────────────────────
let notesTree = [];
let activeNoteId = null;
let activeEditor = null;

// ─── Ponto de entrada ─────────────────────────────────────────────────────────

export async function renderNotes(container) {
    container.innerHTML = `
      <div class="flex h-full" id="notes-root">

        <!-- Sidebar de hierarquia -->
        <aside id="notes-sidebar"
          class="w-56 shrink-0 border-r border-zinc-200 bg-white flex-col h-full overflow-hidden hidden md:flex">
          <div class="flex items-center justify-between px-4 py-3 border-b border-zinc-100 shrink-0">
            <span class="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Notas</span>
            <button id="new-root-note-btn" title="Nova nota"
              class="p-1 rounded hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 transition-colors">
              <i data-lucide="plus" class="w-4 h-4"></i>
            </button>
          </div>
          <div id="notes-tree" class="flex-1 overflow-y-auto py-2 px-2 space-y-0.5"></div>
        </aside>

        <!-- Área do editor -->
        <main class="flex-1 flex flex-col h-full overflow-hidden min-w-0">

          <!-- Placeholder (nenhuma nota selecionada) -->
          <div id="notes-editor-placeholder"
            class="flex-1 flex flex-col items-center justify-center text-zinc-400 select-none gap-3 p-8">
            <i data-lucide="notebook-pen" class="w-12 h-12 opacity-20"></i>
            <p class="text-sm font-medium">Selecione uma nota ou crie uma nova</p>
            <button id="new-note-from-placeholder-btn"
              class="mt-1 px-4 py-2 bg-zinc-900 text-white text-xs font-medium rounded-lg hover:bg-zinc-800 transition-colors">
              Nova Nota
            </button>
          </div>

          <!-- Editor ativo -->
          <div id="notes-editor-wrapper" class="flex-1 flex flex-col h-full overflow-hidden hidden">

            <!-- Header da nota -->
            <div id="notes-editor-header"
              class="flex items-center gap-3 px-8 py-4 border-b border-zinc-100 bg-white shrink-0">
              <button id="notes-emoji-btn"
                class="text-2xl hover:opacity-70 transition-opacity leading-none select-none"
                title="Mudar emoji">📄</button>
              <input id="notes-title-input" type="text"
                placeholder="Sem título"
                class="flex-1 text-xl font-bold text-zinc-900 bg-transparent border-none outline-none placeholder:text-zinc-300 min-w-0"
              />
              <div class="flex items-center gap-1 shrink-0">
                <span id="notes-save-indicator"
                  class="text-[10px] text-emerald-600 font-medium opacity-0 transition-opacity duration-300 mr-1">
                  Salvo
                </span>
                <button id="notes-focus-btn" title="Modo foco"
                  class="p-1.5 rounded hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 transition-colors">
                  <i data-lucide="maximize-2" class="w-4 h-4"></i>
                </button>
                <button id="notes-add-child-btn" title="Nova sub-nota"
                  class="p-1.5 rounded hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 transition-colors">
                  <i data-lucide="file-plus" class="w-4 h-4"></i>
                </button>
                <button id="notes-delete-btn" title="Deletar nota"
                  class="p-1.5 rounded hover:bg-red-50 text-zinc-400 hover:text-red-500 transition-colors">
                  <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
              </div>
            </div>

            <!-- Toolbar Tiptap flutuante -->
            <div class="rich-toolbar" id="notes-rich-toolbar" style="display:none;position:relative;">
              <button data-action="bold" title="Negrito"><i data-lucide="bold" class="w-3.5 h-3.5 text-inherit"></i></button>
              <button data-action="italic" title="Itálico"><i data-lucide="italic" class="w-3.5 h-3.5 text-inherit"></i></button>
              <button data-action="strike" title="Tachado"><i data-lucide="strikethrough" class="w-3.5 h-3.5 text-inherit"></i></button>
              <div class="toolbar-sep"></div>
              <button data-action="h1" title="Título 1"><i data-lucide="heading-1" class="w-4 h-4 text-inherit"></i></button>
              <button data-action="h2" title="Título 2"><i data-lucide="heading-2" class="w-4 h-4 text-inherit"></i></button>
              <button data-action="h3" title="Título 3"><i data-lucide="heading-3" class="w-4 h-4 text-inherit"></i></button>
              <div class="toolbar-sep"></div>
              <button data-action="highlight" title="Destaque"><i data-lucide="highlighter" class="w-3.5 h-3.5 text-inherit"></i></button>
              <button data-action="bulletList" title="Lista"><i data-lucide="list" class="w-3.5 h-3.5 text-inherit"></i></button>
              <button data-action="orderedList" title="Lista numerada"><i data-lucide="list-ordered" class="w-3.5 h-3.5 text-inherit"></i></button>
              <div class="toolbar-sep"></div>
              <button data-action="blockquote" title="Citação"><i data-lucide="quote" class="w-3.5 h-3.5 text-inherit"></i></button>
              <button data-action="codeBlock" title="Bloco de código"><i data-lucide="code" class="w-3.5 h-3.5 text-inherit"></i></button>
              <button data-action="horizontalRule" title="Divisor"><i data-lucide="minus" class="w-3.5 h-3.5 text-inherit"></i></button>
            </div>

            <!-- Editor Tiptap -->
            <div class="flex-1 overflow-y-auto">
              <div id="notes-rich-editor"
                class="min-h-full max-w-3xl mx-auto px-8 py-6">
              </div>
            </div>
          </div>
        </main>
      </div>
    `;

    if (window.lucide) window.lucide.createIcons();

    // Carregar árvore
    await loadAndRenderTree();

    // Listeners globais
    document.getElementById('new-root-note-btn')
        ?.addEventListener('click', () => createAndOpenNote(null));
    document.getElementById('new-note-from-placeholder-btn')
        ?.addEventListener('click', () => createAndOpenNote(null));
    document.getElementById('notes-focus-btn')
        ?.addEventListener('click', toggleFocusMode);
    document.getElementById('notes-delete-btn')
        ?.addEventListener('click', handleDeleteNote);
    document.getElementById('notes-add-child-btn')
        ?.addEventListener('click', () => { if (activeNoteId) createAndOpenNote(activeNoteId); });
}

// ─── Árvore ───────────────────────────────────────────────────────────────────

async function loadAndRenderTree() {
    notesTree = await getAllFreeNotes();
    renderTree();
}

function buildTree(nodes, parentId = null) {
    return nodes
        .filter(n => (n.parent_id ?? null) === parentId)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map(n => ({ ...n, children: buildTree(nodes, n.id) }));
}

function renderTree() {
    const container = document.getElementById('notes-tree');
    if (!container) return;
    const tree = buildTree(notesTree);
    container.innerHTML = tree.length > 0
        ? tree.map(n => renderTreeNode(n, 0)).join('')
        : `<p class="text-xs text-zinc-400 px-2 py-2">Nenhuma nota ainda.<br>Crie sua primeira nota.</p>`;
    if (window.lucide) window.lucide.createIcons();

    container.querySelectorAll('[data-note-id]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.getAttribute('data-note-id');
            if (id) openNote(id);
        });
    });

    container.querySelectorAll('[data-new-child-id]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            createAndOpenNote(e.currentTarget.getAttribute('data-new-child-id'));
        });
    });
}

function renderTreeNode(node, depth) {
    const pl = 8 + depth * 12;
    const isActive = node.id === activeNoteId;
    const activeClass = isActive
        ? 'bg-zinc-100 text-zinc-900 font-semibold'
        : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900';
    const emoji = node.emoji || '📄';
    const children = (node.children || []).map(c => renderTreeNode(c, depth + 1)).join('');

    return `
      <div>
        <button data-note-id="${node.id}"
          class="w-full flex items-center gap-1.5 py-1 px-2 rounded-md text-[13px] transition-colors group ${activeClass}"
          style="padding-left:${pl}px">
          <span class="shrink-0 text-sm leading-none">${emoji}</span>
          <span class="flex-1 truncate text-left">${node.title || 'Sem título'}</span>
          <button data-new-child-id="${node.id}"
            class="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-zinc-200 transition-all shrink-0"
            title="Nova sub-nota">
            <i data-lucide="plus" class="w-3 h-3"></i>
          </button>
        </button>
        ${children}
      </div>
    `;
}

// ─── Abrir nota ───────────────────────────────────────────────────────────────

async function openNote(id) {
    if (activeNoteId === id) return;

    // Destruir editor anterior
    if (activeEditor) { activeEditor.destroy(); activeEditor = null; }

    activeNoteId = id;
    renderTree();

    // Mostrar wrapper
    document.getElementById('notes-editor-placeholder')?.classList.add('hidden');
    const wrapper = document.getElementById('notes-editor-wrapper');
    wrapper?.classList.remove('hidden');

    // Buscar nota completa
    const note = await getFreeNoteById(id);
    if (!note) return;

    // Preencher header
    const titleInput = document.getElementById('notes-title-input');
    const emojiBtn = document.getElementById('notes-emoji-btn');
    if (titleInput) {
        titleInput.value = note.title || '';
        titleInput.oninput = null;
        let renameTimer;
        titleInput.addEventListener('input', (e) => {
            clearTimeout(renameTimer);
            renameTimer = setTimeout(async () => {
                const title = e.target.value.trim() || 'Sem título';
                await updateFreeNoteMetadata(id, { title });
                const idx = notesTree.findIndex(n => n.id === id);
                if (idx >= 0) notesTree[idx].title = title;
                renderTree();
            }, 700);
        });
    }
    if (emojiBtn) emojiBtn.textContent = note.emoji || '📄';

    // Limpar container do editor
    const editorEl = document.getElementById('notes-rich-editor');
    if (editorEl) editorEl.innerHTML = '';

    // Inicializar Tiptap
    const toolbar = document.getElementById('notes-rich-toolbar');
    activeEditor = await createRichEditor('notes-rich-editor', note.content_html || '', async (html, text) => {
        await saveFreeNoteContent(id, html, text);
        const indicator = document.getElementById('notes-save-indicator');
        if (indicator) {
            indicator.style.opacity = '1';
            setTimeout(() => { indicator.style.opacity = '0'; }, 2000);
        }
    });

    if (activeEditor && toolbar) {
        attachFloatingToolbar(activeEditor, toolbar);
        if (window.lucide) window.lucide.createIcons({ nodes: toolbar.querySelectorAll('[data-lucide]') });

        toolbar.querySelectorAll('button[data-action]').forEach(btn => {
            btn.addEventListener('mousedown', (e) => {
                e.preventDefault();
                const action = btn.getAttribute('data-action');
                switch (action) {
                    case 'bold':           activeEditor.chain().focus().toggleBold().run(); break;
                    case 'italic':         activeEditor.chain().focus().toggleItalic().run(); break;
                    case 'strike':         activeEditor.chain().focus().toggleStrike().run(); break;
                    case 'h1':             activeEditor.chain().focus().toggleHeading({ level: 1 }).run(); break;
                    case 'h2':             activeEditor.chain().focus().toggleHeading({ level: 2 }).run(); break;
                    case 'h3':             activeEditor.chain().focus().toggleHeading({ level: 3 }).run(); break;
                    case 'highlight':      activeEditor.chain().focus().toggleHighlight().run(); break;
                    case 'bulletList':     activeEditor.chain().focus().toggleBulletList().run(); break;
                    case 'orderedList':    activeEditor.chain().focus().toggleOrderedList().run(); break;
                    case 'blockquote':     activeEditor.chain().focus().toggleBlockquote().run(); break;
                    case 'codeBlock':      activeEditor.chain().focus().toggleCodeBlock().run(); break;
                    case 'horizontalRule': activeEditor.chain().focus().setHorizontalRule().run(); break;
                }
            });
        });
    }
}

// ─── Criar nota ───────────────────────────────────────────────────────────────

async function createAndOpenNote(parentId) {
    const note = await createFreeNote({ parent_id: parentId || null, sort_order: notesTree.length });
    if (!note) return;
    notesTree.push({
        id: note.id, title: note.title, emoji: note.emoji,
        parent_id: note.parent_id, sort_order: note.sort_order
    });
    await openNote(note.id);
    setTimeout(() => document.getElementById('notes-title-input')?.focus(), 150);
}

// ─── Deletar nota ─────────────────────────────────────────────────────────────

async function handleDeleteNote() {
    if (!activeNoteId) return;
    if (!confirm('Deletar esta nota e todas as sub-páginas?')) return;
    await deleteFreeNote(activeNoteId);
    // Remover do cache local (incluindo possíveis filhos — o CASCADE no banco cuida do resto)
    const toRemove = collectDescendants(activeNoteId);
    notesTree = notesTree.filter(n => !toRemove.has(n.id));
    activeNoteId = null;
    if (activeEditor) { activeEditor.destroy(); activeEditor = null; }
    document.getElementById('notes-editor-wrapper')?.classList.add('hidden');
    document.getElementById('notes-editor-placeholder')?.classList.remove('hidden');
    renderTree();
}

function collectDescendants(id) {
    const set = new Set([id]);
    const queue = [id];
    while (queue.length > 0) {
        const current = queue.shift();
        notesTree.filter(n => n.parent_id === current).forEach(n => {
            set.add(n.id);
            queue.push(n.id);
        });
    }
    return set;
}

// ─── Modo Foco ────────────────────────────────────────────────────────────────

function toggleFocusMode() {
    const root = document.getElementById('notes-root');
    const sidebar = document.getElementById('notes-sidebar');
    const focusBtn = document.getElementById('notes-focus-btn');
    if (!root) return;

    const isFocus = root.classList.toggle('notes-focus-mode');
    if (isFocus) {
        sidebar?.classList.add('!hidden');
        const icon = focusBtn?.querySelector('[data-lucide]');
        icon?.setAttribute('data-lucide', 'minimize-2');
        focusBtn?.setAttribute('title', 'Sair do modo foco');
    } else {
        sidebar?.classList.remove('!hidden');
        const icon = focusBtn?.querySelector('[data-lucide]');
        icon?.setAttribute('data-lucide', 'maximize-2');
        focusBtn?.setAttribute('title', 'Modo foco');
    }
    if (window.lucide) window.lucide.createIcons({ nodes: focusBtn?.querySelectorAll('[data-lucide]') });
}
