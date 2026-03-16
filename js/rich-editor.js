// js/rich-editor.js
// Editor.js — Notion-like block editor | CDN puro, sem build tools

import { supabase } from './supabaseClient.js';

/* ════════════════════════════════════════════════════════════════════════════
   CDN LOADER — carrega Editor.js e plugins via jsdelivr
   ════════════════════════════════════════════════════════════════════════════ */

const CDN_SCRIPTS = [
  'https://cdn.jsdelivr.net/npm/@editorjs/editorjs@2.28.2/dist/editorjs.umd.min.js',
  // Plugins (parallel after core loads)
  'https://cdn.jsdelivr.net/npm/@editorjs/header@2.8.7/dist/header.umd.min.js',
  'https://cdn.jsdelivr.net/npm/@editorjs/list@1.10.0/dist/list.umd.min.js',
  'https://cdn.jsdelivr.net/npm/@editorjs/image@2.9.3/dist/image.umd.min.js',
  'https://cdn.jsdelivr.net/npm/@editorjs/quote@2.7.6/dist/quote.umd.min.js',
  'https://cdn.jsdelivr.net/npm/@editorjs/code@2.9.3/dist/code.umd.min.js',
  'https://cdn.jsdelivr.net/npm/@editorjs/table@2.4.3/dist/table.umd.min.js',
  'https://cdn.jsdelivr.net/npm/@editorjs/delimiter@1.4.2/dist/delimiter.umd.min.js',
  'https://cdn.jsdelivr.net/npm/@editorjs/marker@1.4.0/dist/marker.umd.min.js',
  'https://cdn.jsdelivr.net/npm/@editorjs/checklist@1.6.0/dist/checklist.umd.min.js',
  'https://cdn.jsdelivr.net/npm/@editorjs/inline-code@1.5.1/dist/inline-code.umd.min.js',
  'https://cdn.jsdelivr.net/npm/@editorjs/warning@1.4.0/dist/warning.umd.min.js',
  'https://cdn.jsdelivr.net/npm/@editorjs/link@2.6.2/dist/link.umd.min.js',
  'https://cdn.jsdelivr.net/npm/@editorjs/paragraph@2.11.6/dist/paragraph.umd.min.js',
];

function loadScript(src) {
  return new Promise((resolve) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => { console.warn('[editor] falhou ao carregar:', src); resolve(); };
    document.head.appendChild(s);
  });
}

let _scriptsLoaded = false;
async function loadEditorScripts() {
  if (_scriptsLoaded) return;
  // Load EditorJS core first, then all plugins in parallel
  await loadScript(CDN_SCRIPTS[0]);
  await Promise.all(CDN_SCRIPTS.slice(1).map(loadScript));
  _scriptsLoaded = true;
}

/* ════════════════════════════════════════════════════════════════════════════
   CUSTOM TOOLS
   ════════════════════════════════════════════════════════════════════════════ */

/** Bloco de comentário colapsável */
class CommentBlock {
  static get toolbox() {
    return { title: 'Comentário', icon: '<b style="font-size:14px">💬</b>' };
  }
  static get sanitize() {
    return {
      text: { br: true, b: true, i: true, u: true, s: true, mark: true, code: true },
      collapsed: false,
    };
  }

  constructor({ data, api, readOnly }) {
    this.data = data || { text: '', collapsed: false };
    this.api = api;
    this.readOnly = readOnly;
    this._el = null;
    this._body = null;
    this._collapsed = !!data?.collapsed;
  }

  render() {
    const wrapper = document.createElement('div');
    wrapper.className = 'ce-comment-block';

    const header = document.createElement('div');
    header.className = 'ce-comment-header';
    header.innerHTML = `<span class="ce-comment-toggle">${this._collapsed ? '▶' : '▼'}</span> <span>💬 Comentário</span>`;
    header.addEventListener('click', () => this._toggleCollapse());

    const body = document.createElement('div');
    body.className = 'ce-comment-body';
    body.contentEditable = !this.readOnly;
    body.innerHTML = this.data.text || '';
    body.dataset.placeholder = 'Escreva o comentário...';
    if (this._collapsed) body.style.display = 'none';

    wrapper.appendChild(header);
    wrapper.appendChild(body);

    this._el = wrapper;
    this._body = body;
    return wrapper;
  }

  _toggleCollapse() {
    this._collapsed = !this._collapsed;
    this._body.style.display = this._collapsed ? 'none' : '';
    const toggle = this._el.querySelector('.ce-comment-toggle');
    if (toggle) toggle.textContent = this._collapsed ? '▶' : '▼';
  }

  save() {
    return { text: this._body?.innerHTML || '', collapsed: this._collapsed };
  }
}

/** Callout Info/Warn/Tip/Danger */
class CalloutBlock {
  static get toolbox() {
    return { title: 'Callout', icon: '<b>📢</b>' };
  }
  static get sanitize() {
    return {
      variant: false,
      text: { br: true, b: true, i: true },
    };
  }

  constructor({ data, readOnly }) {
    this.data = { variant: 'info', text: '', ...(data || {}) };
    this.readOnly = readOnly;
    this._body = null;
    this._sel = null;
  }

  render() {
    const ICONS = { info: 'ℹ️', warn: '⚠️', tip: '💡', danger: '🚫' };
    const wrapper = document.createElement('div');
    wrapper.className = `ce-callout ce-callout--${this.data.variant}`;

    const iconEl = document.createElement('span');
    iconEl.className = 'ce-callout-icon';
    iconEl.textContent = ICONS[this.data.variant] || 'ℹ️';

    const sel = document.createElement('select');
    sel.className = 'ce-callout-select';
    [['info','Info'],['warn','Aviso'],['tip','Dica'],['danger','Perigo']].forEach(([v,l]) => {
      const o = document.createElement('option');
      o.value = v; o.textContent = l;
      if (v === this.data.variant) o.selected = true;
      sel.appendChild(o);
    });
    sel.addEventListener('change', () => {
      this.data.variant = sel.value;
      wrapper.className = `ce-callout ce-callout--${sel.value}`;
      iconEl.textContent = ICONS[sel.value] || 'ℹ️';
    });

    const body = document.createElement('div');
    body.className = 'ce-callout-body';
    body.contentEditable = !this.readOnly;
    body.innerHTML = this.data.text || '';
    body.dataset.placeholder = 'Escreva aqui...';

    wrapper.appendChild(iconEl);
    const right = document.createElement('div');
    right.style.flex = '1';
    right.appendChild(sel);
    right.appendChild(body);
    wrapper.appendChild(right);

    this._body = body;
    this._sel = sel;
    return wrapper;
  }

  save() {
    return { variant: this._sel?.value || this.data.variant, text: this._body?.innerHTML || '' };
  }
}

/* ════════════════════════════════════════════════════════════════════════════
   IMAGE UPLOAD — Supabase Storage
   ════════════════════════════════════════════════════════════════════════════ */

const BUCKET = 'concept-images';

async function uploadImageFile(file) {
  if (!file?.type?.startsWith('image/')) return null;
  if (file.size > 5 * 1024 * 1024) { alert('Imagem muito grande (máx 5MB).'); return null; }
  const ext = file.name.split('.').pop() || 'png';
  const path = `note-images/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { cacheControl: '3600', upsert: false });
  if (error) { console.error('[editor] upload error:', error); alert('Falha ao enviar imagem.'); return null; }
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/* ════════════════════════════════════════════════════════════════════════════
   HTML ↔ EDITOR.JS BLOCKS
   ════════════════════════════════════════════════════════════════════════════ */

function htmlToBlocks(html) {
  if (!html?.trim()) return [];

  // Detect Editor.js JSON format
  try {
    const trimmed = html.trim();
    if (trimmed.startsWith('{') && trimmed.includes('"blocks"')) {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed.blocks)) return parsed.blocks;
    }
  } catch {}

  // Parse HTML
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const blocks = [];

  for (const el of doc.body.childNodes) {
    if (el.nodeType === 3) {
      const t = el.textContent?.trim();
      if (t) blocks.push({ type: 'paragraph', data: { text: t } });
      continue;
    }
    if (el.nodeType !== 1) continue;
    const tag = el.tagName.toLowerCase();

    // Callout
    if (tag === 'div' && (el.dataset?.callout || el.classList?.contains('editor-callout'))) {
      const variant = el.dataset?.callout || 'info';
      blocks.push({ type: 'callout', data: { variant, text: el.innerHTML.replace(/<[^>]+>/g,'').trim() } });
      continue;
    }

    // Comment block
    if (tag === 'blockquote' && el.classList?.contains('comment-block')) {
      blocks.push({ type: 'comment', data: { text: el.innerHTML.trim() } });
      continue;
    }

    switch (tag) {
      case 'h1': blocks.push({ type: 'header', data: { text: el.innerHTML, level: 1 } }); break;
      case 'h2': blocks.push({ type: 'header', data: { text: el.innerHTML, level: 2 } }); break;
      case 'h3': blocks.push({ type: 'header', data: { text: el.innerHTML, level: 3 } }); break;
      case 'h4': blocks.push({ type: 'header', data: { text: el.innerHTML, level: 4 } }); break;
      case 'p': {
        const t = el.innerHTML?.trim();
        if (t && t !== '<br>') blocks.push({ type: 'paragraph', data: { text: t } });
        break;
      }
      case 'blockquote':
        blocks.push({ type: 'quote', data: { text: el.innerHTML.trim(), caption: '', alignment: 'left' } });
        break;
      case 'pre':
        blocks.push({ type: 'code', data: { code: el.textContent || '' } });
        break;
      case 'ul': {
        const isTask = el.dataset?.type === 'taskList';
        if (isTask) {
          const items = Array.from(el.querySelectorAll('li')).map(li => ({
            text: li.textContent?.trim() || '',
            checked: li.dataset?.checked === 'true'
          }));
          blocks.push({ type: 'checklist', data: { items } });
        } else {
          const items = Array.from(el.querySelectorAll(':scope > li')).map(li => li.innerHTML?.trim() || '');
          blocks.push({ type: 'list', data: { style: 'unordered', items } });
        }
        break;
      }
      case 'ol': {
        const items = Array.from(el.querySelectorAll(':scope > li')).map(li => li.innerHTML?.trim() || '');
        blocks.push({ type: 'list', data: { style: 'ordered', items } });
        break;
      }
      case 'hr':
        blocks.push({ type: 'delimiter', data: {} });
        break;
      case 'img': {
        const src = el.getAttribute('src');
        if (src) blocks.push({ type: 'image', data: { file: { url: src }, caption: el.alt || '', withBorder: false, stretched: false, withBackground: false } });
        break;
      }
      case 'table': {
        const rows = Array.from(el.querySelectorAll('tr')).map(tr =>
          Array.from(tr.querySelectorAll('td, th')).map(td => td.innerHTML?.trim() || '')
        );
        if (rows.length) blocks.push({ type: 'table', data: { withHeadings: true, content: rows } });
        break;
      }
      default: {
        const t = el.innerHTML?.trim();
        if (t) blocks.push({ type: 'paragraph', data: { text: t } });
      }
    }
  }

  return blocks.length ? blocks : [{ type: 'paragraph', data: { text: '' } }];
}

function blocksToHtml(blocks) {
  if (!blocks?.length) return '';
  return blocks.map(blockToHtml).filter(Boolean).join('\n');
}

function blockToHtml(block) {
  const d = block.data || {};
  switch (block.type) {
    case 'paragraph':   return d.text ? `<p>${d.text}</p>` : '';
    case 'header':      return `<h${d.level||2}>${d.text||''}</h${d.level||2}>`;
    case 'quote':       return `<blockquote>${d.text||''}</blockquote>`;
    case 'code':        return `<pre><code>${escHtml(d.code||'')}</code></pre>`;
    case 'delimiter':   return `<hr>`;
    case 'image': {
      const url = d.file?.url || d.url || '';
      return url ? `<img src="${url}" alt="${escHtml(d.caption||'')}">` : '';
    }
    case 'list': {
      const tag = d.style === 'ordered' ? 'ol' : 'ul';
      const items = (d.items||[]).map(item => {
        const text = typeof item === 'string' ? item : (item.content || item.text || '');
        return `<li>${text}</li>`;
      }).join('');
      return `<${tag}>${items}</${tag}>`;
    }
    case 'checklist': {
      const items = (d.items||[]).map(i =>
        `<li data-type="taskItem" data-checked="${!!i.checked}">${i.text||''}</li>`
      ).join('');
      return `<ul data-type="taskList">${items}</ul>`;
    }
    case 'table': {
      const rows = (d.content||[]).map((row, ri) => {
        const cells = row.map(cell =>
          (ri === 0 && d.withHeadings) ? `<th>${cell}</th>` : `<td>${cell}</td>`
        ).join('');
        return `<tr>${cells}</tr>`;
      }).join('');
      return `<table>${rows}</table>`;
    }
    case 'warning':
      return `<div data-callout="warn" class="editor-callout callout-warn"><p>⚠️ <b>${escHtml(d.title||'')}</b>: ${d.message||''}</p></div>`;
    case 'callout': {
      const variant = d.variant || 'info';
      return `<div data-callout="${variant}" class="editor-callout callout-${variant}">${d.text||''}</div>`;
    }
    case 'comment':
      return `<blockquote class="comment-block">${d.text||''}</blockquote>`;
    case 'linkTool':
      return d.link ? `<p><a href="${d.link}" class="editor-link">${d.meta?.title||d.link}</a></p>` : '';
    default:
      return '';
  }
}

function blocksToText(blocks) {
  return (blocks || []).map(b => {
    const d = b.data || {};
    switch (b.type) {
      case 'paragraph': case 'header': case 'quote':
        return (d.text||'').replace(/<[^>]+>/g,'');
      case 'code': return d.code || '';
      case 'list': return (d.items||[]).map(i => typeof i === 'string' ? i : (i.content||i.text||'')).join(' ');
      case 'checklist': return (d.items||[]).map(i => i.text||'').join(' ');
      case 'image': return d.caption || '';
      default: return '';
    }
  }).filter(Boolean).join('\n');
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ════════════════════════════════════════════════════════════════════════════
   PUBLIC API
   ════════════════════════════════════════════════════════════════════════════ */

export async function createRichEditor(containerId, initialHtml, onUpdate) {
  const el = document.getElementById(containerId);
  if (!el) { console.error(`[editor] #${containerId} not found`); return null; }

  el.innerHTML = `<div style="padding:20px 0;color:#a1a1aa;font-size:13px;font-style:italic">Carregando editor...</div>`;

  await loadEditorScripts();

  const EJS = window.EditorJS;
  if (!EJS) {
    el.innerHTML = `<p style="color:red;padding:16px">Editor.js não carregou. Verifique sua conexão.</p>`;
    return null;
  }

  el.innerHTML = '';

  const initialBlocks = htmlToBlocks(initialHtml);
  let currentBlocks = [...initialBlocks];
  let saveTimer = null;

  // Build tools config
  const toolCandidates = {
    header: {
      class: window.Header,
      config: { placeholder: 'Título...', levels: [1,2,3,4], defaultLevel: 2 },
      shortcut: 'CMD+SHIFT+H',
    },
    list: {
      class: window.List,
      inlineToolbar: true,
      config: { defaultStyle: 'unordered' },
    },
    checklist: { class: window.Checklist, inlineToolbar: true },
    image: {
      class: window.ImageTool,
      config: {
        uploader: {
          uploadByFile: async (file) => {
            const url = await uploadImageFile(file);
            return url ? { success: 1, file: { url } } : { success: 0, file: { url: '' } };
          },
          uploadByUrl: async (url) => ({ success: 1, file: { url } }),
        },
        buttonContent: '🖼 Selecionar imagem',
        captionPlaceholder: 'Legenda...',
      },
    },
    quote: {
      class: window.Quote,
      inlineToolbar: true,
      config: { quotePlaceholder: 'Citação...', captionPlaceholder: 'Autor' },
    },
    code: { class: window.CodeTool, config: { placeholder: 'Digite o código...' } },
    table: { class: window.Table, inlineToolbar: true, config: { rows: 3, cols: 3, withHeadings: true } },
    delimiter: { class: window.Delimiter },
    warning: {
      class: window.Warning,
      config: { titlePlaceholder: 'Título', messagePlaceholder: 'Mensagem...' },
    },
    // Inline tools
    marker: { class: window.Marker, shortcut: 'CMD+SHIFT+M' },
    inlineCode: { class: window.InlineCode, shortcut: 'CMD+SHIFT+`' },
    // Custom blocks
    callout: { class: CalloutBlock },
    comment: { class: CommentBlock },
  };

  // Only keep tools whose class loaded successfully
  const tools = {};
  for (const [key, cfg] of Object.entries(toolCandidates)) {
    if (cfg?.class) tools[key] = cfg;
  }

  const editor = new EJS({
    holder: el,
    data: { blocks: initialBlocks },
    placeholder: 'Digite "/" para inserir blocos, ou comece a escrever...',
    autofocus: false,
    tools,
    inlineToolbar: ['bold', 'italic', 'link', 'marker', 'inlineCode'],
    onChange: async (api) => {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(async () => {
        try {
          const output = await api.saver.save();
          currentBlocks = output.blocks || [];
          const html = blocksToHtml(currentBlocks);
          const text = blocksToText(currentBlocks);
          onUpdate(html, text);
          const wc = text.split(/\s+/).filter(Boolean).length;
          const cc = text.length;
          window.dispatchEvent(new CustomEvent('editor-stats', { detail: { words: wc, chars: cc } }));
        } catch (e) { console.warn('[editor] save error:', e); }
      }, 1500);
    },
  });

  await editor.isReady;

  // Dispatch initial stats
  const initText = blocksToText(currentBlocks);
  window.dispatchEvent(new CustomEvent('editor-stats', {
    detail: { words: initText.split(/\s+/).filter(Boolean).length, chars: initText.length }
  }));

  return {
    // Core API
    getHTML: () => blocksToHtml(currentBlocks),
    getText: () => blocksToText(currentBlocks),
    destroy: () => { try { editor.destroy(); } catch {} },
    // Image insertion
    insertImage: async (url) => {
      try {
        await editor.isReady;
        editor.blocks.insert('image', { file: { url }, caption: '', withBorder: false, stretched: false, withBackground: false });
      } catch (e) { console.warn('[editor] insertImage:', e); }
    },
    // Force save
    save: async () => {
      const output = await editor.saver.save();
      currentBlocks = output.blocks || [];
      return blocksToHtml(currentBlocks);
    },
    // Compat stubs
    exec: () => {},
    on: () => {},
    chain: () => ({ focus: () => ({ run: () => {} }) }),
    isActive: () => false,
    state: { selection: { from: 0, to: 0 } },
    view: { dom: el },
    _editor: editor,
  };
}

/* ─── Toolbar HTML — Editor.js tem toolbar própria, retorna vazio ─────────── */
export function buildFixedToolbarHTML() { return ''; }

export function attachFixedToolbar(editorInstance) {
  // No-op — Editor.js has its own inline + block toolbar
}

export function attachFloatingToolbar(editor, toolbarEl) {
  if (toolbarEl) toolbarEl.style.display = 'none';
}

export function insertImageInEditor(editor, url) {
  editor?.insertImage?.(url);
}

export function insertCommentBlock(editor) {
  editor?._editor?.blocks?.insert?.('comment', { text: '💬 Comentário...' });
}

export function showEditorImagePopup(src) {
  const overlay = document.createElement('div');
  overlay.className = 'note-img-popup-overlay';
  overlay.innerHTML = `<div class="note-img-popup-inner" onclick="event.stopPropagation()">
    <img src="${src}" alt=""><button class="note-img-popup-close">×</button></div>`;
  overlay.addEventListener('click', () => overlay.remove());
  overlay.querySelector('.note-img-popup-close').addEventListener('click', e => { e.stopPropagation(); overlay.remove(); });
  document.addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', esc); } });
  document.body.appendChild(overlay);
}

export function attachImagePopupHandler(containerEl) {
  if (!containerEl) return;
  containerEl.addEventListener('click', e => {
    if (e.target.tagName === 'IMG' && !e.target.closest('.cdx-input')) {
      showEditorImagePopup(e.target.src);
    }
  });
}

export function attachInlineDeleteHandlers(containerEl, editor) {
  // Editor.js handles its own block deletion natively
}
