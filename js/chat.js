// js/chat.js
// Interface de chat RAG — "Pergunte ao Al Brooks"
// Envia perguntas para a Edge Function chat-with-notes e renderiza respostas em Markdown.

import { supabase } from './supabaseClient.js';

let chatHistory = []; // { role: 'user'|'assistant', text: string }

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
            <p class="text-xs text-zinc-400 mt-1 ml-9">IA treinada no material completo do curso — respostas baseadas nos documentos</p>
          </div>
          <button id="chat-clear-btn" title="Nova conversa"
            class="p-2 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors shrink-0">
            <i data-lucide="message-square-plus" class="w-4.5 h-4.5"></i>
          </button>
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
            <p class="text-sm text-zinc-400 max-w-sm leading-relaxed">
              Faça perguntas sobre qualquer conceito do curso Al Brooks. As respostas são baseadas exclusivamente nos materiais de estudo.
            </p>
            <div class="flex flex-wrap gap-2 mt-6 justify-center">
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
                style="max-height: 120px;"></textarea>
            </div>
            <button id="chat-send-btn" type="submit"
              class="shrink-0 w-10 h-10 bg-emerald-500 hover:bg-emerald-600 disabled:bg-zinc-200 disabled:cursor-not-allowed
                     text-white rounded-xl flex items-center justify-center transition-colors"
              disabled>
              <i data-lucide="arrow-up" class="w-4.5 h-4.5"></i>
            </button>
          </form>
          <p class="text-[10px] text-zinc-300 text-center mt-2">Respostas baseadas nos documentos do curso Al Brooks</p>
        </div>
      </div>
    </div>`;

    if (window.lucide) window.lucide.createIcons();

    // ── Refs ──────────────────────────────────────────────────────────────────
    const form       = document.getElementById('chat-form');
    const input      = document.getElementById('chat-input');
    const sendBtn    = document.getElementById('chat-send-btn');
    const messagesEl = document.getElementById('chat-messages');
    const innerEl    = document.getElementById('chat-messages-inner');
    const welcome    = document.getElementById('chat-welcome');
    const clearBtn   = document.getElementById('chat-clear-btn');

    let isLoading = false;

    // ── Auto-resize textarea ─────────────────────────────────────────────────
    input.addEventListener('input', () => {
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 120) + 'px';
        sendBtn.disabled = !input.value.trim() || isLoading;
    });

    // Enter envia (Shift+Enter nova linha)
    input.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (!isLoading && input.value.trim()) form.requestSubmit();
        }
    });

    // ── Sugestões ────────────────────────────────────────────────────────────
    innerEl.querySelectorAll('.chat-suggestion').forEach(btn => {
        btn.addEventListener('click', () => {
            input.value = btn.textContent.trim();
            input.dispatchEvent(new Event('input'));
            form.requestSubmit();
        });
    });

    // ── Limpar conversa ──────────────────────────────────────────────────────
    clearBtn.addEventListener('click', () => {
        chatHistory = [];
        innerEl.innerHTML = '';
        innerEl.appendChild(welcome);
        welcome.classList.remove('hidden');
    });

    // ── Enviar pergunta ──────────────────────────────────────────────────────
    form.addEventListener('submit', async e => {
        e.preventDefault();
        const query = input.value.trim();
        if (!query || isLoading) return;

        welcome.classList.add('hidden');
        isLoading = true;
        sendBtn.disabled = true;
        input.value = '';
        input.style.height = 'auto';

        // Mensagem do usuário
        appendMessage('user', query);
        chatHistory.push({ role: 'user', text: query });

        // Loading indicator
        const loadingEl = appendLoading();
        scrollToBottom();

        try {
            const { data, error } = await supabase.functions.invoke('chat-with-notes', {
                body: {
                    query,
                    history: chatHistory.slice(-8) // últimas 4 trocas
                }
            });

            loadingEl.remove();

            if (error) throw error;

            const answer = data?.answer || 'Erro ao processar resposta.';
            const sources = data?.sources || [];

            appendMessage('assistant', answer, sources);
            chatHistory.push({ role: 'assistant', text: answer });

        } catch (err) {
            loadingEl.remove();
            appendMessage('error', `Erro: ${err.message || 'Falha na comunicação com a IA.'}`);
        }

        isLoading = false;
        sendBtn.disabled = !input.value.trim();
        scrollToBottom();
    });

    // ── Renderizar mensagens ─────────────────────────────────────────────────

    function appendMessage(role, text, sources = []) {
        const div = document.createElement('div');

        if (role === 'user') {
            div.className = 'flex justify-end';
            div.innerHTML = `
              <div class="bg-zinc-900 text-white rounded-2xl rounded-br-md px-4 py-2.5 max-w-[85%] text-sm leading-relaxed whitespace-pre-wrap">
                ${escapeHtml(text)}
              </div>`;
        } else if (role === 'assistant') {
            const htmlContent = renderMarkdown(text);
            const srcHtml = sources.length > 0
                ? `<div class="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-zinc-100">
                     <span class="text-[10px] text-zinc-400 font-medium mr-1">Fontes:</span>
                     ${sources.map(s => `<span class="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md font-medium border border-emerald-100">${escapeHtml(s)}</span>`).join('')}
                   </div>`
                : '';

            div.className = 'flex justify-start';
            div.innerHTML = `
              <div class="bg-white border border-zinc-200 rounded-2xl rounded-bl-md px-4 py-3 max-w-[92%] shadow-sm">
                <div class="text-sm text-zinc-700 leading-relaxed tiptap-render chat-answer">${htmlContent}</div>
                ${srcHtml}
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
        div.innerHTML = `
          <div class="bg-white border border-zinc-200 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm flex items-center gap-2">
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
        requestAnimationFrame(() => {
            messagesEl.scrollTop = messagesEl.scrollHeight;
        });
    }

    /** Converte markdown para HTML (usa marked se disponível, senão faz básico) */
    function renderMarkdown(text) {
        if (window.marked) {
            const html = window.marked.parse(text, { gfm: true, breaks: true });
            return html.replace(/<li>\s*<p>([\s\S]*?)<\/p>\s*<\/li>/g, '<li>$1</li>');
        }
        // Fallback mínimo
        return escapeHtml(text)
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/\n/g, '<br>');
    }

    function escapeHtml(str) {
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
}
