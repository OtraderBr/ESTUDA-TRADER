// js/sidebar.js
import { store } from './state.js';

const NAV_ITEMS = [
  { id: 'dashboard',     label: 'Início',           icon: 'layout-dashboard'  },
  { id: 'chat',          label: 'Pergunte à IA',    icon: 'bot-message-square'},
  { id: 'course-search', label: 'Buscar Aulas',     icon: 'library-big'       },
  { id: 'roadmap',       label: 'Trilha de Estudo', icon: 'target'            },
  { id: 'concepts',      label: 'Conceitos',        icon: 'library'           },
  { id: 'notes',         label: 'Notas',            icon: 'notebook-pen'      },
  { id: 'graph',         label: 'Grafo',            icon: 'network'           },
  { id: 'decision-tree', label: 'Árvore de Decisão',icon: 'git-merge'         },
  { id: 'sessions',      label: 'Sessões',          icon: 'calendar-days'     },
  { id: 'settings',     label: 'Configurações',    icon: 'settings-2'        },
];

// ── Itens exibidos no bottom nav mobile (máx 5) ────────────────────────────
const BOTTOM_NAV = [
  { id: 'dashboard',     label: 'Início',    icon: 'layout-dashboard'   },
  { id: 'chat',          label: 'IA',        icon: 'bot-message-square' },
  { id: 'course-search', label: 'Aulas',     icon: 'library-big'        },
  { id: 'concepts',      label: 'Conceitos', icon: 'library'            },
  { id: '__menu__',      label: 'Menu',      icon: 'menu'               },
];

export function initSidebar() {
  const sidebarContainer = document.getElementById('sidebar-container');

  // ── Sidebar desktop / drawer mobile ────────────────────────────────────────
  sidebarContainer.innerHTML = `
    <aside id="sidebar-ui"
      class="fixed md:static inset-y-0 left-0 z-50 w-56 flex flex-col
             bg-[#111827] transform transition-transform duration-200 ease-out
             -translate-x-full md:translate-x-0 shrink-0">

      <!-- Logo -->
      <div class="flex items-center justify-between px-4 py-4 border-b border-white/10 shrink-0">
        <div class="flex items-center gap-2.5">
          <div class="w-7 h-7 bg-emerald-500 rounded-lg flex items-center justify-center shrink-0">
            <i data-lucide="brain-circuit" class="w-4 h-4 text-white"></i>
          </div>
          <div>
            <div class="text-[13px] font-bold text-white leading-none tracking-tight">Motor Brooks</div>
            <div class="text-[9px] text-white/40 uppercase tracking-widest mt-0.5">Study System</div>
          </div>
        </div>
        <button id="close-sidebar-btn"
          class="md:hidden p-1.5 text-white/40 hover:text-white hover:bg-white/10 rounded-md transition-colors">
          <i data-lucide="x" class="w-4 h-4"></i>
        </button>
      </div>

      <!-- Nav -->
      <nav id="sidebar-nav" class="flex-1 overflow-y-auto py-3 px-3 space-y-0.5"></nav>

      <!-- Footer -->
      <div class="px-4 py-3 border-t border-white/10 shrink-0">
        <div class="text-[10px] text-white/25 font-medium">Al Brooks · Price Action</div>
      </div>
    </aside>`;

  if (window.lucide) window.lucide.createIcons();

  // ── Bottom nav mobile ──────────────────────────────────────────────────────
  const bottomNav = document.getElementById('mobile-bottom-nav');

  // ── Refs ───────────────────────────────────────────────────────────────────
  const sidebarEl = document.getElementById('sidebar-ui');
  const overlayEl = document.getElementById('mobile-overlay');
  const closeBtn  = document.getElementById('close-sidebar-btn');
  const menuBtn   = document.getElementById('mobile-menu-btn');

  function toggleSidebar(open) { store.setState({ sidebarOpen: open }); }

  closeBtn?.addEventListener('click', () => toggleSidebar(false));
  overlayEl?.addEventListener('click', () => toggleSidebar(false));
  menuBtn?.addEventListener('click',   () => toggleSidebar(true));

  store.subscribe(state => {
    // Sidebar drawer
    if (state.sidebarOpen) {
      sidebarEl.classList.remove('-translate-x-full');
      sidebarEl.classList.add('translate-x-0');
      overlayEl?.classList.remove('hidden');
    } else {
      sidebarEl.classList.add('-translate-x-full');
      sidebarEl.classList.remove('translate-x-0');
      overlayEl?.classList.add('hidden');
    }

    renderNavItems(state.currentPage);
    renderBottomNav(state.currentPage);
  });

  renderNavItems(store.getState().currentPage);
  renderBottomNav(store.getState().currentPage);
}

// ── Sidebar nav ────────────────────────────────────────────────────────────
function renderNavItems(currentPage) {
  const nav = document.getElementById('sidebar-nav');
  if (!nav) return;

  nav.innerHTML = NAV_ITEMS.map(item => {
    const active = currentPage === item.id;
    return `
      <button data-page-id="${item.id}"
        class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-100
               ${active
                 ? 'bg-white/12 text-white'
                 : 'text-white/50 hover:bg-white/8 hover:text-white/85'}">
        <i data-lucide="${item.icon}"
           class="w-4 h-4 shrink-0 transition-colors ${active ? 'text-emerald-400' : 'text-white/35'}"></i>
        ${item.label}
        ${active ? '<span class="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0"></span>' : ''}
      </button>`;
  }).join('');

  if (window.lucide) window.lucide.createIcons();

  nav.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', e => {
      const id = e.currentTarget.getAttribute('data-page-id');
      store.setState({ currentPage: id, selectedConceptId: null });
      if (window.innerWidth < 768) store.setState({ sidebarOpen: false });
    });
  });
}

// ── Bottom nav mobile ──────────────────────────────────────────────────────
function renderBottomNav(currentPage) {
  const nav = document.getElementById('mobile-bottom-nav');
  if (!nav) return;

  nav.innerHTML = BOTTOM_NAV.map(item => {
    const isMenu   = item.id === '__menu__';
    const active   = !isMenu && currentPage === item.id;
    const iconCol  = active ? 'text-emerald-600' : 'text-zinc-400';
    const labelCol = active ? 'text-emerald-600 font-semibold' : 'text-zinc-400';

    return `
      <button data-bnav-id="${item.id}"
        class="flex flex-col items-center justify-center gap-0.5 py-2 px-1 w-full transition-colors active:bg-zinc-50">
        <i data-lucide="${item.icon}" class="w-5 h-5 ${iconCol} transition-colors"></i>
        <span class="text-[10px] ${labelCol} transition-colors truncate">${item.label}</span>
      </button>`;
  }).join('');

  if (window.lucide) window.lucide.createIcons();

  nav.querySelectorAll('[data-bnav-id]').forEach(btn => {
    btn.addEventListener('click', e => {
      const id = e.currentTarget.getAttribute('data-bnav-id');
      if (id === '__menu__') {
        store.setState({ sidebarOpen: true });
      } else {
        store.setState({ currentPage: id, selectedConceptId: null });
      }
    });
  });
}
