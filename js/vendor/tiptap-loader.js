// js/vendor/tiptap-loader.js
// Carrega todos os módulos do TipTap via esm.sh e os expõe como variáveis globais
// para uso pelo rich-editor.js

import { Editor } from 'https://esm.sh/@tiptap/core@2.1.13?bundle';
import StarterKit from 'https://esm.sh/@tiptap/starter-kit@2.1.13?bundle';
import Highlight from 'https://esm.sh/@tiptap/extension-highlight@2.1.13?bundle';
import Placeholder from 'https://esm.sh/@tiptap/extension-placeholder@2.1.13?bundle';

// Expor como globais para uso pelo sistema existente
window.tiptapCore = { Editor };
window.tiptapStarterKit = { StarterKit };
window.tiptapExtensionHighlight = { Highlight };
window.tiptapExtensionPlaceholder = { Placeholder };

// Sinalizar que o TipTap está pronto
window.__tiptapReady = true;
window.dispatchEvent(new CustomEvent('tiptap-ready'));

console.log('[TipTap Loader] ✅ Todos os módulos carregados com sucesso.');
