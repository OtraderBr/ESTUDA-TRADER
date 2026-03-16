// js/rich-editor.js
// Wrapper do editor Tiptap para uso no concept-detail.
// Aguarda o carregamento assíncrono do TipTap via tiptap-loader.js.

/**
 * Converte conteúdo para HTML pronto para o Tiptap.
 * - Se já tem tags de formatação real (<strong>, <h1>, etc.) → mantém
 * - Se contém sintaxe markdown (mesmo dentro de <p>) → re-parseia com marked
 * - Caso contrário → retorna como está
 */
function prepareContent(content) {
    if (!content?.trim()) return '';

    // Já tem HTML rico com formatação real → usa como está
    if (/<(strong|em|b|i|h[1-6]|ul|ol|li|blockquote|pre|code)\b/i.test(content)) {
        return content;
    }

    // Detecta markdown (com ou sem wrapper de <p>)
    const hasMarkdown = /\*\*[\s\S]+?\*\*|\*[^*\s][^*]*\*|^#{1,6}\s|^\s*[-*+]\s|^\s*\d+\.\s|^\s*>\s?|^```/m.test(content);
    if (!hasMarkdown || typeof window.marked === 'undefined') return content;

    // Extrai texto puro preservando quebras de linha entre parágrafos
    let text = content;
    if (/</.test(content)) {
        text = content
            .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<[^>]+>/g, '')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&nbsp;/g, ' ')
            .trim();
    }

    const html = window.marked.parse(text, { gfm: true, breaks: false });
    // Tiptap não aceita <p> dentro de <li>
    return html.replace(/<li>\s*<p>([\s\S]*?)<\/p>\s*<\/li>/g, '<li>$1</li>');
}

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

    const { Editor, StarterKit, Highlight, Placeholder, Image } = await waitForExtensions();
    if (!Editor) {
        el.innerHTML = `<p class="text-red-500 text-sm p-4">Editor não carregado. Verifique os scripts CDN do Tiptap.</p>`;
        return null;
    }

    // Limpar o loading
    el.innerHTML = '';

    const processedContent = prepareContent(initialHtml);
    const contentWasConverted = !!processedContent && processedContent !== initialHtml;

    let saveTimeout;
    let editor;

    editor = new Editor({
        element: el,
        extensions: [
            StarterKit,
            Highlight.configure({ multicolor: false }),
            Placeholder.configure({
                placeholder: 'Escreva sua análise, regras e observações sobre este conceito...'
            }),
            ...(Image ? [Image.configure({ inline: false, allowBase64: false })] : [])
        ],
        content: processedContent,
        editorProps: {
            attributes: { class: 'tiptap-editor focus:outline-none min-h-[150px] prose prose-sm max-w-none p-4' },
            handlePaste: (view, event, slice) => {
                const text = event.clipboardData?.getData('text/plain') || '';
                if (!text.trim() || typeof window.marked === 'undefined') return false;

                // Detecta padrões markdown: títulos, listas, blockquote, código, negrito, itálico
                const hasBlockMd  = /^#{1,6}\s|^\s*[-*+]\s|^\s*\d+\.\s|^\s*>\s?|^```/m.test(text);
                const hasInlineMd = /\*\*[\s\S]+?\*\*|\*[^*\s][^*]*?\*|`[^`]+`|_{2}[\s\S]+?_{2}/.test(text);
                if (!hasBlockMd && !hasInlineMd) return false;

                event.preventDefault();
                try {
                    const html = window.marked.parse(text, { gfm: true, breaks: false });
                    // Tiptap não aceita <p> dentro de <li> — remove o wrapper
                    const normalized = html.replace(/<li>\s*<p>([\s\S]*?)<\/p>\s*<\/li>/g, '<li>$1</li>');
                    setTimeout(() => {
                        if (!editor) return;
                        editor.chain().focus().insertContent(normalized, {
                            parseOptions: { preserveWhitespace: false }
                        }).run();
                    }, 0);
                } catch {
                    return false;
                }
                return true;
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

    // Se o conteúdo foi convertido de markdown → HTML, salva a versão convertida
    // no banco para que próximas cargas não precisem converter novamente
    if (contentWasConverted) {
        setTimeout(() => {
            const html = editor.getHTML();
            const text = editor.getText();
            if (html && html !== '<p></p>') onUpdate(html, text);
        }, 300);
    }

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

/**
 * Insere uma imagem no editor pela URL.
 * @param {Object} editor - instância Tiptap
 * @param {string} url - URL pública da imagem
 */
export function insertImageInEditor(editor, url) {
    if (!editor || !url) return;
    editor.chain().focus().setImage({ src: url, alt: 'imagem' }).run();
}

/**
 * Insere um bloco de comentário anotando o texto selecionado.
 * Destaca o trecho e insere um bloco de citação com o comentário abaixo.
 * @param {Object} editor - instância Tiptap
 * @param {number} from - início da seleção salva
 * @param {number} to - fim da seleção salva
 * @param {string} commentText - texto do comentário
 */
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

/**
 * Abre popup de imagem em tela cheia (lightbox).
 * @param {string} src - URL da imagem
 */
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
        e.stopPropagation();
        overlay.remove();
    });
    document.addEventListener('keydown', function escHandler(e) {
        if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', escHandler); }
    });
    document.body.appendChild(overlay);
}

/**
 * Ativa popup ao clicar em imagens dentro de um container do editor.
 * @param {HTMLElement} containerEl - elemento do editor (ex: #notes-rich-editor)
 */
export function attachImagePopupHandler(containerEl) {
    if (!containerEl) return;
    containerEl.addEventListener('click', (e) => {
        if (e.target.tagName === 'IMG') {
            e.preventDefault();
            showEditorImagePopup(e.target.src);
        }
    });
}

function getExtensions() {
    return {
        Editor: window.tiptapCore?.Editor,
        StarterKit: window.tiptapStarterKit?.StarterKit,
        Highlight: window.tiptapExtensionHighlight?.Highlight,
        Placeholder: window.tiptapExtensionPlaceholder?.Placeholder,
        Image: window.tiptapExtensionImage?.Image
    };
}
