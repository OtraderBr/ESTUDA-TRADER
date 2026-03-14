// js/chat-rag.js — Chat com IA usando RAG (Ollama + pgvector + Al Brooks)

export function renderChat(container) {
  container.innerHTML = `
    <div class="flex flex-col h-full max-w-3xl mx-auto px-4 pb-4 pt-6 gap-4">

      <!-- Cabeçalho -->
      <div class="flex items-start justify-between gap-4 shrink-0">
        <div>
          <h2 class="text-lg font-bold text-zinc-900 flex items-center gap-2">
            <i data-lucide="bot" class="w-5 h-5 text-emerald-500"></i>
            Chat Al Brooks IA
          </h2>
          <p class="text-xs text-zinc-500 mt-0.5">
            Pergunte sobre Price Action. A IA responde com base no material do curso.
          </p>
        </div>

        <!-- Status + botões -->
        <div class="flex flex-col items-end gap-2 shrink-0">
          <div id="rag-status-badge" class="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-zinc-100 text-zinc-500">
            <i data-lucide="loader-2" class="w-3 h-3 animate-spin"></i>
            Verificando...
          </div>
          <div class="flex gap-2">
            <button id="rag-test-btn"
              class="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-zinc-100 text-zinc-600 hover:bg-zinc-200 transition-colors"
              title="Verificar se Ollama e modelos estão instalados corretamente">
              <i data-lucide="stethoscope" class="w-3.5 h-3.5"></i>
              Diagnóstico
            </button>
            <button id="rag-ingest-btn"
              class="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-zinc-900 text-white hover:bg-zinc-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Indexar o material do Al Brooks para usar na busca semântica">
              <i data-lucide="database-zap" class="w-3.5 h-3.5"></i>
              Carregar Material
            </button>
          </div>
        </div>
      </div>

      <!-- Barra de progresso da ingestão (oculta por padrão) -->
      <div id="rag-progress-bar" class="hidden shrink-0">
        <div class="bg-zinc-100 rounded-full h-1.5 overflow-hidden">
          <div id="rag-progress-fill" class="bg-emerald-500 h-full transition-all duration-300" style="width: 0%"></div>
        </div>
        <p id="rag-progress-label" class="text-xs text-zinc-500 mt-1 text-center"></p>
      </div>

      <!-- Área de mensagens -->
      <div id="chat-messages"
        class="flex-1 overflow-y-auto flex flex-col gap-4 min-h-0 py-2"
        style="scroll-behavior: smooth;">

        <!-- Mensagem inicial de boas-vindas -->
        <div class="flex gap-3 items-start">
          <div class="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
            <i data-lucide="bot" class="w-4 h-4 text-emerald-600"></i>
          </div>
          <div class="bg-zinc-50 border border-zinc-200 rounded-2xl rounded-tl-sm px-4 py-3 max-w-[85%]">
            <p class="text-sm text-zinc-700 leading-relaxed">
              Olá! Sou seu assistente de estudos do Al Brooks. Faça uma pergunta sobre Price Action e vou buscar a resposta diretamente no material do curso.
            </p>
            <p class="text-xs text-zinc-400 mt-2">
              Primeiro clique em <strong>Diagnóstico</strong> para verificar se tudo está configurado, depois <strong>Carregar Material</strong>.
            </p>
          </div>
        </div>

      </div>

      <!-- Input de pergunta -->
      <div class="shrink-0 flex gap-2 items-end">
        <textarea
          id="chat-input"
          rows="1"
          placeholder="Pergunte sobre Price Action Al Brooks..."
          class="flex-1 resize-none rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-shadow leading-relaxed"
          style="max-height: 120px; overflow-y: auto;"
        ></textarea>
        <button id="chat-send-btn"
          class="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white transition-colors shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
          title="Enviar pergunta">
          <i data-lucide="send" class="w-4 h-4"></i>
        </button>
      </div>

    </div>
  `;

  if (window.lucide) window.lucide.createIcons({ nodes: container.querySelectorAll('[data-lucide]') });

  // ─── Estado local ──────────────────────────────────────────────────────────
  let isLoading   = false;
  let chunksCount = 0;

  const messagesEl   = container.querySelector('#chat-messages');
  const inputEl      = container.querySelector('#chat-input');
  const sendBtn      = container.querySelector('#chat-send-btn');
  const ingestBtn    = container.querySelector('#rag-ingest-btn');
  const testBtn      = container.querySelector('#rag-test-btn');
  const statusBadge  = container.querySelector('#rag-status-badge');
  const progressBar  = container.querySelector('#rag-progress-bar');
  const progressFill = container.querySelector('#rag-progress-fill');
  const progressLbl  = container.querySelector('#rag-progress-label');

  // ─── Status badge ──────────────────────────────────────────────────────────
  function updateStatusBadge(chunks) {
    if (chunks < 0) {
      statusBadge.innerHTML = `<i data-lucide="wifi-off" class="w-3 h-3"></i> Servidor offline`;
      statusBadge.className = 'flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-red-50 text-red-500';
    } else if (chunks === 0) {
      statusBadge.innerHTML = `<i data-lucide="database" class="w-3 h-3"></i> Material não carregado`;
      statusBadge.className = 'flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-amber-50 text-amber-600';
    } else {
      statusBadge.innerHTML = `<i data-lucide="check-circle-2" class="w-3 h-3"></i> ${chunks} chunks indexados`;
      statusBadge.className = 'flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600';
    }
    if (window.lucide) window.lucide.createIcons({ nodes: statusBadge.querySelectorAll('[data-lucide]') });
  }

  async function checkStatus() {
    try {
      const res  = await fetch('/api/rag/status');
      const data = await res.json();
      chunksCount = data.chunks || 0;
      updateStatusBadge(chunksCount);
    } catch {
      updateStatusBadge(-1);
    }
  }

  // ─── Diagnóstico ──────────────────────────────────────────────────────────
  testBtn.addEventListener('click', async () => {
    testBtn.disabled = true;
    testBtn.innerHTML = `<i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin"></i> Verificando...`;
    if (window.lucide) window.lucide.createIcons({ nodes: testBtn.querySelectorAll('[data-lucide]') });

    try {
      const res  = await fetch('/api/rag/test');
      const data = await res.json();

      let msg = '🔍 **Resultado do Diagnóstico:**\n\n';

      if (data.error) {
        msg += `❌ Erro no servidor: ${data.error}\n\n`;
        msg += '👉 **Solução:** Feche o servidor (Ctrl+C no terminal) e abra o start.bat novamente.';
      } else {
        msg += data.ollama
          ? '✅ Ollama está rodando\n'
          : '❌ Ollama NÃO está rodando — Abra o Ollama pelo menu Iniciar\n';

        msg += data.embeddingModel
          ? `✅ Modelo "${data.embeddingModel ? 'nomic-embed-text' : ''}" instalado\n`
          : `❌ Modelo "nomic-embed-text" não instalado\n   👉 Abra o CMD e rode: ollama pull nomic-embed-text\n`;

        msg += data.chatModel
          ? `✅ Modelo "llama3.2" instalado\n`
          : `❌ Modelo "llama3.2" não instalado\n   👉 Abra o CMD e rode: ollama pull llama3.2\n`;

        msg += data.supabase
          ? `✅ Supabase conectado (${data.chunks || 0} chunks no banco)\n`
          : `❌ Supabase com problema de conexão\n`;

        if (data.modelsInstalled?.length > 0) {
          msg += `\n📦 Modelos instalados no Ollama: ${data.modelsInstalled.join(', ')}`;
        }

        if (data.errors?.length > 0) {
          msg += `\n\n⚠️ Detalhes dos erros:\n${data.errors.join('\n')}`;
        }

        const allOk = data.ollama && data.embeddingModel && data.chatModel && data.supabase;
        if (allOk) {
          msg += '\n\n✅ Tudo pronto! Agora clique em **Carregar Material**.';
          if (data.chunks > 0) msg = msg.replace('Agora clique em **Carregar Material**.', 'Material já carregado, pode fazer perguntas!');
        }
      }

      appendMessage('assistant', msg);
    } catch (e) {
      appendMessage('assistant', `❌ Não foi possível conectar ao servidor.\n\n👉 Verifique se o start.bat está rodando.\n\nErro: ${e.message}`);
    }

    testBtn.disabled = false;
    testBtn.innerHTML = `<i data-lucide="stethoscope" class="w-3.5 h-3.5"></i> Diagnóstico`;
    if (window.lucide) window.lucide.createIcons({ nodes: testBtn.querySelectorAll('[data-lucide]') });
  });

  // ─── Ingestão via SSE ──────────────────────────────────────────────────────
  ingestBtn.addEventListener('click', async () => {
    if (isLoading) return;

    // Confirmação obrigatória para evitar ingestão acidental
    const chunkInfo = chunksCount > 0
      ? `⚠️ ATENÇÃO: Isso irá APAGAR os ${chunksCount} chunks existentes e reindexar tudo do zero.\n\nEsse processo pode levar 10-20 minutos.\n\nTem certeza que deseja continuar?`
      : `Isso irá indexar o material do Al Brooks pela primeira vez.\n\nEsse processo pode levar 10-20 minutos.\n\nDeseja continuar?`;

    if (!window.confirm(chunkInfo)) return;

    isLoading = true;
    ingestBtn.disabled = true;
    testBtn.disabled   = true;

    progressBar.classList.remove('hidden');
    progressFill.style.width = '0%';
    progressLbl.textContent  = 'Iniciando ingestão...';

    updateStatusBadge(0);
    appendMessage('assistant', '⏳ Iniciando indexação do material do Al Brooks. Isso pode levar alguns minutos...');

    let completed = false;

    try {
      const response = await fetch('/api/rag/ingest', { method: 'POST' });

      // Verificar se o servidor retornou SSE (e não um erro JSON)
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('text/event-stream')) {
        const errData = await response.json().catch(() => ({}));
        const errMsg  = errData.error || `Erro HTTP ${response.status}`;
        throw new Error(errMsg);
      }

      const reader  = response.body.getReader();
      const decoder = new TextDecoder();
      let   buffer  = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const evt = JSON.parse(line.slice(6));
            if (evt.type === 'done') completed = true;
            handleIngestEvent(evt);
          } catch {}
        }
      }

      if (!completed) {
        appendMessage('assistant', '❌ A indexação foi interrompida antes de terminar.\n\n👉 Clique em **Diagnóstico** para ver o que está errado.\nCausa mais comum: Ollama não está rodando ou o modelo "nomic-embed-text" não foi instalado.');
      }

    } catch (e) {
      appendMessage('assistant', `❌ Erro na ingestão: ${e.message}\n\n👉 Clique em **Diagnóstico** para verificar o problema.`);
      progressBar.classList.add('hidden');
    }

    isLoading = false;
    ingestBtn.disabled = false;
    testBtn.disabled   = false;
    if (completed) setTimeout(() => progressBar.classList.add('hidden'), 4000);
  });

  function handleIngestEvent(evt) {
    if (evt.type === 'start') {
      progressLbl.textContent = `Processando 0 de ${evt.total} arquivos...`;
    } else if (evt.type === 'info') {
      progressLbl.textContent = evt.message;
    } else if (evt.type === 'progress') {
      const pct = Math.round((evt.processed / evt.total) * 100);
      progressFill.style.width = `${pct}%`;
      progressLbl.textContent  = `${evt.processed}/${evt.total} arquivos — Aula ${evt.lesson} (${evt.chunks} chunks)`;
    } else if (evt.type === 'done') {
      progressFill.style.width = '100%';
      progressLbl.textContent  = evt.message;
      chunksCount = evt.chunks;
      updateStatusBadge(evt.chunks);
      appendMessage('assistant', `✅ ${evt.message} Agora você pode fazer perguntas sobre o material!`);
    } else if (evt.type === 'error') {
      appendMessage('assistant', `❌ Erro durante ingestão: ${evt.message}\n\n👉 Clique em **Diagnóstico** para mais detalhes.`);
      progressBar.classList.add('hidden');
    }
  }

  // ─── Chat ──────────────────────────────────────────────────────────────────
  async function sendQuestion() {
    const question = inputEl.value.trim();
    if (!question || isLoading) return;

    if (chunksCount === 0) {
      appendMessage('assistant', '⚠️ O material ainda não foi carregado. Clique em **Carregar Material** primeiro.\n\nSe for a primeira vez, clique em **Diagnóstico** para verificar se o Ollama está configurado.');
      return;
    }

    isLoading = true;
    sendBtn.disabled = true;
    inputEl.value = '';
    inputEl.style.height = 'auto';

    appendMessage('user', question);
    const thinkingId = appendThinking();

    try {
      const res  = await fetch('/api/rag/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ question }),
      });
      const data = await res.json();

      removeThinking(thinkingId);

      if (data.error) {
        appendMessage('assistant', `❌ Erro: ${data.error}`);
      } else {
        appendAnswer(data.answer, data.sources || []);
      }
    } catch (e) {
      removeThinking(thinkingId);
      appendMessage('assistant', `❌ Erro ao conectar com o servidor: ${e.message}`);
    }

    isLoading = false;
    sendBtn.disabled = false;
    inputEl.focus();
  }

  sendBtn.addEventListener('click', sendQuestion);

  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendQuestion();
    }
  });

  inputEl.addEventListener('input', () => {
    inputEl.style.height = 'auto';
    inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + 'px';
  });

  // ─── Helpers de mensagens ──────────────────────────────────────────────────
  function appendMessage(role, text) {
    const isUser = role === 'user';
    const div = document.createElement('div');
    div.className = `flex gap-3 items-start ${isUser ? 'flex-row-reverse' : ''}`;

    const avatar = isUser
      ? `<div class="w-7 h-7 rounded-full bg-zinc-200 flex items-center justify-center shrink-0 mt-0.5">
           <i data-lucide="user" class="w-4 h-4 text-zinc-500"></i>
         </div>`
      : `<div class="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
           <i data-lucide="bot" class="w-4 h-4 text-emerald-600"></i>
         </div>`;

    const bubble = isUser
      ? `<div class="bg-zinc-900 text-white rounded-2xl rounded-tr-sm px-4 py-3 max-w-[85%] text-sm leading-relaxed">${escapeHtml(text)}</div>`
      : `<div class="bg-zinc-50 border border-zinc-200 rounded-2xl rounded-tl-sm px-4 py-3 max-w-[85%] text-sm text-zinc-700 leading-relaxed">${formatText(text)}</div>`;

    div.innerHTML = avatar + bubble;
    messagesEl.appendChild(div);
    if (window.lucide) window.lucide.createIcons({ nodes: div.querySelectorAll('[data-lucide]') });
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function appendAnswer(text, sources) {
    const div = document.createElement('div');
    div.className = 'flex gap-3 items-start';

    // Agrupa fontes por módulo e mostra as 8 mais relevantes
    const topSources = sources.slice(0, 8);
    const sourcesHtml = topSources.length > 0
      ? `<div class="mt-3 pt-3 border-t border-zinc-200">
           <p class="text-xs font-medium text-zinc-400 mb-1.5">${sources.length} fontes consultadas:</p>
           <div class="flex flex-wrap gap-1.5">
             ${topSources.map(s => {
               const color = s.similarity >= 70 ? 'bg-emerald-50 text-emerald-700' : s.similarity >= 55 ? 'bg-blue-50 text-blue-700' : 'bg-zinc-100 text-zinc-500';
               return `<span class="text-xs px-2 py-0.5 rounded-full ${color}" title="${s.module || ''}">
                 ${s.lesson?.replace(/^Aula\s*/i, 'Aula ').substring(0, 40)} · ${s.similarity}%
               </span>`;
             }).join('')}
           </div>
         </div>`
      : '';

    div.innerHTML = `
      <div class="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
        <i data-lucide="bot" class="w-4 h-4 text-emerald-600"></i>
      </div>
      <div class="bg-zinc-50 border border-zinc-200 rounded-2xl rounded-tl-sm px-4 py-3 max-w-[85%]">
        <div class="text-sm text-zinc-700 leading-relaxed">${formatText(text)}</div>
        ${sourcesHtml}
      </div>
    `;

    messagesEl.appendChild(div);
    if (window.lucide) window.lucide.createIcons({ nodes: div.querySelectorAll('[data-lucide]') });
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  let thinkingCounter = 0;
  function appendThinking() {
    const id  = `thinking-${++thinkingCounter}`;
    const div = document.createElement('div');
    div.id = id;
    div.className = 'flex gap-3 items-start';
    div.innerHTML = `
      <div class="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
        <i data-lucide="bot" class="w-4 h-4 text-emerald-600"></i>
      </div>
      <div class="bg-zinc-50 border border-zinc-200 rounded-2xl rounded-tl-sm px-4 py-3">
        <div class="flex items-center gap-1.5 text-zinc-400">
          <i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin"></i>
          <span class="text-xs">Consultando o material do Al Brooks...</span>
        </div>
      </div>
    `;
    messagesEl.appendChild(div);
    if (window.lucide) window.lucide.createIcons({ nodes: div.querySelectorAll('[data-lucide]') });
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return id;
  }

  function removeThinking(id) {
    container.querySelector(`#${id}`)?.remove();
  }

  function escapeHtml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>');
  }

  function formatText(raw) {
    // Escapa HTML antes de processar markdown
    const lines = raw.split('\n');
    const out   = [];
    let inList  = false;

    for (const line of lines) {
      const esc = line
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

      // Títulos ## e ###
      if (/^###\s+(.+)/.test(esc)) {
        if (inList) { out.push('</ul>'); inList = false; }
        out.push(`<p class="text-xs font-semibold text-zinc-500 uppercase tracking-wider mt-3 mb-1">${esc.replace(/^###\s+/, '')}</p>`);
      } else if (/^##\s+(.+)/.test(esc)) {
        if (inList) { out.push('</ul>'); inList = false; }
        out.push(`<p class="text-sm font-bold text-zinc-800 mt-4 mb-1.5 border-b border-zinc-200 pb-1">${esc.replace(/^##\s+/, '')}</p>`);
      // Itens de lista -
      } else if (/^-\s+(.+)/.test(esc)) {
        if (!inList) { out.push('<ul class="list-none space-y-1 my-1">'); inList = true; }
        const content = esc.replace(/^-\s+/, '').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>');
        out.push(`<li class="flex gap-2 text-zinc-700"><span class="text-emerald-500 shrink-0">▸</span><span>${content}</span></li>`);
      // Linha vazia
      } else if (esc.trim() === '') {
        if (inList) { out.push('</ul>'); inList = false; }
        out.push('<div class="h-1.5"></div>');
      // Texto normal
      } else {
        if (inList) { out.push('</ul>'); inList = false; }
        const content = esc.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>');
        out.push(`<p class="text-zinc-700">${content}</p>`);
      }
    }

    if (inList) out.push('</ul>');
    return out.join('');
  }

  // ─── Init ──────────────────────────────────────────────────────────────────
  checkStatus();
}
