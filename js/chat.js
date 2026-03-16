// js/chat.js
// Chat estilo NotebookLM — input manual, sem botões de sugestão nem toggle de modo.
// Usa Cohere command-r + embed-multilingual-v3.0 via Edge Function.
// Suporta prompt personalizado configurado na aba Configurações.

import { supabase } from './supabaseClient.js';
import { getCustomPreamble } from './settings.js';
import { createFreeNote, saveFreeNoteContent } from './dataService.js';

let chatHistory = [];

export function renderChat(container) {
  container.innerHTML = `
    <div class="flex flex-col h-full" id="chat-root">

      <!-- Header -->
      <div class="px-5 pt-4 pb-3 border-b border-zinc-100 bg-white shrink-0">
        <div class="max-w-2xl mx-auto flex items-center justify-between">
          <div class="flex items-center gap-2.5">
            <span class="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center shrink-0">
              <i data-lucide="bot-message-square" class="w-4 h-4 text-white"></i>
            </span>
            <div>
              <h1 class="text-[15px] font-bold text-zinc-900 leading-tight">Professor Brooks</h1>
              <p id="custom-prompt-badge" class="text-[10px] text-zinc-400 leading-none mt-0.5"></p>
            </div>
          </div>
          <button id="chat-clear-btn" title="Nova conversa"
            class="p-2 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors">
            <i data-lucide="square-pen" class="w-4 h-4"></i>
          </button>
        </div>
      </div>

      <!-- Messages -->
      <div id="chat-messages" class="flex-1 overflow-y-auto">
        <div class="max-w-2xl mx-auto px-5 py-6 space-y-5" id="chat-messages-inner">

          <!-- Welcome state -->
          <div id="chat-welcome" class="flex flex-col items-center text-center py-14 select-none">
            <div class="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mb-5">
              <i data-lucide="graduation-cap" class="w-8 h-8 text-emerald-500"></i>
            </div>
            <h2 class="text-base font-bold text-zinc-800 mb-2">Pronto para responder</h2>
            <p class="text-sm text-zinc-400 max-w-xs leading-relaxed">
              Digite qualquer pergunta sobre Price Action, metodologia Al Brooks ou os materiais do curso.
            </p>
          </div>

        </div>
      </div>

      <!-- Input -->
      <div class="border-t border-zinc-100 bg-white px-4 py-3 shrink-0 safe-bottom">
        <div class="max-w-2xl mx-auto">
          <form id="chat-form" class="flex items-end gap-2">
            <div class="flex-1">
              <textarea id="chat-input" rows="1"
                placeholder="Digite sua pergunta…"
                class="w-full resize-none bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3
                       text-sm text-zinc-800 placeholder:text-zinc-400
                       focus:outline-none focus:bg-white focus:border-zinc-400 focus:ring-2 focus:ring-zinc-100
                       transition-all leading-relaxed overflow-hidden"
                style="max-height:160px;"></textarea>
            </div>
            <button id="chat-send-btn" type="submit"
              class="shrink-0 w-10 h-10 bg-emerald-500 hover:bg-emerald-600
                     disabled:bg-zinc-200 disabled:cursor-not-allowed
                     text-white rounded-xl flex items-center justify-center transition-colors"
              disabled>
              <i data-lucide="arrow-up" class="w-4 h-4"></i>
            </button>
          </form>
          <p class="text-[10px] text-zinc-300 text-center mt-2">
            Respostas baseadas nos materiais do curso Al Brooks · Powered by Cohere
          </p>
        </div>
      </div>

    </div>`;

  if (window.lucide) window.lucide.createIcons();

  // ── Refs
  const form        = document.getElementById('chat-form');
  const input       = document.getElementById('chat-input');
  const sendBtn     = document.getElementById('chat-send-btn');
  const messagesEl  = document.getElementById('chat-messages');
  const innerEl     = document.getElementById('chat-messages-inner');
  const welcome     = document.getElementById('chat-welcome');
  const clearBtn    = document.getElementById('chat-clear-btn');
  const promptBadge = document.getElementById('custom-prompt-badge');

  let isLoading = false;

  // Mostra badge se há prompt personalizado ativo
  function refreshPromptBadge() {
    const cp = getCustomPreamble();
    if (cp) {
      promptBadge.textContent = '✦ Prompt personalizado ativo';
      promptBadge.className = 'text-[10px] text-emerald-500 leading-none mt-0.5 font-medium';
    } else {
      promptBadge.textContent = 'Materiais Al Brooks · RAG';
      promptBadge.className = 'text-[10px] text-zinc-400 leading-none mt-0.5';
    }
  }
  refreshPromptBadge();

  // ── Auto-resize textarea
  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 160) + 'px';
    sendBtn.disabled = !input.value.trim() || isLoading;
  });

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isLoading && input.value.trim()) form.requestSubmit();
    }
  });

  // ── Nova conversa
  clearBtn.addEventListener('click', () => {
    chatHistory = [];
    innerEl.innerHTML = '';
    innerEl.appendChild(welcome);
    welcome.classList.remove('hidden');
    refreshPromptBadge();
  });

  // ── Enviar
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const query = input.value.trim();
    if (!query || isLoading) return;

    welcome.classList.add('hidden');
    isLoading = true;
    sendBtn.disabled = true;
    input.value = '';
    input.style.height = 'auto';

    appendMessage('user', query);
    chatHistory.push({ role: 'user', text: query });

    const loadingEl = appendLoading();
    scrollToBottom();

    try {
      const customPreamble = getCustomPreamble();

      const { data, error } = await supabase.functions.invoke('chat-with-notes', {
        body: {
          query,
          history: chatHistory.slice(-8),
          customPreamble: customPreamble || undefined,
        },
      });

      loadingEl.remove();
      if (error) throw error;

      const answer  = data?.answer  || 'Não foi possível processar a resposta.';
      const sources = data?.sources || [];
      const model   = data?.model   || '';

      appendMessage('assistant', answer, sources, model);
      chatHistory.push({ role: 'assistant', text: answer });

      // Exibe barra de salvar nota logo após a resposta
      appendSaveNoteBar(answer, query);

    } catch (err) {
      loadingEl.remove();
      const msg = err?.message || err?.error || 'Falha na comunicação com a IA.';
      appendMessage('error', `Erro: ${msg}`);
    }

    isLoading = false;
    sendBtn.disabled = !input.value.trim();
    scrollToBottom();
  });

  // ── Renderização de mensagens

  function appendMessage(role, text, sources = [], model = '') {
    const div = document.createElement('div');

    if (role === 'user') {
      div.className = 'flex justify-end';
      div.innerHTML = `
        <div class="bg-zinc-900 text-white rounded-2xl rounded-br-sm px-4 py-2.5
                    max-w-[85%] text-sm leading-relaxed whitespace-pre-wrap break-words">
          ${escapeHtml(text)}
        </div>`;

    } else if (role === 'assistant') {
      const htmlContent = renderMarkdown(text);

      const srcHtml = sources.length > 0
        ? `<div class="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-zinc-100">
             <span class="text-[10px] text-zinc-400 font-medium self-center mr-0.5">Fontes:</span>
             ${sources.map(s => `
               <span class="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5
                            rounded-md font-medium border border-emerald-100">
                 ${escapeHtml(s)}
               </span>`).join('')}
           </div>`
        : '';

      div.className = 'flex justify-start';
      div.innerHTML = `
        <div class="bg-white border border-zinc-200 rounded-2xl rounded-bl-sm
                    px-4 py-3 max-w-[92%] shadow-sm">
          <div class="text-sm text-zinc-700 leading-relaxed tiptap-render chat-answer">
            ${htmlContent}
          </div>
          ${srcHtml}
        </div>`;

    } else {
      // role === 'error'
      div.className = 'flex justify-center';
      div.innerHTML = `
        <div class="bg-red-50 border border-red-200 text-red-600 text-xs
                    px-4 py-2.5 rounded-xl max-w-sm text-center leading-relaxed">
          ${escapeHtml(text)}
        </div>`;
    }

    innerEl.appendChild(div);
    scrollToBottom();
  }

  // ── Barra de salvar nota

  function appendSaveNoteBar(markdownText, userQuery) {
    const suggestedTitle = extractNoteTitle(markdownText, userQuery);
    const barId = 'snb-' + Date.now();

    const wrap = document.createElement('div');
    wrap.id = barId;
    wrap.className = 'flex justify-start pl-0.5';
    wrap.innerHTML = `
      <!-- Prompt inicial -->
      <div class="save-note-prompt flex items-center gap-1.5">
        <button class="save-note-open-btn flex items-center gap-1.5 text-[11px] text-zinc-400
                       hover:text-emerald-600 px-2.5 py-1.5 rounded-lg
                       hover:bg-emerald-50 border border-transparent hover:border-emerald-100
                       transition-all select-none">
          <i data-lucide="bookmark-plus" class="w-3.5 h-3.5 shrink-0"></i>
          Salvar como nota
        </button>
      </div>

      <!-- Formulário inline -->
      <div class="save-note-form hidden items-center gap-2 flex-wrap">
        <input type="text"
          class="save-note-title text-xs bg-white border border-zinc-200 rounded-lg
                 px-3 py-1.5 min-w-[180px] flex-1
                 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-100
                 text-zinc-700 placeholder:text-zinc-400"
          placeholder="Título da nota…"
          value="${escapeAttr(suggestedTitle)}">
        <button class="save-note-confirm-btn text-xs bg-emerald-500 hover:bg-emerald-600
                       disabled:bg-zinc-200 disabled:cursor-not-allowed
                       text-white px-3 py-1.5 rounded-lg transition-colors font-medium shrink-0">
          Salvar
        </button>
        <button class="save-note-cancel-btn text-xs text-zinc-400 hover:text-zinc-600
                       px-2 py-1.5 rounded-lg transition-colors shrink-0">
          Cancelar
        </button>
      </div>

      <!-- Sucesso -->
      <div class="save-note-success hidden items-center gap-1.5 text-[11px] text-emerald-600 font-medium">
        <i data-lucide="check-circle" class="w-3.5 h-3.5 shrink-0"></i>
        Nota salva
        <a class="save-note-link underline underline-offset-2 cursor-pointer hover:text-emerald-700">
          Ver nas notas
        </a>
      </div>`;

    innerEl.appendChild(wrap);
    if (window.lucide) window.lucide.createIcons();

    const promptEl  = wrap.querySelector('.save-note-prompt');
    const formEl    = wrap.querySelector('.save-note-form');
    const successEl = wrap.querySelector('.save-note-success');
    const titleInput = wrap.querySelector('.save-note-title');
    const openBtn   = wrap.querySelector('.save-note-open-btn');
    const confirmBtn = wrap.querySelector('.save-note-confirm-btn');
    const cancelBtn = wrap.querySelector('.save-note-cancel-btn');
    const noteLink  = wrap.querySelector('.save-note-link');

    openBtn.addEventListener('click', () => {
      promptEl.classList.add('hidden');
      formEl.classList.remove('hidden');
      formEl.classList.add('flex');
      titleInput.focus();
      titleInput.select();
    });

    cancelBtn.addEventListener('click', () => {
      formEl.classList.add('hidden');
      formEl.classList.remove('flex');
      promptEl.classList.remove('hidden');
    });

    titleInput.addEventListener('keydown', e => {
      if (e.key === 'Enter')  confirmBtn.click();
      if (e.key === 'Escape') cancelBtn.click();
    });

    confirmBtn.addEventListener('click', async () => {
      const title = titleInput.value.trim() || suggestedTitle || 'Nota sem título';
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Salvando…';

      try {
        const savedNote = await saveAnswerAsNote(title, markdownText);
        formEl.classList.add('hidden');
        formEl.classList.remove('flex');
        successEl.classList.remove('hidden');
        successEl.classList.add('flex');

        if (savedNote?.id) {
          noteLink.addEventListener('click', () => {
            // Navega para a seção de notas
            window.location.hash = '#notes';
          });
        } else {
          noteLink.remove();
        }
      } catch (err) {
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Salvar';
        console.error('Erro ao salvar nota:', err);
      }
    });
  }

  async function saveAnswerAsNote(title, markdownText) {
    const contentHtml = renderMarkdown(markdownText);
    const contentText = markdownText;

    const note = await createFreeNote({ title, emoji: '📝' });
    if (!note) throw new Error('Falha ao criar nota');

    await saveFreeNoteContent(note.id, contentHtml, contentText);
    return note;
  }

  // ── Extrai um título sugerido do markdown da resposta

  function extractNoteTitle(markdownText, fallback) {
    // Tenta o primeiro heading ##
    const h = markdownText.match(/^#{1,3}\s+(.+)$/m);
    if (h) return h[1].replace(/\*+/g, '').trim().substring(0, 80);

    // Tenta o primeiro trecho em negrito
    const b = markdownText.match(/\*\*([^*]{8,70})\*\*/);
    if (b) return b[1].trim();

    // Primeira linha com conteúdo real
    const firstLine = markdownText.split('\n').find(l => l.trim().length > 5 && !l.startsWith('#'));
    if (firstLine) return firstLine.replace(/\*+/g, '').trim().substring(0, 80);

    return (fallback || 'Nota').substring(0, 80);
  }

  // ── Utilitários

  function appendLoading() {
    const div = document.createElement('div');
    div.className = 'flex justify-start';
    div.id = 'chat-loading';
    div.innerHTML = `
      <div class="bg-white border border-zinc-200 rounded-2xl rounded-bl-sm
                  px-4 py-3 shadow-sm flex items-center gap-2.5">
        <div class="flex gap-1">
          <span class="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style="animation-delay:0ms"></span>
          <span class="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style="animation-delay:150ms"></span>
          <span class="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style="animation-delay:300ms"></span>
        </div>
        <span class="text-xs text-zinc-400">Consultando materiais…</span>
      </div>`;
    innerEl.appendChild(div);
    return div;
  }

  function scrollToBottom() {
    requestAnimationFrame(() => { messagesEl.scrollTop = messagesEl.scrollHeight; });
  }

  function renderMarkdown(text) {
    if (window.marked) {
      const html = window.marked.parse(text, { gfm: true, breaks: true });
      return html.replace(/<li>\s*<p>([\s\S]*?)<\/p>\s*<\/li>/g, '<li>$1</li>');
    }
    return escapeHtml(text)
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br>');
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function escapeAttr(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}
