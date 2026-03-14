// js/sidebar.js
import { store } from './state.js';

export function initSidebar() {
  const sidebarContainer = document.getElementById('sidebar-container');

  sidebarContainer.innerHTML = `
    <div id="sidebar-ui" class="fixed md:static inset-y-0 left-0 z-50 w-60 bg-white border-r border-zinc-200 transform transition-transform duration-200 ease-out flex flex-col -translate-x-full md:translate-x-0">
      
      <div class="px-5 py-4 border-b border-zinc-100 flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 bg-zinc-900 rounded-lg flex items-center justify-center">
            <i data-lucide="brain-circuit" class="w-4.5 h-4.5 text-white"></i>
          </div>
          <div>
            <h1 class="text-sm font-bold text-zinc-900 tracking-tight leading-none">Motor Brooks</h1>
            <span class="text-[10px] text-zinc-400 font-medium tracking-wider uppercase">Study System</span>
          </div>
        </div>
        <button id="close-sidebar-btn" class="md:hidden p-1.5 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-md transition-colors">
          <i data-lucide="x" class="w-4 h-4"></i>
        </button>
      </div>

      <div class="flex-1 overflow-y-auto py-3">
        <nav class="space-y-0.5 px-3" id="sidebar-nav"></nav>
      </div>
    </div>
  `;

  if (window.lucide) window.lucide.createIcons();

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

  store.subscribe((state) => {
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

  renderNavItems(store.getState().currentPage);
}

const navItems = [
  { id: 'dashboard',     label: 'Dashboard',        icon: 'layout-dashboard' },
  { id: 'roadmap',       label: 'Trilha de Estudo',  icon: 'target' },
  { id: 'concepts',      label: 'Conceitos',         icon: 'library' },
  { id: 'notes',         label: 'Notas',             icon: 'notebook-pen' },
  { id: 'graph',         label: 'Grafo',             icon: 'network' },
  { id: 'decision-tree', label: 'Árvore de Decisão', icon: 'git-merge' },
  { id: 'sessions',      label: 'Sessões',           icon: 'calendar-days' },
  { id: 'chat',          label: 'Chat Al Brooks IA', icon: 'bot' },
];

function renderNavItems(currentPage) {
  const navContainer = document.getElementById('sidebar-nav');
  if (!navContainer) return;

  navContainer.innerHTML = navItems.map(item => {
    const isActive = currentPage === item.id;
    const baseClasses = "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-150 group";
    const activeClasses = isActive
      ? "bg-zinc-100 text-zinc-900"
      : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800";

    const iconColor = isActive ? "text-zinc-900" : "text-zinc-400 group-hover:text-zinc-600";

    return `
      <button data-page-id="${item.id}" class="${baseClasses} ${activeClasses}">
        <i data-lucide="${item.icon}" class="w-4 h-4 transition-colors ${iconColor}"></i>
        ${item.label}
      </button>
    `;
  }).join('');

  if (window.lucide) window.lucide.createIcons();

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
