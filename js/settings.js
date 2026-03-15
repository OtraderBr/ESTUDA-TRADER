// js/settings.js
// Página de configurações da IA — permite definir um prompt base personalizado
// O prompt é salvo em localStorage e enviado a cada requisição do chat.

const STORAGE_KEY = 'chat_custom_preamble';

export function getCustomPreamble() {
  return localStorage.getItem(STORAGE_KEY) || '';
}

export function renderSettings(container) {
  const saved = localStorage.getItem(STORAGE_KEY) || '';

  container.innerHTML = `
    <div class="max-w-2xl mx-auto px-5 py-8">

      <!-- Header -->
      <div class="mb-8">
        <div class="flex items-center gap-3 mb-2">
          <span class="w-8 h-8 bg-zinc-900 rounded-lg flex items-center justify-center shrink-0">
            <i data-lucide="settings-2" class="w-4 h-4 text-white"></i>
          </span>
          <h1 class="text-xl font-bold text-zinc-900">Configurações da IA</h1>
        </div>
        <p class="text-sm text-zinc-500 ml-11">Personalize o comportamento do Professor Brooks no chat</p>
      </div>

      <!-- Prompt Card -->
      <div class="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm mb-4">
        <div class="flex items-start justify-between mb-4">
          <div class="flex-1 pr-4">
            <h2 class="text-sm font-semibold text-zinc-800 flex items-center gap-2 mb-1">
              <i data-lucide="scroll-text" class="w-4 h-4 text-emerald-500 shrink-0"></i>
              Prompt Base Personalizado
            </h2>
            <p class="text-xs text-zinc-400 leading-relaxed">
              Instruções adicionais enviadas à IA em <strong class="text-zinc-500">todas</strong> as conversas do chat.
              Use para definir foco, tom ou comportamento específico.
            </p>
          </div>
          <span id="prompt-status"
            class="text-[10px] font-semibold px-2.5 py-1 rounded-full shrink-0
                   ${saved
                     ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                     : 'bg-zinc-50 text-zinc-400 border border-zinc-200'}">
            ${saved ? 'Ativo' : 'Padrão'}
          </span>
        </div>

        <textarea id="preamble-input"
          rows="9"
          placeholder="Exemplos de instruções:
• Sempre foque em como identificar o padrão no gráfico
• Priorize exemplos práticos com contexto de mercado atual
• Após explicar o conceito, mencione sempre a relação risco/retorno
• Explique como isso se aplica ao mini índice e mini dólar (B3)
• Use linguagem simples, sem jargões desnecessários"
          class="w-full resize-none bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3
                 text-sm text-zinc-800 placeholder:text-zinc-400
                 focus:outline-none focus:bg-white focus:border-zinc-400 focus:ring-2 focus:ring-zinc-100
                 transition-all leading-relaxed">${saved}</textarea>

        <div class="flex items-center justify-between mt-3 pt-3 border-t border-zinc-100">
          <button id="reset-prompt-btn"
            class="text-xs text-zinc-400 hover:text-red-500 transition-colors flex items-center gap-1.5 py-1">
            <i data-lucide="trash-2" class="w-3 h-3"></i>
            Restaurar padrão
          </button>
          <button id="save-prompt-btn"
            class="px-5 py-2 bg-zinc-900 hover:bg-zinc-700 text-white text-xs font-semibold rounded-xl
                   transition-colors flex items-center gap-2">
            <i data-lucide="save" class="w-3.5 h-3.5"></i>
            Salvar
          </button>
        </div>
      </div>

      <!-- Info Card -->
      <div class="bg-blue-50 border border-blue-100 rounded-2xl p-4 mb-4">
        <div class="flex gap-3 items-start">
          <i data-lucide="info" class="w-4 h-4 text-blue-500 shrink-0 mt-0.5"></i>
          <div>
            <p class="text-xs font-semibold text-blue-800 mb-1">Como funciona</p>
            <p class="text-xs text-blue-700 leading-relaxed">
              Seu prompt é combinado com o prompt padrão do Professor Brooks. A IA sempre consulta os materiais do curso via busca semântica (RAG) antes de responder, mas aplica suas instruções sobre o resultado.
            </p>
          </div>
        </div>
      </div>

      <!-- API Card -->
      <div class="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
        <h2 class="text-sm font-semibold text-zinc-800 flex items-center gap-2 mb-3">
          <i data-lucide="cpu" class="w-4 h-4 text-violet-500 shrink-0"></i>
          Modelo de IA Configurado
        </h2>
        <div class="flex items-center justify-between py-2 border-b border-zinc-50">
          <span class="text-xs text-zinc-500">Provedor</span>
          <span class="text-xs font-semibold text-zinc-800">Cohere</span>
        </div>
        <div class="flex items-center justify-between py-2 border-b border-zinc-50">
          <span class="text-xs text-zinc-500">Modelo de chat</span>
          <span class="text-xs font-mono text-zinc-700">command-r</span>
        </div>
        <div class="flex items-center justify-between py-2 border-b border-zinc-50">
          <span class="text-xs text-zinc-500">Modelo de embeddings</span>
          <span class="text-xs font-mono text-zinc-700">embed-multilingual-v3.0</span>
        </div>
        <div class="flex items-center justify-between py-2">
          <span class="text-xs text-zinc-500">Dimensões do vetor</span>
          <span class="text-xs font-mono text-zinc-700">1024</span>
        </div>
      </div>

    </div>

    <!-- Toast -->
    <div id="settings-toast"
      class="hidden fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2
             bg-zinc-900 text-white text-xs px-4 py-2.5 rounded-xl shadow-lg z-50
             flex items-center gap-2 whitespace-nowrap">
      <i data-lucide="check-circle" class="w-3.5 h-3.5 text-emerald-400"></i>
      Configurações salvas com sucesso!
    </div>`;

  if (window.lucide) window.lucide.createIcons();

  const preambleInput = document.getElementById('preamble-input');
  const saveBtn       = document.getElementById('save-prompt-btn');
  const resetBtn      = document.getElementById('reset-prompt-btn');
  const statusBadge   = document.getElementById('prompt-status');
  const toast         = document.getElementById('settings-toast');

  function showToast() {
    toast.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons({ nodes: [toast] });
    setTimeout(() => toast.classList.add('hidden'), 2500);
  }

  function updateStatus(hasContent) {
    if (hasContent) {
      statusBadge.className = 'text-[10px] font-semibold px-2.5 py-1 rounded-full shrink-0 bg-emerald-50 text-emerald-600 border border-emerald-200';
      statusBadge.textContent = 'Ativo';
    } else {
      statusBadge.className = 'text-[10px] font-semibold px-2.5 py-1 rounded-full shrink-0 bg-zinc-50 text-zinc-400 border border-zinc-200';
      statusBadge.textContent = 'Padrão';
    }
  }

  saveBtn.addEventListener('click', () => {
    const value = preambleInput.value.trim();
    if (value) {
      localStorage.setItem(STORAGE_KEY, value);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
    updateStatus(!!value);
    showToast();
  });

  resetBtn.addEventListener('click', () => {
    preambleInput.value = '';
    localStorage.removeItem(STORAGE_KEY);
    updateStatus(false);
  });
}
