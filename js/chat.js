// js/chat.js
// Interface de chat com dois modos:
//   RAG  — perguntas respondidas com base nos materiais do curso (vector search)
//   LIVRE — prompt livre para a IA sem restrição de contexto

import { supabase } from './supabaseClient.js';

let chatHistory = [];
let chatMode = 'rag'; // 'rag' | 'free'

export function renderChat(container) {
    container.innerHTML = `
    <div class="flex flex-col h-full" id="chat-root">

      <!-- Header -->
      <div class="px-5 pt-5 pb-3 border-b border-zinc-100 bg-white shrink-0">
        <div class="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <h1 class="text-[17px] font-bold text-zinc-900 leading-tight flex items-center gap-2">
              <span class="w-7 h-7 bg-emerald-500 rounded-lg flex items-center justify-center shrink-0">
                <i data-lucide="bot-message-square" class="w-4 h-4 text-white"></i>
              </span>
              Pergunte ao Al Brooks
            </h1>
            <p id="chat-mode-desc" class="text-xs text-zinc-400 mt-1 ml-9">IA treinada no material completo do curso — respostas baseadas nos documentos</p>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <!-- Toggle de modo -->
            <div class="flex items-center bg-zinc-100 rounded-xl p-1 gap-0.5" title="Modo de resposta da IA">
              <button id="mode-rag-btn"
                class="mode-toggle-btn px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all bg-white text-zinc-800 shadow-sm">
                <i data-lucide="database" class="w-3 h-3 inline mr-1"></i>Curso
              </button>
              <button id="mode-free-btn"
                class="mode-toggle-btn px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all text-zinc-500 hover:text-zinc-700">
                <i data-lucide="zap" class="w-3 h-3 inline mr-1"></i>Livre
              </button>
            </div>
            <button id="chat-clear-btn" title="Nova conversa"
              class="p-2 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors">
              <i data-lucide="message-square-plus" class="w-4.5 h-4.5"></i>
            </button>
          </div>
        </div>
      </div>

      <!-- Messages -->
      <div id="chat-messages" class="flex-1 overflow-y-auto">
        <div class="max-w-2xl mx-auto px-5 py-6 pb-4 space-y-5" id="chat-messages-inner">
          <!-- Welcome -->
          <div id="chat-welcome" class="flex flex-col items-center text-center py-10 select-none">
            <div class="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mb-4">
              <i data-lucide="graduation-cap" class="w-7 h-7 text-emerald-500"></i>
            </div>
            <h2 class="text-base font-bold text-zinc-800 mb-1">Seu mentor de Price Action</h2>
            <p id="welcome-desc" class="text-sm text-zinc-400 max-w-sm leading-relaxed">
              Faça perguntas sobre qualquer conceito do curso Al Brooks. As respostas são baseadas exclusivamente nos materiais de estudo.
            </p>
            <div class="flex flex-wrap gap-2 mt-6 justify-center" id="suggestions-wrap">
              <button class="chat-suggestion px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-zinc-600 hover:bg-zinc-100 hover:border-zinc-300 transition-colors">
                O que é uma barra de sinal?
              </button>
              <button class="chat-suggestion px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-zinc-600 hover:bg-zinc-100 hover:border-zinc-300 transition-colors">
                Como operar em lateralidade?
              </button>
              <button class="chat-suggestion px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-zinc-600 hover:bg-zinc-100 hover:border-zinc-300 transition-colors">
                Quando fazer swing trade?
              </button>
              <button class="chat-suggestion px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-zinc-600 hover:bg-zinc-100 hover:border-zinc-300 transition-colors">
                Explique o conceito de measured move
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Input bar -->
      <div class="border-t border-zinc-100 bg-white px-4 py-3 shrink-0 safe-bottom">
        <div class="max-w-2xl mx-auto">
          <form id="chat-form" class="flex items-end gap-2">
            <div class="flex-1 relative">
              <textarea id="chat-input" rows="1" placeholder="Pergunte sobre Price Action…"
                class="w-full resize-none bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 pr-4
                       text-sm text-zinc-800 placeholder:text-zinc-400
                       focus:outline-none focus:bg-white focus:border-zinc-400 focus:ring-2 focus:ring-zinc-100
                       transition-all leading-relaxed overflow-hidden"
                style="max-height: 160px;"></textarea>
            </div>
            <button id="chat-send-btn" type="submit"
              class="shrink-0 w-10 h-10 bg-emerald-500 hover:bg-emerald-600 disabled:bg-zinc-200 disabled:cursor-not-allowed
                     text-white rounded-xl flex items-center justify-center transition-colors"
              disabled>
              <i data-lucide="arrow-up" class="w-4.5 h-4.5"></i>
            </button>
          </form>
          <p id="chat-footer-hint" class="text-[10px] text-zinc-300 text-center mt-2">Respostas baseadas nos documentos do curso Al Brooks</p>
        </div>
      </div>
    </div>`;

    if (window.lucide) window.lucide.createIcons();

    // ── Refs ──────────────────────────────────────────────────────────────────
    const form          = document.getElementById('chat-form');
    const input         = document.getElementById('chat-input');
    const sendBtn       = document.getElementById('chat-send-btn');
    const messagesEl    = document.getElementById('chat-messages');
    const innerEl       = document.getElementById('chat-messages-inner');
    const welcome       = document.getElementById('chat-welcome');
    const clearBtn      = document.getElementById('chat-clear-btn');
    const modeRagBtn    = document.getElementById('mode-rag-btn');
    const modeFreeBtn   = document.getElementById('mode-free-btn');
    const modeDesc      = document.getElementById('chat-mode-desc');
    const footerHint    = document.getElementById('chat-footer-hint');
    const welcomeDesc   = document.getElementById('welcome-desc');

    let isLoading = false;

    // ── Modo RAG / Livre ──────────────────────────────────────────────────────
    function applyMode(mode) {
        chatMode = mode;

        const ragActive   = 'bg-white text-zinc-800 shadow-sm';
        const ragInactive = 'text-zinc-500 hover:text-zinc-700';
        const freeActive  = 'bg-white text-violet-700 shadow-sm';
        const freeInactive = 'text-zinc-500 hover:text-zinc-700';

        if (mode === 'rag') {
            modeRagBtn.className  = `mode-toggle-btn px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${ragActive}`;
            modeFreeBtn.className = `mode-toggle-btn px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${freeInactive}`;
            modeDesc.textContent  = 'IA treinada no material completo do curso — respostas baseadas nos documentos';
            footerHint.textContent = 'Respostas baseadas nos documentos do curso Al Brooks';
            input.placeholder     = 'Pergunte sobre Price Action…';
            welcomeDesc.textContent = 'Faça perguntas sobre qualquer conceito do curso Al Brooks. As respostas são baseadas exclusivamente nos materiais de estudo.';
            sendBtn.className     = sendBtn.className.replace('bg-violet-500 hover:bg-violet-600', 'bg-emerald-500 hover:bg-emerald-600');
            if (!sendBtn.className.includes('bg-emerald')) {
                sendBtn.classList.remove('bg-violet-500', 'hover:bg-violet-600');
                sendBtn.classList.add('bg-emerald-500', 'hover:bg-emerald-600');
            }
        } else {
            modeRagBtn.className  = `mode-toggle-btn px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${ragInactive}`;
            modeFreeBtn.className = `mode-toggle-btn px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${freeActive}`;
            modeDesc.textContent  = 'Modo Livre — pergunte qualquer coisa sobre trading, mercado e Price Action';
            footerHint.textContent = 'IA responde livremente com todo seu conhecimento sobre trading';
            input.placeholder     = 'Escreva qualquer pergunta ou prompt…';
            welcomeDesc.textContent = 'Modo Livre: faça qualquer pergunta sobre trading, psicologia, mercados ou Price Action. A IA não está limitada ao material do curso.';
            sendBtn.classList.remove('bg-emerald-500', 'hover:bg-emerald-600');
            sendBtn.classList.add('bg-violet-500', 'hover:bg-violet-600');
        }

        if (window.lucide) window.lucide.createIcons({ nodes: [modeRagBtn, modeFreeBtn] });
    }

    modeRagBtn.addEventListener('click', () => applyMode('rag'));
    modeFreeBtn.addEventListener('click', () => applyMode('free'));

    // ── Auto-resize textarea ──────────────────────────────────────────────────
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

    // ── Sugestões ─────────────────────────────────────────────────────────────
    innerEl.querySelectorAll('.chat-suggestion').forEach(btn => {
        btn.addEventListener('click', () => {
            input.value = btn.textContent.trim();
            input.dispatchEvent(new Event('input'));
            form.requestSubmit();
        });
    });

    // ── Limpar conversa ───────────────────────────────────────────────────────
    clearBtn.addEventListener('click', () => {
        chatHistory = [];
        innerEl.innerHTML = '';
        innerEl.appendChild(welcome);
        welcome.classList.remove('hidden');
    });

    // ── Enviar pergunta ───────────────────────────────────────────────────────
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
            const { data, error } = await supabase.functions.invoke('chat-with-notes', {
                body: {
                    query,
                    history: chatHistory.slice(-8),
                    mode: chatMode,
                }
            });

            loadingEl.remove();
            if (error) throw error;

            const answer  = data?.answer  || 'Erro ao processar resposta.';
            const sources = data?.sources || [];
            const model   = data?.model   || '';

            appendMessage('assistant', answer, sources, model);
            chatHistory.push({ role: 'assistant', text: answer });

        } catch (err) {
            loadingEl.remove();
            appendMessage('error', `Erro: ${err.message || 'Falha na comunicação com a IA.'}`);
        }

        isLoading = false;
        sendBtn.disabled = !input.value.trim();
        scrollToBottom();
    });

    // ── Renderizar mensagens ──────────────────────────────────────────────────

    function appendMessage(role, text, sources = [], model = '') {
        const div = document.createElement('div');

        if (role === 'user') {
            const modeTag = chatMode === 'free'
                ? `<span class="text-[9px] text-violet-400 font-medium ml-1">livre</span>`
                : '';
            div.className = 'flex justify-end';
            div.innerHTML = `
              <div class="bg-zinc-900 text-white rounded-2xl rounded-br-md px-4 py-2.5 max-w-[85%] text-sm leading-relaxed whitespace-pre-wrap">
                ${escapeHtml(text)}${modeTag}
              </div>`;
        } else if (role === 'assistant') {
            const htmlContent = renderMarkdown(text);
            const srcHtml = sources.length > 0
                ? `<div class="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-zinc-100">
                     <span class="text-[10px] text-zinc-400 font-medium mr-1">Fontes:</span>
                     ${sources.map(s => `<span class="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md font-medium border border-emerald-100">${escapeHtml(s)}</span>`).join('')}
                   </div>`
                : '';
            const modelTag = model
                ? `<span class="text-[9px] text-zinc-300 font-mono">${model}</span>`
                : '';
            const freeTag = chatMode === 'free'
                ? `<span class="text-[9px] bg-violet-50 text-violet-500 px-1.5 py-0.5 rounded font-medium border border-violet-100">Modo Livre</span>`
                : '';

            div.className = 'flex justify-start';
            div.innerHTML = `
              <div class="bg-white border border-zinc-200 rounded-2xl rounded-bl-md px-4 py-3 max-w-[92%] shadow-sm">
                <div class="text-sm text-zinc-700 leading-relaxed tiptap-render chat-answer">${htmlContent}</div>
                ${srcHtml}
                ${(modelTag || freeTag) ? `<div class="flex items-center gap-2 mt-2">${freeTag}${modelTag}</div>` : ''}
              </div>`;
        } else {
            div.className = 'flex justify-center';
            div.innerHTML = `
              <div class="bg-red-50 border border-red-200 text-red-600 text-xs px-4 py-2 rounded-xl">
                ${escapeHtml(text)}
              </div>`;
        }

        innerEl.appendChild(div);
        scrollToBottom();
    }

    function appendLoading() {
        const div = document.createElement('div');
        div.className = 'flex justify-start';
        div.id = 'chat-loading';
        const label = chatMode === 'free' ? 'Pensando…' : 'Consultando materiais…';
        div.innerHTML = `
          <div class="bg-white border border-zinc-200 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm flex items-center gap-2">
            <div class="flex gap-1">
              <span class="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style="animation-delay:0ms"></span>
              <span class="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style="animation-delay:150ms"></span>
              <span class="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style="animation-delay:300ms"></span>
            </div>
            <span class="text-xs text-zinc-400">${label}</span>
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
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
}
