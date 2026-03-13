// js/app.js
import { store } from './state.js';
import { initializeEngine } from './engine.js';
import { initSidebar } from './sidebar.js';

import { renderDashboard } from './dashboard.js';
import { renderRoadmap } from './roadmap.js';
import { renderConceptList } from './concept-list.js';
import { renderSessions } from './sessions.js';
import { renderConceptDetail } from './concept-detail.js';
import { renderDecisionTree } from './decision-tree.js';
import { renderNotes } from './notes.js';
import { renderGraph } from './graph.js';
import { runCourseMapper } from './course-mapper.js';

// Expõe mapper para uso pontual no DevTools Console
window.__runCourseMapper = runCourseMapper;

function renderApp(state) {
    const loadingScreen = document.getElementById('loading-screen');
    const appContainer = document.getElementById('app-container');
    const mainHeader = document.getElementById('main-header');
    const viewContainer = document.getElementById('view-container');
    const backBtn = document.getElementById('header-back-btn');

    if (state.loading) {
        loadingScreen.style.display = 'flex';
        appContainer.style.display = 'none';
        return;
    } else {
        loadingScreen.style.display = 'none';
        appContainer.style.display = 'flex';
        mainHeader.style.display = 'flex';
    }

    // Lida com botão voltar do header
    if (state.selectedConceptId) {
        backBtn.style.display = 'block';
        backBtn.onclick = () => store.setState({ selectedConceptId: null });
    } else {
        backBtn.style.display = 'none';
        backBtn.onclick = null;
    }

    // Roteamento Basico
    const currentViewType = viewContainer.getAttribute('data-view');
    const targetViewType = state.selectedConceptId ? 'concept-detail' : state.currentPage;

    if (currentViewType !== targetViewType) {
        viewContainer.innerHTML = ''; // Limpa a view atual apenas se mudou de página
        viewContainer.setAttribute('data-view', targetViewType);
    }

    if (state.selectedConceptId) {
        const concept = state.concepts.find(c => c.id === state.selectedConceptId);
        if (concept) renderConceptDetail(viewContainer, concept);
    } else {
        switch (state.currentPage) {
            case 'dashboard':
                if (currentViewType !== 'dashboard') {
                    // renderDashboard é async (busca Edge Functions) — skeleton imediato só na primeira renderização
                    viewContainer.innerHTML = `<div class="p-8 flex items-center justify-center h-64">
                        <div class="flex flex-col items-center gap-3 text-emerald-500">
                            <i data-lucide="loader-2" class="w-8 h-8 animate-spin"></i>
                            <p class="text-zinc-500 text-sm">Carregando plano inteligente...</p>
                        </div>
                    </div>`;
                    if (window.lucide) window.lucide.createIcons();
                }
                renderDashboard(viewContainer, state);
                break;
            case 'roadmap':
                renderRoadmap(viewContainer, state);
                break;
            case 'concepts':
                renderConceptList(viewContainer, state);
                break;
            case 'sessions':
                renderSessions(viewContainer, state);
                break;
            case 'decision-tree':
                renderDecisionTree(viewContainer, state);
                break;
            case 'notes':
                if (currentViewType !== 'notes') {
                    renderNotes(viewContainer);
                }
                break;
            case 'graph':
                if (currentViewType !== 'graph') {
                    renderGraph(viewContainer, state);
                }
                break;
            default:
                viewContainer.innerHTML = `<div class="p-6 text-zinc-500">Página não encontrada.</div>`;
        }
    }
}

// Inicializa a escuta de mudanças de estado
let isAppInitialized = false;
store.subscribe((state) => {
    // Only init the hard DOM HTML once
    if (!isAppInitialized) {
        initSidebar();
        isAppInitialized = true;
    }
    renderApp(state);
});

// Dá o boot na engine principal (carrega CSV, LocalStorage)
document.addEventListener('DOMContentLoaded', () => {
    initializeEngine();

    // Header home logo click
    document.getElementById('header-brand').addEventListener('click', () => {
        store.setState({ selectedConceptId: null });
    });
});
