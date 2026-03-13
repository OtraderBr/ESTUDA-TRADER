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
    viewContainer.innerHTML = ''; // Limpa a view atual

    if (state.selectedConceptId) {
        const concept = state.concepts.find(c => c.id === state.selectedConceptId);
        if (concept) renderConceptDetail(viewContainer, concept);
    } else {
        switch (state.currentPage) {
            case 'dashboard':
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
