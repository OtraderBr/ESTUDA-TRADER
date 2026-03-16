// js/vendor/tiptap-loader.js
// Carrega todos os módulos do TipTap via esm.sh e os expõe como variáveis globais

import { Editor } from 'https://esm.sh/@tiptap/core@2.1.13?bundle';
import StarterKit from 'https://esm.sh/@tiptap/starter-kit@2.1.13?bundle';
import Highlight from 'https://esm.sh/@tiptap/extension-highlight@2.1.13?bundle';
import Placeholder from 'https://esm.sh/@tiptap/extension-placeholder@2.1.13?bundle';
import Image from 'https://esm.sh/@tiptap/extension-image@2.1.13?bundle';
import TaskList from 'https://esm.sh/@tiptap/extension-task-list@2.1.13?bundle';
import TaskItem from 'https://esm.sh/@tiptap/extension-task-item@2.1.13?bundle';
import Link from 'https://esm.sh/@tiptap/extension-link@2.1.13?bundle';
import Underline from 'https://esm.sh/@tiptap/extension-underline@2.1.13?bundle';
import TextAlign from 'https://esm.sh/@tiptap/extension-text-align@2.1.13?bundle';
import TextStyle from 'https://esm.sh/@tiptap/extension-text-style@2.1.13?bundle';
import Color from 'https://esm.sh/@tiptap/extension-color@2.1.13?bundle';
import Table from 'https://esm.sh/@tiptap/extension-table@2.1.13?bundle';
import TableRow from 'https://esm.sh/@tiptap/extension-table-row@2.1.13?bundle';
import TableCell from 'https://esm.sh/@tiptap/extension-table-cell@2.1.13?bundle';
import TableHeader from 'https://esm.sh/@tiptap/extension-table-header@2.1.13?bundle';
import Typography from 'https://esm.sh/@tiptap/extension-typography@2.1.13?bundle';
import { Extension } from 'https://esm.sh/@tiptap/core@2.1.13?bundle';

// Expor como globais para uso pelo sistema existente
window.tiptapCore = { Editor, Extension };
window.tiptapStarterKit = { StarterKit };
window.tiptapExtensionHighlight = { Highlight };
window.tiptapExtensionPlaceholder = { Placeholder };
window.tiptapExtensionImage = { Image };
window.tiptapExtensionTaskList = { TaskList };
window.tiptapExtensionTaskItem = { TaskItem };
window.tiptapExtensionLink = { Link };
window.tiptapExtensionUnderline = { Underline };
window.tiptapExtensionTextAlign = { TextAlign };
window.tiptapExtensionTextStyle = { TextStyle };
window.tiptapExtensionColor = { Color };
window.tiptapExtensionTable = { Table };
window.tiptapExtensionTableRow = { TableRow };
window.tiptapExtensionTableCell = { TableCell };
window.tiptapExtensionTableHeader = { TableHeader };
window.tiptapExtensionTypography = { Typography };

// Sinalizar que o TipTap está pronto
window.__tiptapReady = true;
window.dispatchEvent(new CustomEvent('tiptap-ready'));

console.log('[TipTap Loader] Todos os módulos carregados com sucesso.');
