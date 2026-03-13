// js/sidebar.js
import { store } from './state.js';

export function initSidebar() {
  const sidebarContainer = document.getElementById('sidebar-container');

  // Renderiza HTML inicial
  sidebarContainer.innerHTML = `
    <!-- Sidebar -->
    <div id="sidebar-ui" class="fixed md:static inset-y-0 left-0 z-50 w-72 bg-zinc-50/95 backdrop-blur-md border-r border-zinc-200/50 transform transition-transform duration-300 ease-in-out flex flex-col shadow-2xl md:shadow-none -translate-x-full md:translate-x-0">
      
      <div class="p-6 border-b border-zinc-200/50 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <i data-lucide="brain-circuit" class="w-6 h-6 text-zinc-950"></i>
          </div>
          <div>
            <h1 class="text-xl font-bold text-zinc-900 tracking-tight leading-none">Motor Brooks</h1>
            <span class="text-xs text-emerald-500 font-medium tracking-wider uppercase mt-1 block">Study System</span>
          </div>
        </div>
        <button id="close-sidebar-btn" class="md:hidden p-2 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors">
          <i data-lucide="chevron-left" class="w-6 h-6"></i>
        </button>
      </div>

      <div class="flex-1 overflow-y-auto py-6">
        <div class="px-4 mb-2">
          <h2 class="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3 px-2">Menu Principal</h2>
        </div>
        <nav class="space-y-1.5 px-4" id="sidebar-nav">
          <!-- Injetado dinamicamente -->
        </nav>
      </div>
      
      <div class="p-6 border-t border-zinc-200/50">
        <div class="bg-white rounded-xl p-4 border border-zinc-200">
          <div class="flex items-center gap-3 mb-2">
            <div class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
            <span class="text-sm font-medium text-zinc-700">Sistema Ativo</span>
          </div>
          <p class="text-xs text-zinc-500 leading-relaxed">
            Seu motor de estudos está otimizado e pronto para a próxima sessão.
          </p>
        </div>
      </div>
    </div>
  `;

  // Re-inicializa ícones lucide se carregados
  if (window.lucide) {
    window.lucide.createIcons();
  }

  // Bind Eventos do mobile
  const sidebarEl = document.getElementById('sidebar-ui');
  const overlayEl = document.getElementById('mobile-overlay');
  const closeBtn = document.getElementById('close-sidebar-btn');
  const menuBtn = document.getElementById('mobile-menu-btn');

  function toggleSidebar(open) {
    store.setState({ sidebarOpen: open });
  }

  closeBtn.addEventListener('click', () => toggleSidebar(false));
  overlayEl.addEventListener('click', () => toggleSidebar(false));
  menuBtn.addEventListener('click', () => toggleSidebar(true));

  // Escuta as mudanças de estado
  store.subscribe((state) => {
    // Atualiza classes do mobile
    if (state.sidebarOpen) {
      sidebarEl.classList.remove('-translate-x-full');
      sidebarEl.classList.add('translate-x-0');
      overlayEl.classList.remove('hidden');
    } else {
      sidebarEl.classList.add('-translate-x-full');
      sidebarEl.classList.remove('translate-x-0');
      overlayEl.classList.add('hidden');
    }

    renderNavItems(state.currentPage);
  });

  // Render nav items immediately on first load
  renderNavItems(store.getState().currentPage);
}

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: 'layout-dashboard' },
  { id: 'roadmap', label: 'Trilha de Estudo', icon: 'target' },
  { id: 'concepts', label: 'Gestão de Conceitos', icon: 'library' },
  { id: 'sessions', label: 'Sessões de Estudo', icon: 'calendar-days' },
];

function renderNavItems(currentPage) {
  const navContainer = document.getElementById('sidebar-nav');
  if (!navContainer) return;

  navContainer.innerHTML = navItems.map(item => {
    const isActive = currentPage === item.id;
    const baseClasses = "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 group";
    const activeClasses = isActive
      ? "bg-emerald-600/10 text-emerald-600 shadow-sm border border-emerald-600/20"
      : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 border border-transparent";

    const iconColor = isActive ? "text-emerald-600" : "text-zinc-500 group-hover:text-zinc-700";

    return `
      <button data-page-id="${item.id}" class="${baseClasses} ${activeClasses}">
        <i data-lucide="${item.icon}" class="w-5 h-5 transition-colors ${iconColor}"></i>
        ${item.label}
      </button>
    `;
  }).join('');

  if (window.lucide) window.lucide.createIcons();

  // Attach events
  navContainer.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const pageId = e.currentTarget.getAttribute('data-page-id');
      store.setState({ currentPage: pageId, selectedConceptId: null });
      if (window.innerWidth < 768) {
        store.setState({ sidebarOpen: false });
      }
    });
  });
}
