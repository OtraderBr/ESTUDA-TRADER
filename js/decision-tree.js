// js/decision-tree.js
import { store } from './state.js';

let treeData = null;
let navigationHistory = []; // Stack de IDs dos nós navegados
let isLoading = false;
let loadError = null;

async function fetchTreeData() {
    try {
        isLoading = true;
        const response = await fetch('data/decision_tree.json');
        if (!response.ok) throw new Error('Não foi possível carregar a Árvore de Decisão.');
        const data = await response.json();
        treeData = data;
        navigationHistory = [data.rootNode];
        isLoading = false;
    } catch (e) {
        isLoading = false;
        loadError = e.message;
        console.error("Decision Tree Error:", e);
    }
}

export async function renderDecisionTree(container, state) {
    if (!treeData && !isLoading && !loadError) {
        // Mostra loading inicial e busca dados
        container.innerHTML = `
            <div class="h-full flex items-center justify-center bg-zinc-50">
                <div class="flex flex-col items-center gap-4">
                    <i data-lucide="loader-2" class="w-10 h-10 text-emerald-500 animate-spin"></i>
                    <p class="text-zinc-500 font-medium">Carregando o Cérebro Operacional...</p>
                </div>
            </div>
        `;
        if (window.lucide) window.lucide.createIcons();
        await fetchTreeData();
        renderDecisionTree(container, state); // Chama novamente após fetch
        return;
    }

    if (loadError) {
        container.innerHTML = `
            <div class="h-full flex items-center justify-center p-8 bg-zinc-50">
                <div class="bg-red-50 text-red-600 p-8 rounded-2xl max-w-lg text-center border border-red-200">
                    <i data-lucide="alert-triangle" class="w-12 h-12 mx-auto mb-4 opacity-80"></i>
                    <h2 class="text-xl font-bold mb-2">Erro ao carregar o Mapa Mental</h2>
                    <p class="text-red-600/80 mb-6">${loadError}</p>
                    <button id="retryTreeBtn" class="bg-red-600 hover:bg-red-700 text-white px-6 py-2.5 rounded-lg font-bold transition-colors">Tentar Novamente</button>
                </div>
            </div>
        `;
        if (window.lucide) window.lucide.createIcons();
        document.getElementById('retryTreeBtn')?.addEventListener('click', () => {
            loadError = null;
            renderDecisionTree(container, state);
        });
        return;
    }

    if (!treeData) return; // Segurança

    const currentNodeId = navigationHistory[navigationHistory.length - 1];
    const currentNode = treeData.nodes[currentNodeId];

    if (!currentNode) {
        container.innerHTML = `<div class="p-8 text-center text-red-500">Nó não encontrado: ${currentNodeId}</div>`;
        return;
    }

    const { 
        title, description, type, children, question, options, 
        instruction, characteristics, identification, actions, setups, setup,
        regra, regras, probability, warning, note, next, action
    } = currentNode;

    // ----- BREADCRUMBS / NAVIGATION BAR -----
    const canGoBack = navigationHistory.length > 1;

    container.innerHTML = `
        <div class="h-full flex flex-col bg-zinc-50 overflow-hidden" id="tree-container">
            
            <!-- Header Nav -->
            <div class="bg-white border-b border-zinc-200 px-6 py-4 flex items-center justify-between shrink-0 shadow-sm z-10">
                <div class="flex items-center gap-4">
                    <button id="backNodeBtn" class="p-2 hover:bg-zinc-100 text-zinc-600 rounded-lg transition-colors ${!canGoBack ? 'opacity-30 cursor-not-allowed' : ''}" ${!canGoBack ? 'disabled' : ''}>
                        <i data-lucide="arrow-left" class="w-5 h-5"></i>
                    </button>
                    <div>
                        <h2 class="text-xs font-bold text-zinc-400 uppercase tracking-widest">
                            ${treeData.metadata?.title || 'Guia Operacional'}
                        </h2>
                        <div class="text-sm font-semibold text-zinc-800 flex items-center gap-2 mt-0.5">
                            Passo ${navigationHistory.length}
                        </div>
                    </div>
                </div>
                <button id="resetTreeBtn" class="flex items-center gap-2 text-sm font-bold text-zinc-500 hover:text-zinc-900 bg-zinc-100 hover:bg-zinc-200 px-4 py-2 rounded-lg transition-all hidden md:flex">
                    <i data-lucide="rotate-ccw" class="w-4 h-4"></i> Recomeçar
                </button>
            </div>

            <!-- Content Area -->
            <div class="flex-1 overflow-y-auto p-4 md:p-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div class="max-w-4xl mx-auto w-full">
                    
                    <!-- Titulo e Descricao do Nó -->
                    <div class="bg-white rounded-[2rem] border border-zinc-200 shadow-sm p-8 md:p-10 mb-6 relative overflow-hidden">
                        ${warning ? `<div class="absolute top-0 right-0 w-32 h-32 bg-red-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>` : ''}
                        
                        <div class="inline-flex items-center gap-2 px-3 py-1 bg-zinc-100 text-zinc-600 rounded-lg text-xs font-bold uppercase tracking-wider mb-4 border border-zinc-200">
                            ${type === 'decision' ? '<i data-lucide="git-branch" class="w-3.5 h-3.5 text-blue-500"></i> Decisão' : type === 'sequence' ? '<i data-lucide="align-left" class="w-3.5 h-3.5 text-emerald-500"></i> Sequência' : '<i data-lucide="info" class="w-3.5 h-3.5 text-amber-500"></i> Informação Final'}
                        </div>
                        
                        <h1 class="text-3xl md:text-4xl font-bold text-zinc-900 leading-tight mb-4 tracking-tight">
                            ${title}
                        </h1>
                        
                        ${description ? `<p class="text-lg text-zinc-500 leading-relaxed mb-6">${description}</p>` : ''}
                        
                        ${warning ? `
                            <div class="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-xl mb-6">
                                <div class="flex gap-3">
                                    <i data-lucide="alert-triangle" class="w-5 h-5 text-red-600 shrink-0 mt-0.5"></i>
                                    <div>
                                        <h4 class="text-sm font-bold text-red-800">CUIDADO</h4>
                                        <p class="text-sm text-red-700 mt-1">${warning}</p>
                                    </div>
                                </div>
                            </div>
                        ` : ''}
                        
                        <!-- RENDERIZAÇÃO ESPECÍFICA POR TIPO -->
                        ${renderNodeSpecifics(currentNode)}

                    </div>
                </div>
            </div>
            
            <div class="md:hidden border-t border-zinc-200 bg-white p-4 shrink-0 flex justify-center">
                 <button id="resetTreeBtnMobile" class="w-full flex justify-center items-center gap-2 text-sm font-bold text-zinc-500 bg-zinc-100 px-4 py-3 rounded-xl">
                    <i data-lucide="rotate-ccw" class="w-4 h-4"></i> Recomeçar Análise
                </button>
            </div>
        </div>
    `;

    if (window.lucide) window.lucide.createIcons();

    // Event Listeners
    container.querySelector('#backNodeBtn')?.addEventListener('click', () => {
        if (navigationHistory.length > 1) {
            navigationHistory.pop();
            renderDecisionTree(container, state);
        }
    });

    const resetTrees = () => {
        navigationHistory = [treeData.rootNode];
        renderDecisionTree(container, state);
    };
    container.querySelector('#resetTreeBtn')?.addEventListener('click', resetTrees);
    container.querySelector('#resetTreeBtnMobile')?.addEventListener('click', resetTrees);

    // Botoes de Navegação Dinâmicos (Choices / Next)
    container.querySelectorAll('.tree-nav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const targetId = e.currentTarget.getAttribute('data-next');
            if (targetId && treeData.nodes[targetId]) {
                navigationHistory.push(targetId);
                renderDecisionTree(container, state);
            } else if (targetId) {
                alert(`Nó destino "${targetId}" não existe!`);
            }
        });
    });
}

// ---- Função auxiliar para renderizar os miolos do Nó dependendo do formato ----
function renderNodeSpecifics(node) {
    let html = '';

    // Renderizar informações utilitárias comuns a qualquer nó (characteristics, regras, actions...)
    html += renderInfoBlocks(node);

    // Regras de fluxos de acordo com o Tipo
    if (node.type === 'decision') {
        html += `
            <div class="mt-8 border-t border-zinc-100 pt-8">
                <h3 class="text-xl font-bold text-zinc-800 mb-6 flex items-center gap-3">
                   <div class="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                      <i data-lucide="help-circle" class="w-5 h-5"></i>
                   </div>
                   ${node.question || node.instruction || 'Como você avalia o cenário atual?'}
                </h3>
                <div class="flex flex-col gap-3">
                    ${node.options.map((opt, idx) => `
                        <button class="tree-nav-btn w-full p-4 md:p-5 rounded-2xl border-2 border-zinc-200 bg-white hover:border-blue-500 hover:bg-blue-50/50 hover:shadow-md transition-all text-left group relative overflow-hidden flex items-center gap-4" data-next="${opt.next}">
                            <div class="w-10 h-10 rounded-xl bg-zinc-100 group-hover:bg-blue-100 text-zinc-500 group-hover:text-blue-600 flex flex-col items-center justify-center font-black text-sm transition-colors shrink-0">
                                ${String.fromCharCode(65 + idx)} <!-- A, B, C... -->
                            </div>
                            <div class="flex-1 min-w-0">
                                <div class="font-bold text-zinc-800 text-lg group-hover:text-blue-900 transition-colors">${opt.label}</div>
                                ${opt.consequence || opt.note || opt.diagnosis || opt.expectation ? `
                                    <div class="text-sm font-medium text-zinc-500 mt-1 leading-snug">
                                        💡 ${opt.consequence || opt.note || opt.diagnosis || opt.expectation}
                                    </div>
                                ` : ''}
                                ${opt.actions && Array.isArray(opt.actions) ? `
                                    <ul class="text-xs text-zinc-400 mt-2 space-y-0.5">
                                        ${opt.actions.map(a => `<li>• ${a}</li>`).join('')}
                                    </ul>
                                ` : ''}
                            </div>
                            ${opt.next ? `<i data-lucide="chevron-right" class="w-5 h-5 text-zinc-300 group-hover:text-blue-500 transition-colors shrink-0"></i>` : ''}
                        </button>
                    `).join('')}
                </div>
            </div>
        `;
    } 
    else if (node.type === 'sequence') {
        if (node.children && node.children.length > 0) {
            html += `
                <div class="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
                    ${node.children.map((childId, idx) => {
                        const child = treeData.nodes[childId];
                        if(!child) return '';
                        return `
                            <button class="tree-nav-btn p-5 bg-zinc-50 hover:bg-emerald-50 border border-zinc-200 hover:border-emerald-300 rounded-2xl text-left transition-all group flex items-start gap-4" data-next="${childId}">
                                <div class="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-sm shrink-0">
                                    ${idx+1}
                                </div>
                                <div class="flex-1">
                                    <div class="font-bold text-zinc-800 group-hover:text-emerald-900">${child.title || childId}</div>
                                    ${child.description ? `<div class="text-xs text-zinc-500 mt-1 line-clamp-2">${child.description}</div>` : ''}
                                </div>
                                <i data-lucide="arrow-right" class="w-4 h-4 text-zinc-300 group-hover:text-emerald-500 mt-1"></i>
                            </button>
                        `;
                    }).join('')}
                </div>
            `;
        }
        
        // As vezes notes sequencia pedem para avancar para o proximo direto
        if (node.next) {
            html += renderNextButton(node.next, node.action || "Avançar para o Próximo Menu");
        }
    }
    else if (node.type === 'info') {
        if (node.next) {
            html += renderNextButton(node.next, node.action || "Prosseguir para o diagnóstico");
        } else {
             html += `
                <div class="mt-10 pt-8 border-t border-zinc-200 flex flex-col items-center justify-center text-center">
                    <div class="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4">
                        <i data-lucide="check-check" class="w-8 h-8"></i>
                    </div>
                    <h3 class="text-xl font-bold text-zinc-800">Análise Concluída</h3>
                    <p class="text-zinc-500 mt-2 max-w-sm">Este é o ponto final deste braço da árvore. Aplique o trade ou retorne para uma nova avaliação.</p>
                </div>
             `;
        }
    }

    return html;
}

function renderNextButton(nextId, label) {
    return `
        <div class="mt-10 flex justify-end animate-in fade-in slide-in-from-bottom-2">
            <button class="tree-nav-btn bg-zinc-900 hover:bg-zinc-800 text-white px-8 py-4 rounded-xl font-bold text-lg flex items-center gap-3 transition-transform hover:-translate-y-0.5 shadow-lg" data-next="${nextId}">
                ${label}
                <i data-lucide="arrow-right" class="w-5 h-5"></i>
            </button>
        </div>
    `;
}

function renderInfoBlocks(node) {
    let html = '';
    
    // Arrays simples (Lista de características, etc)
    const listBuilders = [
        { key: 'characteristics', title: 'Características Chave', icon: 'zap' },
        { key: 'identification', title: 'Identificação', icon: 'eye' },
        { key: 'causa', title: 'Causa / Contexto', icon: 'activity' },
        { key: ' context_psychological', keyAlt: 'contexto_psicologico', title: 'Entendimento Psicológico', icon: 'brain-circuit' }
    ];

    listBuilders.forEach(lb => {
        const data = node[lb.key] || node[lb.keyAlt];
        if (data) {
            html += `
                <div class="mb-6 bg-zinc-50 rounded-xl p-5 border border-zinc-200/60">
                    <h4 class="text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2 mb-3">
                        <i data-lucide="${lb.icon}" class="w-3.5 h-3.5"></i> ${lb.title}
                    </h4>
                    <ul class="space-y-2">
                        ${Array.isArray(data) 
                            ? data.map(item => `<li class="flex items-start gap-2 text-zinc-700 text-sm"><div class="w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0 mt-1.5"></div><span class="leading-relaxed">${item}</span></li>`).join('')
                            : typeof data === 'object' 
                                ? Object.entries(data).map(([k,v]) => `<li class="flex items-start gap-2 text-zinc-700 text-sm"><div class="w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0 mt-1.5"></div><span class="leading-relaxed"><strong>${k.replace('_',' ').toUpperCase()}:</strong> ${v}</span></li>`).join('') 
                                : `<li class="text-zinc-700 text-sm leading-relaxed">${data}</li>`
                        }
                    </ul>
                </div>
            `;
        }
    });

    // Blocos operacionais
    ['acao', 'action_pullback', 'action_fade', 'setup_reversao', 'entrada', 'stop_loss', 'alvos', 'gestao'].forEach(chave => {
        if (node[chave]) {
             const data = node[chave];
             html += `
                <div class="mb-4 bg-emerald-50/50 rounded-xl p-5 border border-emerald-100">
                    <h4 class="text-xs font-bold text-emerald-700 uppercase tracking-widest mb-3 border-b border-emerald-200/50 pb-2">${chave.replace('_', ' ').toUpperCase()}</h4>
                     ${typeof data === 'string' 
                        ? `<p class="text-sm font-medium text-emerald-900">${data}</p>`
                        : `<ul class="space-y-1.5">
                            ${Object.entries(data).map(([k,v]) => {
                                if(Array.isArray(v)) {
                                    return v.map(item => `<li class="text-sm text-emerald-800 leading-relaxed">• ${item}</li>`).join('');
                                }
                                if(typeof v === 'string') return `<li class="text-sm text-emerald-800 leading-relaxed"><strong class="capitalize">${k.replace('_',' ')}:</strong> ${v}</li>`;
                                return '';
                            }).join('')}
                           </ul>`
                     }
                </div>
             `;
        }
    });
    
    // Regras Isoladas
    if(node.regra || node.regras) {
        const text = node.regra || node.regras;
        html += `
            <div class="mb-6 bg-amber-50 rounded-xl p-5 border border-amber-200">
                <div class="flex gap-3 items-start">
                    <i data-lucide="siren" class="w-5 h-5 text-amber-500 shrink-0 mt-0.5"></i>
                    <div>
                        <h4 class="text-sm font-bold text-amber-800 mb-1">REGRA MESTRE</h4>
                        ${Array.isArray(text) ? `<ul class="list-disc pl-4 space-y-1 text-sm text-amber-900 font-medium">${text.map(t=>`<li>${t}</li>`).join('')}</ul>` : `<p class="text-sm text-amber-900 font-bold">${text}</p>`}
                    </div>
                </div>
            </div>
        `;
    }

    // Setups Extras Object (como em canal_estreito_alta)
    if(node.setups && typeof node.setups === 'object' && !Array.isArray(node.setups)) {
        html += `<div class="mt-8 space-y-4">`;
        Object.values(node.setups).forEach(st => {
             html += `
                <div class="bg-indigo-50/50 border border-indigo-100 rounded-xl p-5">
                    <h4 class="font-bold text-indigo-900 border-b border-indigo-200 pb-2 mb-3">${st.title || 'Setup'}</h4>
                    <ul class="space-y-1 text-sm text-indigo-800/80">
                        ${Object.entries(st).filter(([k])=>k!=='title').map(([k,v]) => {
                            if(Array.isArray(v)) return v.map(item=>`<li>• ${item}</li>`).join('');
                            return `<li><strong class="capitalize">${k}:</strong> ${v}</li>`;
                        }).join('')}
                    </ul>
                </div>
             `;
        });
        html += `</div>`;
    }

    return html;
}
