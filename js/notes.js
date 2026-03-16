// js/notes.js
// View principal /notes — Editor profissional de notas livres
// Inspirado em Notion, Obsidian, Typora

import { store } from './state.js';
import {
    getAllFreeNotes, getFreeNoteById, createFreeNote,
    updateFreeNoteMetadata, saveFreeNoteContent, deleteFreeNote
} from './dataService.js';
import { setConceptInitialTab } from './concept-detail.js';
import {
    createRichEditor, buildFixedToolbarHTML, attachFixedToolbar,
    insertImageInEditor, insertCommentBlock,
    attachImagePopupHandler, attachInlineDeleteHandlers
} from './rich-editor.js';
import { supabase } from './supabaseClient.js';

const BUCKET = 'concept-images';

async function uploadNoteImage(file) {
    if (!file || !file.type.startsWith('image/')) return null;
    if (file.size > 5 * 1024 * 1024) { alert('Imagem muito grande. Limite: 5MB.'); return null; }
    const ext = file.name.split('.').pop() || 'png';
    const path = `note-images/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, { cacheControl: '3600', upsert: false });
    if (error) { console.error('uploadNoteImage:', error); alert('Falha ao enviar imagem.'); return null; }
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return data.publicUrl;
}

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
          class="w-64 shrink-0 border-r border-zinc-200 bg-white flex-col h-full overflow-hidden hidden md:flex">

          <!-- Header notas livres -->
          <div class="flex items-center justify-between px-4 py-3 border-b border-zinc-100 shrink-0">
            <div class="flex items-center gap-2">
              <i data-lucide="notebook-pen" class="w-4 h-4 text-zinc-400"></i>
              <span class="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Notas Livres</span>
            </div>
            <button id="new-root-note-btn" title="Nova nota"
              class="p-1.5 rounded-lg hover:bg-emerald-50 text-zinc-400 hover:text-emerald-600 transition-colors">
              <i data-lucide="plus" class="w-4 h-4"></i>
            </button>
          </div>

          <!-- Search -->
          <div class="px-3 py-2 border-b border-zinc-100 shrink-0">
            <div class="relative">
              <i data-lucide="search" class="w-3.5 h-3.5 text-zinc-300 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"></i>
              <input id="notes-search" type="text" placeholder="Buscar notas..."
                class="w-full text-xs bg-zinc-50 border border-zinc-200 rounded-lg pl-8 pr-3 py-2 outline-none focus:border-zinc-400 transition-colors" />
            </div>
          </div>

          <!-- Árvore de notas livres -->
          <div id="notes-tree" class="overflow-y-auto py-2 px-2 space-y-0.5 flex-1" style="max-height: 45%"></div>

          <!-- Separador -->
          <div class="border-t border-zinc-100 mx-3"></div>

          <!-- Header conceitos -->
          <div class="flex items-center px-4 py-2 shrink-0">
            <i data-lucide="book-open" class="w-3.5 h-3.5 text-zinc-400 mr-2"></i>
            <span class="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Por Conceito</span>
          </div>

          <!-- Árvore de conceitos por categoria -->
          <div id="concept-notes-tree" class="flex-1 overflow-y-auto py-1 px-2 space-y-0.5"></div>
        </aside>

        <!-- Botão mobile para sidebar -->
        <button id="notes-mobile-sidebar-btn"
          class="md:hidden fixed bottom-20 left-4 z-20 bg-zinc-900 text-white p-3 rounded-full shadow-lg">
          <i data-lucide="sidebar" class="w-4 h-4"></i>
        </button>

        <!-- Drawer mobile -->
        <div id="notes-mobile-drawer" class="md:hidden fixed inset-0 z-30 hidden">
          <div class="absolute inset-0 bg-black/40" id="notes-drawer-overlay"></div>
          <aside class="absolute left-0 top-0 h-full w-72 bg-white shadow-2xl flex flex-col">
            <div class="flex items-center justify-between px-4 py-3 border-b border-zinc-100">
              <span class="text-sm font-semibold text-zinc-700">Notas</span>
              <button id="notes-drawer-close" class="p-1.5 rounded hover:bg-zinc-100 text-zinc-400">
                <i data-lucide="x" class="w-4 h-4"></i>
              </button>
            </div>
            <div class="flex items-center justify-between px-4 py-2 border-b border-zinc-100">
              <span class="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Notas Livres</span>
              <button id="new-root-note-btn-mobile" class="p-1 rounded hover:bg-zinc-100 text-zinc-400">
                <i data-lucide="plus" class="w-3.5 h-3.5"></i>
              </button>
            </div>
            <div id="notes-tree-mobile" class="overflow-y-auto py-2 px-2" style="max-height:35%"></div>
            <div class="border-t border-zinc-100 mx-3"></div>
            <div class="flex items-center px-4 py-2">
              <i data-lucide="book-open" class="w-3.5 h-3.5 text-zinc-400 mr-2"></i>
              <span class="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Por Conceito</span>
            </div>
            <div id="concept-notes-tree-mobile" class="flex-1 overflow-y-auto py-1 px-2"></div>
          </aside>
        </div>

        <!-- Área do editor -->
        <main class="flex-1 flex flex-col h-full overflow-hidden min-w-0">

          <!-- Placeholder -->
          <div id="notes-editor-placeholder"
            class="flex-1 flex flex-col items-center justify-center text-zinc-400 select-none gap-4 p-8">
            <div class="w-20 h-20 rounded-2xl bg-zinc-100 flex items-center justify-center">
              <i data-lucide="notebook-pen" class="w-10 h-10 text-zinc-300"></i>
            </div>
            <div class="text-center">
              <p class="text-sm font-semibold text-zinc-500 mb-1">Nenhuma nota selecionada</p>
              <p class="text-xs text-zinc-400">Selecione uma nota na sidebar ou crie uma nova</p>
            </div>
            <button id="new-note-from-placeholder-btn"
              class="mt-2 px-5 py-2.5 bg-zinc-900 text-white text-xs font-semibold rounded-xl hover:bg-zinc-800 transition-colors flex items-center gap-2">
              <i data-lucide="plus" class="w-3.5 h-3.5"></i>
              Nova Nota
            </button>
          </div>

          <!-- Editor ativo -->
          <div id="notes-editor-wrapper" class="flex-1 flex flex-col h-full overflow-hidden hidden">

            <!-- Header da nota -->
            <div id="notes-editor-header"
              class="flex items-center gap-3 px-6 py-3 border-b border-zinc-100 bg-white shrink-0">
              <button id="notes-emoji-btn"
                class="text-2xl hover:scale-110 transition-transform leading-none select-none"
                title="Mudar emoji">📄</button>
              <input id="notes-title-input" type="text"
                placeholder="Sem título"
                class="flex-1 text-xl font-bold text-zinc-900 bg-transparent border-none outline-none placeholder:text-zinc-300 min-w-0"
              />
              <div class="flex items-center gap-1 shrink-0">
                <span id="notes-save-indicator"
                  class="text-[10px] text-emerald-600 font-medium opacity-0 transition-opacity duration-300 mr-1 flex items-center gap-1">
                  <i data-lucide="check-circle" class="w-3 h-3"></i> Salvo
                </span>
                <button id="notes-focus-btn" title="Modo foco"
                  class="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 transition-colors">
                  <i data-lucide="maximize-2" class="w-4 h-4"></i>
                </button>
                <button id="notes-add-child-btn" title="Nova sub-nota"
                  class="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 transition-colors">
                  <i data-lucide="file-plus" class="w-4 h-4"></i>
                </button>
                <button id="notes-delete-btn" title="Deletar nota"
                  class="p-1.5 rounded-lg hover:bg-red-50 text-zinc-400 hover:text-red-500 transition-colors">
                  <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
              </div>
            </div>

            <!-- Toolbar fixa profissional -->
            ${buildFixedToolbarHTML()}

            <!-- Hidden file input for image upload -->
            <input type="file" id="notes-img-file-input" accept="image/*" style="display:none">

            <!-- Editor Tiptap -->
            <div class="flex-1 overflow-y-auto notes-editor-scroll bg-white">
              <div id="notes-rich-editor" class="min-h-full max-w-3xl mx-auto px-6 md:px-10 py-8"></div>
            </div>

            <!-- Footer com estatísticas -->
            <div id="notes-footer" class="flex items-center justify-between px-6 py-2 border-t border-zinc-100 bg-zinc-50/80 shrink-0">
              <div class="flex items-center gap-4 text-[10px] text-zinc-400 font-medium">
                <span id="notes-word-count">0 palavras</span>
                <span id="notes-char-count">0 caracteres</span>
              </div>
              <div class="flex items-center gap-3 text-[10px] text-zinc-400">
                <span class="flex items-center gap-1">
                  <i data-lucide="keyboard" class="w-3 h-3"></i>
                  <kbd class="bg-zinc-200 px-1 rounded text-[9px]">/</kbd> para blocos
                </span>
                <span class="flex items-center gap-1">
                  <kbd class="bg-zinc-200 px-1 rounded text-[9px]">Ctrl+S</kbd> salva
                </span>
              </div>
            </div>
          </div>
        </main>
      </div>
    `;

    if (window.lucide) window.lucide.createIcons();

    await loadAndRenderTree();
    renderConceptNotesTree();

    // ── Listeners ──
    document.getElementById('new-root-note-btn')
        ?.addEventListener('click', () => createAndOpenNote(null));
    document.getElementById('new-root-note-btn-mobile')
        ?.addEventListener('click', () => { createAndOpenNote(null); closeMobileDrawer(); });
    document.getElementById('new-note-from-placeholder-btn')
        ?.addEventListener('click', () => createAndOpenNote(null));
    document.getElementById('notes-focus-btn')
        ?.addEventListener('click', toggleFocusMode);
    document.addEventListener('keydown', _escFocusHandler);
    document.getElementById('notes-delete-btn')
        ?.addEventListener('click', handleDeleteNote);
    document.getElementById('notes-add-child-btn')
        ?.addEventListener('click', () => { if (activeNoteId) createAndOpenNote(activeNoteId); });

    // Mobile drawer
    document.getElementById('notes-mobile-sidebar-btn')
        ?.addEventListener('click', openMobileDrawer);
    document.getElementById('notes-drawer-close')
        ?.addEventListener('click', closeMobileDrawer);
    document.getElementById('notes-drawer-overlay')
        ?.addEventListener('click', closeMobileDrawer);

    // Image file input handler
    document.getElementById('notes-img-file-input')?.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file || !activeEditor) return;
        const url = await uploadNoteImage(file);
        if (url) insertImageInEditor(activeEditor, url);
    });

    // Search notes
    document.getElementById('notes-search')?.addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase().trim();
        filterTreeBySearch(q);
    });

    // Word count listener
    window.addEventListener('editor-stats', (e) => {
        const { words, chars } = e.detail;
        const wc = document.getElementById('notes-word-count');
        const cc = document.getElementById('notes-char-count');
        if (wc) wc.textContent = `${words} palavra${words !== 1 ? 's' : ''}`;
        if (cc) cc.textContent = `${chars} caractere${chars !== 1 ? 's' : ''}`;
    });

    // Ctrl+S to force save
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            if (activeEditor) {
                const html = activeEditor.getHTML();
                const text = activeEditor.getText();
                if (activeNoteId) saveFreeNoteContent(activeNoteId, html, text);
                const indicator = document.getElementById('notes-save-indicator');
                if (indicator) { indicator.style.opacity = '1'; setTimeout(() => indicator.style.opacity = '0', 2000); }
            }
        }
    });
}

function openMobileDrawer() {
    document.getElementById('notes-mobile-drawer')?.classList.remove('hidden');
}
function closeMobileDrawer() {
    document.getElementById('notes-mobile-drawer')?.classList.add('hidden');
}

function _escFocusHandler(e) {
    if (e.key === 'Escape' && document.getElementById('notes-root')?.classList.contains('notes-focus-mode')) {
        toggleFocusMode();
    }
}

// ─── Busca na árvore ──────────────────────────────────────────────────────────

function filterTreeBySearch(query) {
    ['notes-tree', 'notes-tree-mobile'].forEach(id => {
        const container = document.getElementById(id);
        if (!container) return;
        container.querySelectorAll('[data-note-id]').forEach(btn => {
            const title = btn.querySelector('.note-title-text')?.textContent?.toLowerCase() || '';
            const match = !query || title.includes(query);
            btn.closest('.note-tree-item')?.classList.toggle('hidden', !match);
        });
    });
}

// ─── Árvore de notas livres ───────────────────────────────────────────────────

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
    ['notes-tree', 'notes-tree-mobile'].forEach(id => {
        const container = document.getElementById(id);
        if (!container) return;
        const tree = buildTree(notesTree);
        container.innerHTML = tree.length > 0
            ? tree.map(n => renderTreeNode(n, 0)).join('')
            : `<div class="flex flex-col items-center py-6 text-center">
                <i data-lucide="file-text" class="w-8 h-8 text-zinc-200 mb-2"></i>
                <p class="text-xs text-zinc-400">Nenhuma nota ainda</p>
               </div>`;
        if (window.lucide) window.lucide.createIcons();

        container.querySelectorAll('[data-note-id]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const noteId = e.currentTarget.getAttribute('data-note-id');
                if (noteId) { openNote(noteId); closeMobileDrawer(); }
            });
        });
        container.querySelectorAll('[data-new-child-id]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                createAndOpenNote(e.currentTarget.getAttribute('data-new-child-id'));
            });
        });
    });
}

function renderTreeNode(node, depth) {
    const pl = 8 + depth * 14;
    const isActive = node.id === activeNoteId;
    const activeClass = isActive
        ? 'bg-emerald-50 text-emerald-800 font-semibold border-l-2 border-emerald-500'
        : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 border-l-2 border-transparent';
    const emoji = node.emoji || '📄';
    const children = (node.children || []).map(c => renderTreeNode(c, depth + 1)).join('');
    return `
      <div class="note-tree-item">
        <button data-note-id="${node.id}"
          class="w-full flex items-center gap-2 py-1.5 px-2 rounded-lg text-[13px] transition-all group ${activeClass}"
          style="padding-left:${pl}px">
          <span class="shrink-0 text-sm leading-none">${emoji}</span>
          <span class="flex-1 truncate text-left note-title-text">${node.title || 'Sem título'}</span>
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

// ─── Árvore de conceitos por categoria ───────────────────────────────────────

function renderConceptNotesTree() {
    const { concepts } = store.getState();
    if (!concepts || concepts.length === 0) return;

    const byCategory = {};
    concepts.forEach(c => {
        const cat = c.category || 'Outros';
        if (!byCategory[cat]) byCategory[cat] = [];
        byCategory[cat].push(c);
    });

    const abcColors = {
        A: 'bg-indigo-50 text-indigo-600 border-indigo-200',
        B: 'bg-emerald-50 text-emerald-600 border-emerald-200',
        C: 'bg-amber-50 text-amber-600 border-amber-200',
        D: 'bg-violet-50 text-violet-600 border-violet-200',
        E: 'bg-zinc-100 text-zinc-500 border-zinc-300',
    };

    const treeHTML = Object.entries(byCategory).sort(([a], [b]) => a.localeCompare(b)).map(([cat, catConcepts]) => {
        const totalNotes = catConcepts.reduce((s, c) => s + (c.notesList?.length || 0), 0);
        const conceptItems = catConcepts.sort((a, b) => a.name.localeCompare(b.name)).map(c => {
            const noteCount = (c.notesList?.length || 0);
            const abc = c.abcCategory || 'B';
            const abcStyle = abcColors[abc] || abcColors.B;
            return `
              <button class="concept-note-item w-full flex items-center gap-2 py-1.5 px-2 rounded-lg text-[12px] text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 transition-colors group"
                style="padding-left:20px" data-concept-id="${c.id}">
                <i data-lucide="file-text" class="w-3.5 h-3.5 shrink-0 text-zinc-300 group-hover:text-zinc-500"></i>
                <span class="flex-1 text-left truncate leading-snug">${c.name}</span>
                <span class="text-[9px] font-bold px-1 py-0.5 rounded border shrink-0 ${abcStyle}">${abc}</span>
                ${noteCount > 0 ? `<span class="text-[10px] font-semibold text-zinc-400 shrink-0">${noteCount}</span>` : ''}
              </button>
            `;
        }).join('');

        return `
          <div class="cat-folder-wrapper">
            <button class="cat-folder-btn w-full flex items-center gap-2 py-1.5 px-2 rounded-lg text-[12px] font-medium text-zinc-500 hover:text-zinc-800 hover:bg-zinc-50 transition-colors" data-cat-folder="${cat}">
              <i data-lucide="folder" class="w-3.5 h-3.5 shrink-0 text-zinc-400 folder-icon"></i>
              <span class="flex-1 text-left truncate">${cat}</span>
              ${totalNotes > 0 ? `<span class="text-[10px] text-zinc-400 font-medium shrink-0">${totalNotes} nota${totalNotes !== 1 ? 's' : ''}</span>` : `<span class="text-[10px] text-zinc-300 shrink-0">${catConcepts.length}</span>`}
              <i data-lucide="chevron-right" class="w-3.5 h-3.5 text-zinc-300 cat-chevron transition-transform duration-200 shrink-0"></i>
            </button>
            <div class="cat-folder-body hidden space-y-0.5 mt-0.5">
              ${conceptItems}
            </div>
          </div>
        `;
    }).join('');

    ['concept-notes-tree', 'concept-notes-tree-mobile'].forEach(id => {
        const container = document.getElementById(id);
        if (!container) return;
        container.innerHTML = treeHTML;
        if (window.lucide) window.lucide.createIcons();

        container.querySelectorAll('.cat-folder-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const wrapper = btn.closest('.cat-folder-wrapper');
                const body = wrapper?.querySelector('.cat-folder-body');
                const chevron = btn.querySelector('.cat-chevron');
                const folderIcon = btn.querySelector('.folder-icon');
                if (body) {
                    const isOpen = !body.classList.contains('hidden');
                    body.classList.toggle('hidden', isOpen);
                    chevron?.classList.toggle('rotate-90', !isOpen);
                    folderIcon?.setAttribute('data-lucide', isOpen ? 'folder' : 'folder-open');
                    if (window.lucide) window.lucide.createIcons({ nodes: btn.querySelectorAll('[data-lucide]') });
                }
            });
        });

        container.querySelectorAll('.concept-note-item').forEach(btn => {
            btn.addEventListener('click', () => {
                const conceptId = btn.getAttribute('data-concept-id');
                setConceptInitialTab('anotacoes');
                store.setState({ selectedConceptId: conceptId });
                closeMobileDrawer();
            });
        });
    });
}

// ─── Abrir nota livre ─────────────────────────────────────────────────────────

async function openNote(id) {
    if (activeNoteId === id) return;
    if (activeEditor) { activeEditor.destroy(); activeEditor = null; }

    activeNoteId = id;
    renderTree();

    document.getElementById('notes-editor-placeholder')?.classList.add('hidden');
    const wrapper = document.getElementById('notes-editor-wrapper');
    wrapper?.classList.remove('hidden');

    const note = await getFreeNoteById(id);
    if (!note) return;

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

    const editorEl = document.getElementById('notes-rich-editor');
    if (editorEl) editorEl.innerHTML = '';

    activeEditor = await createRichEditor('notes-rich-editor', note.content_html || '', async (html, text) => {
        await saveFreeNoteContent(id, html, text);
        const indicator = document.getElementById('notes-save-indicator');
        if (indicator) {
            indicator.style.opacity = '1';
            setTimeout(() => { indicator.style.opacity = '0'; }, 2000);
        }
    });

    if (activeEditor) {
        // Attach fixed toolbar
        attachFixedToolbar(activeEditor);

        // Image popup on click inside editor
        attachImagePopupHandler(document.getElementById('notes-rich-editor'));

        // Inline delete handlers for images/blockquotes
        attachInlineDeleteHandlers(document.getElementById('notes-rich-editor'), activeEditor);

        if (window.lucide) window.lucide.createIcons();
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
            set.add(n.id); queue.push(n.id);
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
        focusBtn?.querySelector('[data-lucide]')?.setAttribute('data-lucide', 'minimize-2');
        focusBtn?.setAttribute('title', 'Sair do modo foco');
        const btn = document.createElement('button');
        btn.id = 'focus-exit-float';
        btn.className = 'fixed top-4 right-4 z-[60] flex items-center gap-1.5 px-3 py-2 bg-zinc-900/90 text-white text-xs font-semibold rounded-xl hover:bg-zinc-900 transition-colors shadow-lg backdrop-blur-sm';
        btn.innerHTML = `<i data-lucide="minimize-2" class="w-3.5 h-3.5"></i> Sair do foco`;
        btn.addEventListener('click', toggleFocusMode);
        document.body.appendChild(btn);
        if (window.lucide) window.lucide.createIcons({ nodes: btn.querySelectorAll('[data-lucide]') });
    } else {
        sidebar?.classList.remove('!hidden');
        focusBtn?.querySelector('[data-lucide]')?.setAttribute('data-lucide', 'maximize-2');
        focusBtn?.setAttribute('title', 'Modo foco');
        document.getElementById('focus-exit-float')?.remove();
    }
    if (window.lucide) window.lucide.createIcons({ nodes: focusBtn?.querySelectorAll('[data-lucide]') });
}
