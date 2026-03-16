// js/rich-editor.js
// Editor Tiptap profissional — inspirado em Notion, Typora, Obsidian.
// Suporte a slash commands, toolbar fixa, callouts, tabelas, tasks, etc.

/* ═══════════════════════════════════════════════════════════════════════════
   UTILIDADES
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Converte conteúdo para HTML pronto para o Tiptap.
 */
function prepareContent(content) {
    if (!content?.trim()) return '';
    if (/<(strong|em|b|i|h[1-6]|ul|ol|li|blockquote|pre|code|table|tr|td|th)\b/i.test(content)) {
        return content;
    }
    const hasMarkdown = /\*\*[\s\S]+?\*\*|\*[^*\s][^*]*\*|^#{1,6}\s|^\s*[-*+]\s|^\s*\d+\.\s|^\s*>\s?|^```/m.test(content);
    if (!hasMarkdown || typeof window.marked === 'undefined') return content;
    let text = content;
    if (/</.test(content)) {
        text = content
            .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<[^>]+>/g, '')
            .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
            .trim();
    }
    const html = window.marked.parse(text, { gfm: true, breaks: false });
    return html.replace(/<li>\s*<p>([\s\S]*?)<\/p>\s*<\/li>/g, '<li>$1</li>');
}

/**
 * Aguarda as extensões do TipTap ficarem disponíveis.
 */
function waitForExtensions() {
    return new Promise((resolve) => {
        const check = () => {
            const exts = getExtensions();
            if (exts.Editor) {
                resolve(exts);
            } else {
                window.addEventListener('tiptap-ready', () => resolve(getExtensions()), { once: true });
                let attempts = 0;
                const interval = setInterval(() => {
                    attempts++;
                    const e = getExtensions();
                    if (e.Editor || attempts > 50) { clearInterval(interval); resolve(e); }
                }, 200);
            }
        };
        check();
    });
}

function getExtensions() {
    return {
        Editor: window.tiptapCore?.Editor,
        Extension: window.tiptapCore?.Extension,
        StarterKit: window.tiptapStarterKit?.StarterKit,
        Highlight: window.tiptapExtensionHighlight?.Highlight,
        Placeholder: window.tiptapExtensionPlaceholder?.Placeholder,
        Image: window.tiptapExtensionImage?.Image,
        TaskList: window.tiptapExtensionTaskList?.TaskList,
        TaskItem: window.tiptapExtensionTaskItem?.TaskItem,
        Link: window.tiptapExtensionLink?.Link,
        Underline: window.tiptapExtensionUnderline?.Underline,
        TextAlign: window.tiptapExtensionTextAlign?.TextAlign,
        TextStyle: window.tiptapExtensionTextStyle?.TextStyle,
        Color: window.tiptapExtensionColor?.Color,
        Table: window.tiptapExtensionTable?.Table,
        TableRow: window.tiptapExtensionTableRow?.TableRow,
        TableCell: window.tiptapExtensionTableCell?.TableCell,
        TableHeader: window.tiptapExtensionTableHeader?.TableHeader,
        Typography: window.tiptapExtensionTypography?.Typography,
    };
}

/* ═══════════════════════════════════════════════════════════════════════════
   SLASH COMMANDS — Menu de inserção tipo Notion
   ═══════════════════════════════════════════════════════════════════════════ */

const SLASH_COMMANDS = [
    { id: 'h1', label: 'Título 1', desc: 'Título grande', icon: 'heading-1', section: 'Texto',
      action: (ed) => ed.chain().focus().toggleHeading({ level: 1 }).run() },
    { id: 'h2', label: 'Título 2', desc: 'Título médio', icon: 'heading-2', section: 'Texto',
      action: (ed) => ed.chain().focus().toggleHeading({ level: 2 }).run() },
    { id: 'h3', label: 'Título 3', desc: 'Título pequeno', icon: 'heading-3', section: 'Texto',
      action: (ed) => ed.chain().focus().toggleHeading({ level: 3 }).run() },
    { id: 'bulletList', label: 'Lista', desc: 'Lista com marcadores', icon: 'list', section: 'Listas',
      action: (ed) => ed.chain().focus().toggleBulletList().run() },
    { id: 'orderedList', label: 'Lista Numerada', desc: 'Lista ordenada', icon: 'list-ordered', section: 'Listas',
      action: (ed) => ed.chain().focus().toggleOrderedList().run() },
    { id: 'taskList', label: 'To-do', desc: 'Lista de tarefas', icon: 'check-square', section: 'Listas',
      action: (ed) => ed.chain().focus().toggleTaskList().run() },
    { id: 'blockquote', label: 'Citação', desc: 'Bloco de citação', icon: 'quote', section: 'Blocos',
      action: (ed) => ed.chain().focus().toggleBlockquote().run() },
    { id: 'codeBlock', label: 'Código', desc: 'Bloco de código', icon: 'code', section: 'Blocos',
      action: (ed) => ed.chain().focus().toggleCodeBlock().run() },
    { id: 'horizontalRule', label: 'Divisor', desc: 'Linha horizontal', icon: 'minus', section: 'Blocos',
      action: (ed) => ed.chain().focus().setHorizontalRule().run() },
    { id: 'table', label: 'Tabela', desc: 'Inserir tabela 3x3', icon: 'table', section: 'Blocos',
      action: (ed) => ed.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
    { id: 'callout-info', label: 'Nota Info', desc: 'Bloco informativo azul', icon: 'info', section: 'Callouts',
      action: (ed) => ed.chain().focus().insertContent(
        '<div data-callout="info" class="editor-callout callout-info"><p>ℹ️ Informação importante aqui...</p></div><p></p>'
      ).run() },
    { id: 'callout-warn', label: 'Aviso', desc: 'Bloco de alerta amarelo', icon: 'alert-triangle', section: 'Callouts',
      action: (ed) => ed.chain().focus().insertContent(
        '<div data-callout="warn" class="editor-callout callout-warn"><p>⚠️ Atenção: ponto importante...</p></div><p></p>'
      ).run() },
    { id: 'callout-tip', label: 'Dica', desc: 'Bloco de dica verde', icon: 'lightbulb', section: 'Callouts',
      action: (ed) => ed.chain().focus().insertContent(
        '<div data-callout="tip" class="editor-callout callout-tip"><p>💡 Dica útil aqui...</p></div><p></p>'
      ).run() },
    { id: 'callout-danger', label: 'Perigo', desc: 'Bloco de perigo vermelho', icon: 'alert-circle', section: 'Callouts',
      action: (ed) => ed.chain().focus().insertContent(
        '<div data-callout="danger" class="editor-callout callout-danger"><p>🚫 Erro crítico ou proibição...</p></div><p></p>'
      ).run() },
    { id: 'image', label: 'Imagem', desc: 'Inserir imagem do computador', icon: 'image', section: 'Media',
      action: () => document.getElementById('notes-img-file-input')?.click() },
    { id: 'comment', label: 'Comentário Oculto', desc: 'Comentário colapsado', icon: 'message-square', section: 'Media',
      action: (ed) => ed.chain().focus().insertContent(
        '<blockquote><p>💬 Comentário oculto — clique para expandir</p></blockquote>'
      ).run() },
];

let _slashMenuEl = null;
let _slashMenuFilter = '';
let _slashMenuSelectedIdx = 0;
let _slashMenuEditor = null;
let _slashStartPos = null;

function showSlashMenu(editor, coords) {
    hideSlashMenu();
    _slashMenuEditor = editor;
    _slashMenuFilter = '';
    _slashMenuSelectedIdx = 0;

    const menu = document.createElement('div');
    menu.id = 'slash-command-menu';
    menu.className = 'slash-command-menu';
    _slashMenuEl = menu;

    // Position
    const editorRect = editor.view.dom.closest('.notes-editor-scroll')?.getBoundingClientRect()
                    || editor.view.dom.parentElement.getBoundingClientRect();
    menu.style.position = 'fixed';
    menu.style.top = Math.min(coords.bottom + 4, window.innerHeight - 340) + 'px';
    menu.style.left = Math.max(8, Math.min(coords.left, window.innerWidth - 300)) + 'px';

    document.body.appendChild(menu);
    renderSlashMenuItems();
}

function renderSlashMenuItems() {
    if (!_slashMenuEl) return;
    const filter = _slashMenuFilter.toLowerCase();
    const filtered = SLASH_COMMANDS.filter(cmd =>
        cmd.label.toLowerCase().includes(filter) || cmd.desc.toLowerCase().includes(filter)
    );

    if (filtered.length === 0) {
        _slashMenuEl.innerHTML = '<div class="slash-empty">Nenhum comando encontrado</div>';
        return;
    }

    let html = '';
    let currentSection = '';
    filtered.forEach((cmd, i) => {
        if (cmd.section !== currentSection) {
            currentSection = cmd.section;
            html += `<div class="slash-section">${currentSection}</div>`;
        }
        const active = i === _slashMenuSelectedIdx ? 'slash-item-active' : '';
        html += `<button class="slash-item ${active}" data-idx="${i}">
          <span class="slash-item-icon"><i data-lucide="${cmd.icon}" class="w-4 h-4"></i></span>
          <span class="slash-item-text">
            <span class="slash-item-label">${cmd.label}</span>
            <span class="slash-item-desc">${cmd.desc}</span>
          </span>
        </button>`;
    });

    _slashMenuEl.innerHTML = `<div class="slash-header">Inserir bloco</div>${html}`;
    if (window.lucide) window.lucide.createIcons({ nodes: _slashMenuEl.querySelectorAll('[data-lucide]') });

    _slashMenuEl.querySelectorAll('.slash-item').forEach(btn => {
        btn.addEventListener('mousedown', (e) => {
            e.preventDefault();
            const idx = parseInt(btn.dataset.idx);
            executeSlashCommand(filtered[idx]);
        });
        btn.addEventListener('mouseenter', () => {
            const idx = parseInt(btn.dataset.idx);
            _slashMenuSelectedIdx = idx;
            _slashMenuEl.querySelectorAll('.slash-item').forEach((b, i) =>
                b.classList.toggle('slash-item-active', i === idx));
        });
    });
}

function executeSlashCommand(cmd) {
    if (!cmd || !_slashMenuEditor) return;
    const editor = _slashMenuEditor;

    // Delete the "/" and filter text
    if (_slashStartPos != null) {
        const currentPos = editor.state.selection.from;
        editor.chain().deleteRange({ from: _slashStartPos, to: currentPos }).run();
    }

    cmd.action(editor);
    hideSlashMenu();
}

function hideSlashMenu() {
    _slashMenuEl?.remove();
    _slashMenuEl = null;
    _slashMenuFilter = '';
    _slashMenuSelectedIdx = 0;
    _slashMenuEditor = null;
    _slashStartPos = null;
}

function handleSlashMenuKeydown(e) {
    if (!_slashMenuEl) return false;
    const filter = _slashMenuFilter.toLowerCase();
    const filtered = SLASH_COMMANDS.filter(cmd =>
        cmd.label.toLowerCase().includes(filter) || cmd.desc.toLowerCase().includes(filter)
    );

    if (e.key === 'ArrowDown') {
        e.preventDefault();
        _slashMenuSelectedIdx = Math.min(_slashMenuSelectedIdx + 1, filtered.length - 1);
        renderSlashMenuItems();
        return true;
    }
    if (e.key === 'ArrowUp') {
        e.preventDefault();
        _slashMenuSelectedIdx = Math.max(_slashMenuSelectedIdx - 1, 0);
        renderSlashMenuItems();
        return true;
    }
    if (e.key === 'Enter') {
        e.preventDefault();
        if (filtered[_slashMenuSelectedIdx]) executeSlashCommand(filtered[_slashMenuSelectedIdx]);
        return true;
    }
    if (e.key === 'Escape') {
        e.preventDefault();
        hideSlashMenu();
        return true;
    }
    return false;
}

/* ═══════════════════════════════════════════════════════════════════════════
   CRIAR EDITOR
   ═══════════════════════════════════════════════════════════════════════════ */

export async function createRichEditor(containerId, initialHtml, onUpdate) {
    const el = document.getElementById(containerId);
    if (!el) { console.error(`rich-editor: #${containerId} não encontrado`); return null; }

    el.innerHTML = `<p class="text-zinc-400 text-sm animate-pulse p-4">Carregando editor...</p>`;

    const exts = await waitForExtensions();
    if (!exts.Editor) {
        el.innerHTML = `<p class="text-red-500 text-sm p-4">Editor não carregado.</p>`;
        return null;
    }

    el.innerHTML = '';
    const processedContent = prepareContent(initialHtml);
    const contentWasConverted = !!processedContent && processedContent !== initialHtml;

    let saveTimeout;
    let editor;

    const extensions = [
        exts.StarterKit,
        exts.Highlight.configure({ multicolor: true }),
        exts.Placeholder.configure({
            placeholder: ({ node }) => {
                if (node.type.name === 'heading') return 'Título...';
                return 'Digite "/" para inserir um bloco, ou comece a escrever...';
            }
        }),
        ...(exts.Image ? [exts.Image.configure({ inline: false, allowBase64: false })] : []),
        ...(exts.TaskList ? [exts.TaskList] : []),
        ...(exts.TaskItem ? [exts.TaskItem.configure({ nested: true })] : []),
        ...(exts.Link ? [exts.Link.configure({ openOnClick: false, HTMLAttributes: { class: 'editor-link' } })] : []),
        ...(exts.Underline ? [exts.Underline] : []),
        ...(exts.TextAlign ? [exts.TextAlign.configure({ types: ['heading', 'paragraph'] })] : []),
        ...(exts.TextStyle ? [exts.TextStyle] : []),
        ...(exts.Color ? [exts.Color] : []),
        ...(exts.Table ? [exts.Table.configure({ resizable: true })] : []),
        ...(exts.TableRow ? [exts.TableRow] : []),
        ...(exts.TableCell ? [exts.TableCell] : []),
        ...(exts.TableHeader ? [exts.TableHeader] : []),
        ...(exts.Typography ? [exts.Typography] : []),
    ];

    editor = new exts.Editor({
        element: el,
        extensions,
        content: processedContent,
        editorProps: {
            attributes: {
                class: 'tiptap-editor focus:outline-none min-h-[200px] prose prose-sm max-w-none',
                spellcheck: 'true'
            },
            handleKeyDown: (view, event) => {
                if (handleSlashMenuKeydown(event)) return true;
                return false;
            },
            handlePaste: (view, event) => {
                const text = event.clipboardData?.getData('text/plain') || '';
                if (!text.trim() || typeof window.marked === 'undefined') return false;
                const hasBlockMd  = /^#{1,6}\s|^\s*[-*+]\s|^\s*\d+\.\s|^\s*>\s?|^```/m.test(text);
                const hasInlineMd = /\*\*[\s\S]+?\*\*|\*[^*\s][^*]*?\*|`[^`]+`|_{2}[\s\S]+?_{2}/.test(text);
                if (!hasBlockMd && !hasInlineMd) return false;
                event.preventDefault();
                try {
                    const html = window.marked.parse(text, { gfm: true, breaks: false });
                    const normalized = html.replace(/<li>\s*<p>([\s\S]*?)<\/p>\s*<\/li>/g, '<li>$1</li>');
                    setTimeout(() => {
                        if (!editor) return;
                        editor.chain().focus().insertContent(normalized, {
                            parseOptions: { preserveWhitespace: false }
                        }).run();
                    }, 0);
                } catch { return false; }
                return true;
            }
        },
        onUpdate({ editor: ed }) {
            clearTimeout(saveTimeout);

            // Slash command detection
            const { from } = ed.state.selection;
            const textBefore = ed.state.doc.textBetween(Math.max(0, from - 30), from, null, '\ufffc');
            const slashMatch = textBefore.match(/\/([^\s/]*)$/);

            if (slashMatch) {
                if (!_slashMenuEl) {
                    _slashStartPos = from - slashMatch[0].length;
                    const coords = ed.view.coordsAtPos(from);
                    showSlashMenu(ed, coords);
                }
                _slashMenuFilter = slashMatch[1] || '';
                _slashMenuSelectedIdx = 0;
                renderSlashMenuItems();
            } else {
                if (_slashMenuEl) hideSlashMenu();
            }

            // Debounced save
            saveTimeout = setTimeout(() => {
                const html = ed.getHTML();
                const text = ed.getText();
                onUpdate(html, text);
            }, 1500);

            // Dispatch word count event
            const wordCount = ed.getText().split(/\s+/).filter(w => w.length > 0).length;
            const charCount = ed.getText().length;
            window.dispatchEvent(new CustomEvent('editor-stats', { detail: { words: wordCount, chars: charCount } }));
        }
    });

    // Save converted content
    if (contentWasConverted) {
        setTimeout(() => {
            const html = editor.getHTML();
            const text = editor.getText();
            if (html && html !== '<p></p>') onUpdate(html, text);
        }, 300);
    }

    // Close slash menu on blur
    editor.on('blur', () => {
        setTimeout(() => hideSlashMenu(), 150);
    });

    return editor;
}

/* ═══════════════════════════════════════════════════════════════════════════
   TOOLBAR FIXA — Para notas (substitui o floating para a toolbar principal)
   ═══════════════════════════════════════════════════════════════════════════ */

export function buildFixedToolbarHTML() {
    return `
    <div class="notes-fixed-toolbar" id="notes-fixed-toolbar">
      <div class="nft-group">
        <button data-action="bold" title="Negrito (Ctrl+B)" class="nft-btn"><i data-lucide="bold" class="w-3.5 h-3.5"></i></button>
        <button data-action="italic" title="Itálico (Ctrl+I)" class="nft-btn"><i data-lucide="italic" class="w-3.5 h-3.5"></i></button>
        <button data-action="underline" title="Sublinhado (Ctrl+U)" class="nft-btn"><i data-lucide="underline" class="w-3.5 h-3.5"></i></button>
        <button data-action="strike" title="Riscado" class="nft-btn"><i data-lucide="strikethrough" class="w-3.5 h-3.5"></i></button>
      </div>
      <div class="nft-sep"></div>
      <div class="nft-group">
        <button data-action="h1" title="Título 1" class="nft-btn"><i data-lucide="heading-1" class="w-3.5 h-3.5"></i></button>
        <button data-action="h2" title="Título 2" class="nft-btn"><i data-lucide="heading-2" class="w-3.5 h-3.5"></i></button>
        <button data-action="h3" title="Título 3" class="nft-btn"><i data-lucide="heading-3" class="w-3.5 h-3.5"></i></button>
      </div>
      <div class="nft-sep"></div>
      <div class="nft-group">
        <button data-action="highlight" title="Destacar" class="nft-btn"><i data-lucide="highlighter" class="w-3.5 h-3.5"></i></button>
        <button data-action="color-red" title="Cor vermelha" class="nft-btn nft-color-dot" style="--dot-color:#ef4444"></button>
        <button data-action="color-blue" title="Cor azul" class="nft-btn nft-color-dot" style="--dot-color:#3b82f6"></button>
        <button data-action="color-green" title="Cor verde" class="nft-btn nft-color-dot" style="--dot-color:#10b981"></button>
        <button data-action="color-reset" title="Cor padrão" class="nft-btn nft-color-dot" style="--dot-color:#71717a"></button>
      </div>
      <div class="nft-sep"></div>
      <div class="nft-group">
        <button data-action="bulletList" title="Lista" class="nft-btn"><i data-lucide="list" class="w-3.5 h-3.5"></i></button>
        <button data-action="orderedList" title="Lista numerada" class="nft-btn"><i data-lucide="list-ordered" class="w-3.5 h-3.5"></i></button>
        <button data-action="taskList" title="To-do" class="nft-btn"><i data-lucide="check-square" class="w-3.5 h-3.5"></i></button>
      </div>
      <div class="nft-sep"></div>
      <div class="nft-group">
        <button data-action="blockquote" title="Citação" class="nft-btn"><i data-lucide="quote" class="w-3.5 h-3.5"></i></button>
        <button data-action="codeBlock" title="Bloco de código" class="nft-btn"><i data-lucide="code" class="w-3.5 h-3.5"></i></button>
        <button data-action="horizontalRule" title="Divisor" class="nft-btn"><i data-lucide="minus" class="w-3.5 h-3.5"></i></button>
      </div>
      <div class="nft-sep"></div>
      <div class="nft-group">
        <button data-action="alignLeft" title="Alinhar à esquerda" class="nft-btn"><i data-lucide="align-left" class="w-3.5 h-3.5"></i></button>
        <button data-action="alignCenter" title="Centralizar" class="nft-btn"><i data-lucide="align-center" class="w-3.5 h-3.5"></i></button>
        <button data-action="alignRight" title="Alinhar à direita" class="nft-btn"><i data-lucide="align-right" class="w-3.5 h-3.5"></i></button>
      </div>
      <div class="nft-sep"></div>
      <div class="nft-group">
        <button data-action="insertImage" title="Inserir imagem" class="nft-btn"><i data-lucide="image" class="w-3.5 h-3.5"></i></button>
        <button data-action="insertLink" title="Inserir link" class="nft-btn"><i data-lucide="link" class="w-3.5 h-3.5"></i></button>
        <button data-action="insertTable" title="Inserir tabela" class="nft-btn"><i data-lucide="table" class="w-3.5 h-3.5"></i></button>
        <button data-action="insertComment" title="Comentário oculto" class="nft-btn"><i data-lucide="message-square" class="w-3.5 h-3.5"></i></button>
      </div>
    </div>`;
}

export function attachFixedToolbar(editor) {
    const toolbar = document.getElementById('notes-fixed-toolbar');
    if (!toolbar || !editor) return;

    toolbar.querySelectorAll('.nft-btn[data-action]').forEach(btn => {
        btn.addEventListener('mousedown', (e) => {
            e.preventDefault();
            const action = btn.dataset.action;
            const chain = editor.chain().focus();
            switch (action) {
                case 'bold': chain.toggleBold().run(); break;
                case 'italic': chain.toggleItalic().run(); break;
                case 'underline': chain.toggleUnderline().run(); break;
                case 'strike': chain.toggleStrike().run(); break;
                case 'h1': chain.toggleHeading({ level: 1 }).run(); break;
                case 'h2': chain.toggleHeading({ level: 2 }).run(); break;
                case 'h3': chain.toggleHeading({ level: 3 }).run(); break;
                case 'highlight': chain.toggleHighlight({ color: '#fef08a' }).run(); break;
                case 'color-red': chain.setColor('#ef4444').run(); break;
                case 'color-blue': chain.setColor('#3b82f6').run(); break;
                case 'color-green': chain.setColor('#10b981').run(); break;
                case 'color-reset': chain.unsetColor().run(); break;
                case 'bulletList': chain.toggleBulletList().run(); break;
                case 'orderedList': chain.toggleOrderedList().run(); break;
                case 'taskList': chain.toggleTaskList().run(); break;
                case 'blockquote': chain.toggleBlockquote().run(); break;
                case 'codeBlock': chain.toggleCodeBlock().run(); break;
                case 'horizontalRule': chain.setHorizontalRule().run(); break;
                case 'alignLeft': chain.setTextAlign('left').run(); break;
                case 'alignCenter': chain.setTextAlign('center').run(); break;
                case 'alignRight': chain.setTextAlign('right').run(); break;
                case 'insertImage':
                    document.getElementById('notes-img-file-input')?.click();
                    break;
                case 'insertLink': {
                    const url = prompt('URL do link:');
                    if (url) editor.chain().focus().setLink({ href: url }).run();
                    break;
                }
                case 'insertTable':
                    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
                    break;
                case 'insertComment': {
                    const { from, to } = editor.state.selection;
                    if (from === to) {
                        editor.chain().focus().insertContent(
                            '<blockquote><p>💬 Comentário oculto — clique para expandir</p></blockquote>'
                        ).run();
                    } else {
                        window._pendingCommentSel = { from, to };
                        showNoteCommentPopup(btn, editor);
                    }
                    break;
                }
            }
        });
    });

    // Update active states on selection change
    editor.on('selectionUpdate', () => updateToolbarActiveStates(editor, toolbar));
    editor.on('transaction', () => updateToolbarActiveStates(editor, toolbar));
}

function updateToolbarActiveStates(editor, toolbar) {
    const checks = {
        bold: () => editor.isActive('bold'),
        italic: () => editor.isActive('italic'),
        underline: () => editor.isActive('underline'),
        strike: () => editor.isActive('strike'),
        h1: () => editor.isActive('heading', { level: 1 }),
        h2: () => editor.isActive('heading', { level: 2 }),
        h3: () => editor.isActive('heading', { level: 3 }),
        highlight: () => editor.isActive('highlight'),
        bulletList: () => editor.isActive('bulletList'),
        orderedList: () => editor.isActive('orderedList'),
        taskList: () => editor.isActive('taskList'),
        blockquote: () => editor.isActive('blockquote'),
        codeBlock: () => editor.isActive('codeBlock'),
        alignLeft: () => editor.isActive({ textAlign: 'left' }),
        alignCenter: () => editor.isActive({ textAlign: 'center' }),
        alignRight: () => editor.isActive({ textAlign: 'right' }),
    };

    toolbar.querySelectorAll('.nft-btn[data-action]').forEach(btn => {
        const action = btn.dataset.action;
        const check = checks[action];
        if (check) {
            btn.classList.toggle('nft-active', check());
        }
    });
}

/* ═══════════════════════════════════════════════════════════════════════════
   FLOATING BUBBLE TOOLBAR (para seleção de texto)
   ═══════════════════════════════════════════════════════════════════════════ */

export function attachFloatingToolbar(editor, toolbarEl) {
    editor.on('selectionUpdate', ({ editor: ed }) => {
        const { from, to } = ed.state.selection;
        if (from === to) {
            toolbarEl.classList.remove('visible');
            setTimeout(() => { if (!toolbarEl.classList.contains('visible')) toolbarEl.style.display = 'none'; }, 200);
            return;
        }
        const view = ed.view;
        const start = view.coordsAtPos(from);
        const containerRect = toolbarEl.parentElement.getBoundingClientRect();

        toolbarEl.style.display = 'flex';
        void toolbarEl.offsetWidth;
        toolbarEl.classList.add('visible');
        toolbarEl.style.position = 'absolute';
        toolbarEl.style.top = `${start.top - containerRect.top - 54}px`;
        toolbarEl.style.left = `${start.left - containerRect.left}px`;
        toolbarEl.style.zIndex = '100';
    });

    editor.on('blur', () => {
        toolbarEl.classList.remove('visible');
        setTimeout(() => { if (!toolbarEl.classList.contains('visible')) toolbarEl.style.display = 'none'; }, 200);
    });
}

/* ═══════════════════════════════════════════════════════════════════════════
   IMAGEM & COMENTÁRIO
   ═══════════════════════════════════════════════════════════════════════════ */

export function insertImageInEditor(editor, url) {
    if (!editor || !url) return;
    editor.chain().focus().setImage({ src: url, alt: 'imagem' }).run();
}

export function insertCommentBlock(editor, from, to, commentText) {
    if (!editor || !commentText.trim()) return;
    editor.chain()
        .focus()
        .setTextSelection({ from, to })
        .toggleHighlight()
        .setTextSelection(to)
        .insertContent(`<blockquote><p>💬 ${commentText.trim()}</p></blockquote>`)
        .run();
}

export function showEditorImagePopup(src) {
    document.getElementById('note-img-popup-overlay')?.remove();
    const overlay = document.createElement('div');
    overlay.id = 'note-img-popup-overlay';
    overlay.className = 'note-img-popup-overlay';
    overlay.innerHTML = `
      <div class="note-img-popup-inner" onclick="event.stopPropagation()">
        <img src="${src}" alt="imagem">
        <button class="note-img-popup-close" title="Fechar">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>`;
    overlay.addEventListener('click', () => overlay.remove());
    overlay.querySelector('.note-img-popup-close').addEventListener('click', (e) => {
        e.stopPropagation(); overlay.remove();
    });
    document.addEventListener('keydown', function escHandler(e) {
        if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', escHandler); }
    });
    document.body.appendChild(overlay);
}

export function attachImagePopupHandler(containerEl) {
    if (!containerEl) return;
    containerEl.addEventListener('click', (e) => {
        if (e.target.tagName === 'IMG') {
            e.preventDefault();
            showEditorImagePopup(e.target.src);
        }
    });
}

export function attachInlineDeleteHandlers(containerEl, editor) {
    if (!containerEl || !editor) return;

    let deleteBtn = null;
    let hideTimer = null;

    function removeBtn() { deleteBtn?.remove(); deleteBtn = null; }

    function showDeleteBtn(targetEl) {
        clearTimeout(hideTimer);
        if (deleteBtn?._target === targetEl) return;
        removeBtn();

        const btn = document.createElement('button');
        btn.className = 'editor-inline-delete-btn';
        btn.title = 'Excluir';
        btn.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M9 6V4h6v2"/></svg>`;
        btn._target = targetEl;

        const rect = targetEl.getBoundingClientRect();
        btn.style.top = `${rect.top + 4}px`;
        btn.style.left = `${rect.right - 26}px`;
        document.body.appendChild(btn);
        deleteBtn = btn;

        btn.addEventListener('click', (e) => {
            e.preventDefault(); e.stopPropagation();
            _deleteEditorNode(editor, targetEl);
            removeBtn();
        });
        btn.addEventListener('mouseenter', () => clearTimeout(hideTimer));
        btn.addEventListener('mouseleave', () => { hideTimer = setTimeout(removeBtn, 150); });
    }

    containerEl.addEventListener('click', (e) => {
        if (e.target.tagName !== 'IMG') {
            const p = e.target.closest('p');
            if (p && p.querySelector('img')) { p.classList.toggle('img-expanded'); return; }
        }
        const bq = e.target.closest('blockquote');
        if (bq) bq.classList.toggle('bq-expanded');
    });

    containerEl.addEventListener('mouseover', (e) => {
        const img = e.target.tagName === 'IMG' ? e.target : null;
        const bq = e.target.closest?.('blockquote');
        if (img) { showDeleteBtn(img.closest('p') || img); }
        else if (bq) { showDeleteBtn(bq); }
    });
    containerEl.addEventListener('mouseleave', () => { hideTimer = setTimeout(removeBtn, 200); });
}

function _deleteEditorNode(editor, domEl) {
    try {
        const pos = editor.view.posAtDOM(domEl, 0);
        const $pos = editor.state.doc.resolve(pos);
        for (let d = $pos.depth; d >= 1; d--) {
            const node = $pos.node(d);
            const name = node.type?.name;
            if (name === 'blockquote' || name === 'paragraph') {
                editor.chain().deleteRange({ from: $pos.before(d), to: $pos.after(d) }).run();
                return;
            }
        }
    } catch (e) { console.warn('[editor] Não foi possível excluir:', e); }
}

/* ═══════════════════════════════════════════════════════════════════════════
   COMMENT POPUP (usada tanto por notes.js quanto internamente)
   ═══════════════════════════════════════════════════════════════════════════ */

function showNoteCommentPopup(anchorBtn, editor) {
    document.getElementById('notes-comment-popup')?.remove();
    const popup = document.createElement('div');
    popup.id = 'notes-comment-popup';
    popup.className = 'note-comment-popup';
    popup.innerHTML = `
      <p>Adicionar comentário ao trecho</p>
      <textarea id="notes-comment-textarea" placeholder="Digite o comentário..."></textarea>
      <div class="popup-actions">
        <button class="btn-cancel">Cancelar</button>
        <button class="btn-save">Salvar</button>
      </div>`;

    const rect = anchorBtn.getBoundingClientRect();
    popup.style.top = (rect.bottom + 8) + 'px';
    popup.style.left = Math.min(rect.left, window.innerWidth - 276) + 'px';
    document.body.appendChild(popup);

    const textarea = popup.querySelector('#notes-comment-textarea');
    const cancelBtn = popup.querySelector('.btn-cancel');
    const saveBtn = popup.querySelector('.btn-save');

    setTimeout(() => textarea?.focus(), 50);
    cancelBtn.addEventListener('click', () => { popup.remove(); window._pendingCommentSel = null; });
    saveBtn.addEventListener('click', () => {
        const text = textarea.value.trim();
        if (!text) { textarea.focus(); return; }
        if (window._pendingCommentSel && editor) {
            insertCommentBlock(editor, window._pendingCommentSel.from, window._pendingCommentSel.to, text);
        }
        popup.remove();
        window._pendingCommentSel = null;
    });
    textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) saveBtn.click();
        if (e.key === 'Escape') cancelBtn.click();
    });
    setTimeout(() => {
        document.addEventListener('click', function outsideHandler(ev) {
            if (!popup.contains(ev.target)) {
                popup.remove(); window._pendingCommentSel = null;
                document.removeEventListener('click', outsideHandler);
            }
        });
    }, 100);
}
