// js/decision-tree.js
import { store } from './state.js';

let treeData = null;
let navigationHistory = [];
let isLoading = false;
let loadError = null;

async function fetchTreeData() {
    try {
        isLoading = true;
        const timestamp = new Date().getTime();
        const response = await fetch(`data/decision_tree.json?t=${timestamp}`);
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
        container.innerHTML = `
            <div class="h-full flex items-center justify-center">
                <div class="flex flex-col items-center gap-3">
                    <i data-lucide="loader-2" class="w-6 h-6 text-zinc-400 animate-spin"></i>
                    <p class="text-xs text-zinc-400 font-medium">Carregando...</p>
                </div>
            </div>
        `;
        if (window.lucide) window.lucide.createIcons();
        await fetchTreeData();
        renderDecisionTree(container, state);
        return;
    }

    if (loadError) {
        container.innerHTML = `
            <div class="h-full flex items-center justify-center p-6">
                <div class="bg-red-50 text-red-600 p-6 rounded-xl max-w-md text-center border border-red-200">
                    <i data-lucide="alert-triangle" class="w-8 h-8 mx-auto mb-3 opacity-70"></i>
                    <h2 class="text-sm font-semibold mb-1">Erro ao carregar</h2>
                    <p class="text-xs text-red-500 mb-4">${loadError}</p>
                    <button id="retryTreeBtn" class="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-xs font-medium transition-colors">Tentar Novamente</button>
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

    if (!treeData) return;

    const currentNodeId = navigationHistory[navigationHistory.length - 1];
    const currentNode = treeData.nodes[currentNodeId];

    if (!currentNode) {
        container.innerHTML = `<div class="p-6 text-center text-red-500 text-xs">Nó não encontrado: ${currentNodeId}</div>`;
        return;
    }

    const { title, description, type, children, question, options, instruction, warning, next, action } = currentNode;
    const canGoBack = navigationHistory.length > 1;

    container.innerHTML = `
        <div class="h-full flex flex-col overflow-hidden" id="tree-container">
            
            <div class="bg-white border-b border-zinc-200 px-5 py-3 flex items-center justify-between shrink-0">
                <div class="flex items-center gap-3">
                    <button id="backNodeBtn" class="p-1.5 hover:bg-zinc-100 text-zinc-500 rounded-md transition-colors ${!canGoBack ? 'opacity-30 cursor-not-allowed' : ''}" ${!canGoBack ? 'disabled' : ''}>
                        <i data-lucide="arrow-left" class="w-4 h-4"></i>
                    </button>
                    <div>
                        <div class="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest">${treeData.metadata?.title || 'Guia Operacional'}</div>
                        <div class="text-xs font-medium text-zinc-700">Passo ${navigationHistory.length}</div>
                    </div>
                </div>
                <button id="resetTreeBtn" class="flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-700 bg-zinc-100 hover:bg-zinc-200 px-3 py-1.5 rounded-md transition-all hidden md:flex">
                    <i data-lucide="rotate-ccw" class="w-3.5 h-3.5"></i> Recomeçar
                </button>
            </div>

            <div class="flex-1 overflow-y-auto p-5 md:p-6">
                <div class="max-w-3xl mx-auto w-full">
                    
                    <div class="bg-white rounded-xl border border-zinc-200 p-6 mb-4 relative">
                        
                        <div class="inline-flex items-center gap-1.5 px-2 py-0.5 bg-zinc-100 text-zinc-500 rounded text-[10px] font-semibold uppercase tracking-wider mb-3 border border-zinc-200">
                            ${type === 'decision' ? '<i data-lucide="git-branch" class="w-3 h-3 text-blue-500"></i> Decisão' : type === 'sequence' ? '<i data-lucide="align-left" class="w-3 h-3 text-emerald-500"></i> Sequência' : '<i data-lucide="info" class="w-3 h-3 text-amber-500"></i> Informação'}
                        </div>
                        
                        <h1 class="text-xl font-bold text-zinc-900 leading-tight mb-2 tracking-tight">${title}</h1>
                        
                        ${description ? `<p class="text-sm text-zinc-500 leading-relaxed mb-4">${description}</p>` : ''}
                        
                        ${warning ? `
                            <div class="bg-red-50 border-l-2 border-red-500 p-3 rounded-r-lg mb-4">
                                <div class="flex gap-2">
                                    <i data-lucide="alert-triangle" class="w-4 h-4 text-red-500 shrink-0 mt-0.5"></i>
                                    <div>
                                        <h4 class="text-xs font-semibold text-red-700">CUIDADO</h4>
                                        <p class="text-xs text-red-600 mt-0.5">${warning}</p>
                                    </div>
                                </div>
                            </div>
                        ` : ''}
                        
                        ${renderNodeSpecifics(currentNode)}
                    </div>
                </div>
            </div>
            
            <div class="md:hidden border-t border-zinc-200 bg-white p-3 shrink-0 flex justify-center">
                 <button id="resetTreeBtnMobile" class="w-full flex justify-center items-center gap-1.5 text-xs font-medium text-zinc-500 bg-zinc-100 px-3 py-2.5 rounded-lg">
                    <i data-lucide="rotate-ccw" class="w-3.5 h-3.5"></i> Recomeçar
                </button>
            </div>
        </div>
    `;

    if (window.lucide) window.lucide.createIcons();

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

function renderNodeSpecifics(node) {
    let html = '';
    html += renderInfoBlocks(node);

    if (node.type === 'decision') {
        html += `
            <div class="mt-5 border-t border-zinc-100 pt-5">
                <h3 class="text-sm font-semibold text-zinc-700 mb-3 flex items-center gap-2">
                   <i data-lucide="help-circle" class="w-4 h-4 text-blue-500"></i>
                   ${node.question || node.instruction || 'Como você avalia o cenário?'}
                </h3>
                <div class="flex flex-col gap-2">
                    ${node.options.map((opt, idx) => `
                        <button class="tree-nav-btn w-full p-3.5 rounded-lg border border-zinc-200 bg-white hover:border-blue-400 hover:bg-blue-50/50 transition-all text-left group flex items-center gap-3" data-next="${opt.next}">
                            <div class="w-7 h-7 rounded-md bg-zinc-100 group-hover:bg-blue-100 text-zinc-500 group-hover:text-blue-600 flex items-center justify-center font-bold text-xs transition-colors shrink-0">
                                ${String.fromCharCode(65 + idx)}
                            </div>
                            <div class="flex-1 min-w-0">
                                <div class="font-medium text-sm text-zinc-800 group-hover:text-blue-900">${opt.label}</div>
                                ${opt.consequence || opt.note || opt.diagnosis || opt.expectation ? `
                                    <div class="text-xs text-zinc-400 mt-0.5 leading-snug">${opt.consequence || opt.note || opt.diagnosis || opt.expectation}</div>
                                ` : ''}
                                ${opt.actions && Array.isArray(opt.actions) ? `
                                    <ul class="text-[10px] text-zinc-400 mt-1 space-y-0.5">
                                        ${opt.actions.map(a => `<li>· ${a}</li>`).join('')}
                                    </ul>
                                ` : ''}
                            </div>
                            ${opt.next ? `<i data-lucide="chevron-right" class="w-4 h-4 text-zinc-300 group-hover:text-blue-500 transition-colors shrink-0"></i>` : ''}
                        </button>
                    `).join('')}
                </div>
            </div>
        `;
    } 
    else if (node.type === 'sequence') {
        if (node.children && node.children.length > 0) {
            html += `
                <div class="mt-5 grid grid-cols-1 md:grid-cols-2 gap-2">
                    ${node.children.map((childId, idx) => {
                        const child = treeData.nodes[childId];
                        if(!child) return '';
                        return `
                            <button class="tree-nav-btn p-3.5 bg-zinc-50 hover:bg-emerald-50 border border-zinc-200 hover:border-emerald-300 rounded-lg text-left transition-all group flex items-start gap-3" data-next="${childId}">
                                <div class="w-6 h-6 rounded-md bg-zinc-200 group-hover:bg-emerald-200 text-zinc-600 group-hover:text-emerald-700 flex items-center justify-center font-semibold text-xs shrink-0 transition-colors">
                                    ${idx+1}
                                </div>
                                <div class="flex-1 min-w-0">
                                    <div class="font-medium text-sm text-zinc-800 group-hover:text-emerald-900">${child.title || childId}</div>
                                    ${child.description ? `<div class="text-[10px] text-zinc-400 mt-0.5 line-clamp-2">${child.description}</div>` : ''}
                                </div>
                            </button>
                        `;
                    }).join('')}
                </div>
            `;
        }
        if (node.next) {
            html += renderNextButton(node.next, node.action || "Avançar");
        }
    }
    else if (node.type === 'info') {
        if (node.next) {
            html += renderNextButton(node.next, node.action || "Prosseguir");
        } else {
             html += `
                <div class="mt-6 pt-5 border-t border-zinc-200 flex flex-col items-center justify-center text-center">
                    <div class="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-3">
                        <i data-lucide="check-check" class="w-5 h-5"></i>
                    </div>
                    <h3 class="text-sm font-semibold text-zinc-800">Análise Concluída</h3>
                    <p class="text-xs text-zinc-400 mt-1 max-w-sm">Aplique o trade ou retorne para uma nova avaliação.</p>
                </div>
             `;
        }
    }

    return html;
}

function renderNextButton(nextId, label) {
    return `
        <div class="mt-6 flex justify-end">
            <button class="tree-nav-btn bg-zinc-900 hover:bg-zinc-800 text-white px-5 py-2.5 rounded-lg font-medium text-sm flex items-center gap-2 transition-colors" data-next="${nextId}">
                ${label}
                <i data-lucide="arrow-right" class="w-4 h-4"></i>
            </button>
        </div>
    `;
}

function renderInfoBlocks(node) {
    let html = '';
    
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
                <div class="mb-4 bg-zinc-50 rounded-lg p-4 border border-zinc-200/60">
                    <h4 class="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5 mb-2">
                        <i data-lucide="${lb.icon}" class="w-3 h-3"></i> ${lb.title}
                    </h4>
                    <ul class="space-y-1.5">
                        ${Array.isArray(data) 
                            ? data.map(item => `<li class="flex items-start gap-2 text-zinc-600 text-xs"><div class="w-1 h-1 rounded-full bg-zinc-400 shrink-0 mt-1.5"></div><span class="leading-relaxed">${item}</span></li>`).join('')
                            : typeof data === 'object' 
                                ? Object.entries(data).map(([k,v]) => `<li class="flex items-start gap-2 text-zinc-600 text-xs"><div class="w-1 h-1 rounded-full bg-zinc-400 shrink-0 mt-1.5"></div><span class="leading-relaxed"><strong>${k.replace('_',' ').toUpperCase()}:</strong> ${v}</span></li>`).join('') 
                                : `<li class="text-zinc-600 text-xs leading-relaxed">${data}</li>`
                        }
                    </ul>
                </div>
            `;
        }
    });

    ['acao', 'action_pullback', 'action_fade', 'setup_reversao', 'entrada', 'stop_loss', 'alvos', 'gestao'].forEach(chave => {
        if (node[chave]) {
             const data = node[chave];
             html += `
                <div class="mb-3 bg-emerald-50 rounded-lg p-4 border border-emerald-100">
                    <h4 class="text-[10px] font-bold text-emerald-700 uppercase tracking-widest mb-2 border-b border-emerald-200/50 pb-1.5">${chave.replace('_', ' ').toUpperCase()}</h4>
                     ${typeof data === 'string' 
                        ? `<p class="text-xs font-medium text-emerald-800">${data}</p>`
                        : `<ul class="space-y-1">
                            ${Object.entries(data).map(([k,v]) => {
                                if(Array.isArray(v)) return v.map(item => `<li class="text-xs text-emerald-800">· ${item}</li>`).join('');
                                if(typeof v === 'string') return `<li class="text-xs text-emerald-800"><strong class="capitalize">${k.replace('_',' ')}:</strong> ${v}</li>`;
                                return '';
                            }).join('')}
                           </ul>`
                     }
                </div>
             `;
        }
    });
    
    if(node.regra || node.regras) {
        const text = node.regra || node.regras;
        html += `
            <div class="mb-4 bg-amber-50 rounded-lg p-4 border border-amber-200">
                <div class="flex gap-2 items-start">
                    <i data-lucide="siren" class="w-4 h-4 text-amber-500 shrink-0 mt-0.5"></i>
                    <div>
                        <h4 class="text-[10px] font-bold text-amber-700 uppercase tracking-wider mb-1">REGRA MESTRE</h4>
                        ${Array.isArray(text) ? `<ul class="list-disc pl-3.5 space-y-0.5 text-xs text-amber-800 font-medium">${text.map(t=>`<li>${t}</li>`).join('')}</ul>` : `<p class="text-xs text-amber-800 font-semibold">${text}</p>`}
                    </div>
                </div>
            </div>
        `;
    }

    if(node.setups && typeof node.setups === 'object' && !Array.isArray(node.setups)) {
        html += `<div class="mt-5 space-y-2">`;
        Object.values(node.setups).forEach(st => {
             html += `
                <div class="bg-indigo-50/50 border border-indigo-100 rounded-lg p-4">
                    <h4 class="font-semibold text-sm text-indigo-900 border-b border-indigo-200 pb-1.5 mb-2">${st.title || 'Setup'}</h4>
                    <ul class="space-y-0.5 text-xs text-indigo-800/80">
                        ${Object.entries(st).filter(([k])=>k!=='title').map(([k,v]) => {
                            if(Array.isArray(v)) return v.map(item=>`<li>· ${item}</li>`).join('');
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
