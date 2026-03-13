// js/rich-editor.js
// Wrapper do editor Tiptap para uso no concept-detail.
// Aguarda o carregamento assíncrono do TipTap via tiptap-loader.js.

/**
 * Aguarda as extensões do TipTap ficarem disponíveis (carregadas via ESM).
 * @returns {Promise<Object>} - { Editor, StarterKit, Highlight, Placeholder }
 */
function waitForExtensions() {
    return new Promise((resolve) => {
        const check = () => {
            const exts = getExtensions();
            if (exts.Editor) {
                resolve(exts);
            } else {
                // Escuta o evento customizado disparado pelo loader
                window.addEventListener('tiptap-ready', () => resolve(getExtensions()), { once: true });
                // Fallback: re-checar a cada 200ms (máximo 10s)
                let attempts = 0;
                const interval = setInterval(() => {
                    attempts++;
                    const e = getExtensions();
                    if (e.Editor || attempts > 50) {
                        clearInterval(interval);
                        resolve(e);
                    }
                }, 200);
            }
        };
        check();
    });
}

/**
 * Inicializa um editor Tiptap num elemento DOM.
 * Agora é assíncrono para aguardar o carregamento do TipTap via ESM.
 * @param {string} containerId - ID do elemento container
 * @param {string} initialHtml - conteúdo HTML inicial
 * @param {function} onUpdate - callback(html, text) chamado com debounce de 1500ms
 * @returns {Promise<Object>} instância do editor Tiptap
 */
export async function createRichEditor(containerId, initialHtml, onUpdate) {
    const el = document.getElementById(containerId);
    if (!el) { console.error(`rich-editor: elemento #${containerId} não encontrado`); return null; }

    // Mostrar loading enquanto espera
    el.innerHTML = `<p class="text-zinc-400 text-sm animate-pulse p-4">Carregando editor...</p>`;

    const { Editor, StarterKit, Highlight, Placeholder } = await waitForExtensions();
    if (!Editor) {
        el.innerHTML = `<p class="text-red-500 text-sm p-4">Editor não carregado. Verifique os scripts CDN do Tiptap.</p>`;
        return null;
    }

    // Limpar o loading
    el.innerHTML = '';

    let saveTimeout;
    let editor;

    editor = new Editor({
        element: el,
        extensions: [
            StarterKit,
            Highlight.configure({ multicolor: false }),
            Placeholder.configure({
                placeholder: 'Escreva sua análise, regras e observações sobre este conceito...'
            })
        ],
        content: initialHtml || '',
        editorProps: {
            attributes: { class: 'tiptap-editor focus:outline-none min-h-[150px] prose prose-sm max-w-none p-4' },
            handlePaste: (view, event, slice) => {
                if (!window.marked) return false;
                
                const text = event.clipboardData?.getData('text/plain');
                if (!text) return false;

                // Detect basic markdown signals
                const isMarkdown = /(^#{1,6}\s|^\s*[-*+]\s|^\s*>|```|\*\*.*?\*\*|__.*?__)/m.test(text);

                if (isMarkdown) {
                    event.preventDefault();
                    const html = marked.parse(text);
                    setTimeout(() => {
                        editor.commands.insertContent(html);
                    }, 0);
                    return true;
                }
                
                return false;
            }
        },
        onUpdate({ editor }) {
            clearTimeout(saveTimeout);
            saveTimeout = setTimeout(() => {
                const html = editor.getHTML();
                const text = editor.getText();
                onUpdate(html, text);
            }, 1500);
        }
    });

    return editor;
}

/**
 * Renderiza o toolbar flutuante ao selecionar texto.
 * @param {Object} editor - instância Tiptap
 * @param {HTMLElement} toolbarEl - elemento da toolbar
 */
export function attachFloatingToolbar(editor, toolbarEl) {
    editor.on('selectionUpdate', ({ editor: ed }) => {
        const { from, to } = ed.state.selection;
        if (from === to) {
            toolbarEl.classList.remove('visible');
            setTimeout(() => { if (!toolbarEl.classList.contains('visible')) toolbarEl.style.display = 'none'; }, 200);
            return;
        }

        // Posicionar toolbar acima da seleção
        const view = ed.view;
        const start = view.coordsAtPos(from);
        const containerRect = toolbarEl.parentElement.getBoundingClientRect();

        toolbarEl.style.display = 'flex';
        // forced reflow for animation
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

function getExtensions() {
    return {
        Editor: window.tiptapCore?.Editor,
        StarterKit: window.tiptapStarterKit?.StarterKit,
        Highlight: window.tiptapExtensionHighlight?.Highlight,
        Placeholder: window.tiptapExtensionPlaceholder?.Placeholder
    };
}
