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

window.__runCourseMapper = runCourseMapper;

// ─── Painel lateral ───────────────────────────────────────────────────────────

function openConceptPanel(concept) {
    const panel = document.getElementById('concept-panel');
    const panelBody = document.getElementById('concept-panel-body');
    const panelTitle = document.getElementById('panel-title');
    const overlay = document.getElementById('panel-overlay');

    if (!panel || !panelBody) return;

    panelTitle && (panelTitle.textContent = concept.name);
    renderConceptDetail(panelBody, concept);
    panel.classList.remove('translate-x-full');
    overlay?.classList.remove('hidden');

    if (window.lucide) window.lucide.createIcons({ nodes: panel.querySelectorAll('[data-lucide]') });
}

function closeConceptPanel() {
    document.getElementById('concept-panel')?.classList.add('translate-x-full');
    document.getElementById('panel-overlay')?.classList.add('hidden');
}

// ─── Roteador principal ───────────────────────────────────────────────────────

function renderApp(state) {
    const loadingScreen = document.getElementById('loading-screen');
    const appContainer  = document.getElementById('app-container');
    const mainHeader    = document.getElementById('main-header');
    const viewContainer = document.getElementById('view-container');
    const backBtn       = document.getElementById('header-back-btn');

    if (state.loading) {
        loadingScreen.style.display = 'flex';
        appContainer.style.display  = 'none';
        return;
    } else {
        loadingScreen.style.display = 'none';
        appContainer.style.display  = 'flex';
        mainHeader.style.display    = 'flex';
    }

    // ── Modo tela cheia (conceptPanelOpen === false) ──
    const isFullPage = state.selectedConceptId && state.conceptPanelOpen === false;

    if (isFullPage) {
        closeConceptPanel();

        backBtn.style.display = 'block';
        backBtn.onclick = () => store.setState({ selectedConceptId: null, conceptPanelOpen: true });

        const currentViewType = viewContainer.getAttribute('data-view');
        if (currentViewType !== 'concept-detail') {
            viewContainer.innerHTML = '';
            viewContainer.setAttribute('data-view', 'concept-detail');
        }

        const concept = state.concepts.find(c => c.id === state.selectedConceptId);
        if (concept) renderConceptDetail(viewContainer, concept);
        return;
    }

    // ── Modo normal + painel ──
    backBtn.style.display = 'none';
    backBtn.onclick = null;

    const currentViewType = viewContainer.getAttribute('data-view');
    const targetViewType  = state.currentPage;

    if (currentViewType !== targetViewType) {
        viewContainer.innerHTML = '';
        viewContainer.setAttribute('data-view', targetViewType);
    }

    switch (state.currentPage) {
        case 'dashboard':
            if (currentViewType !== 'dashboard') {
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

    // ── Abre/fecha painel lateral ──
    if (state.selectedConceptId) {
        const concept = state.concepts.find(c => c.id === state.selectedConceptId);
        if (concept) openConceptPanel(concept);
    } else {
        closeConceptPanel();
    }
}

// ─── Inicialização ────────────────────────────────────────────────────────────

let isAppInitialized = false;
store.subscribe((state) => {
    if (!isAppInitialized) {
        initSidebar();
        isAppInitialized = true;
    }
    renderApp(state);
});

document.addEventListener('DOMContentLoaded', () => {
    initializeEngine();

    // Logo → home
    document.getElementById('header-brand')?.addEventListener('click', () => {
        store.setState({ selectedConceptId: null });
    });

    // Fechar painel
    document.getElementById('panel-close-btn')?.addEventListener('click', () => {
        store.setState({ selectedConceptId: null });
    });

    // Abrir tela cheia
    document.getElementById('panel-fullpage-btn')?.addEventListener('click', () => {
        store.setState({ conceptPanelOpen: false });
    });

    // Overlay fecha painel no mobile
    document.getElementById('panel-overlay')?.addEventListener('click', () => {
        store.setState({ selectedConceptId: null });
    });
});
