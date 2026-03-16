// js/sessions.js
import { store } from './state.js';
import { addSessionAction, toggleSessionComplete, deleteSession,
         startTimer, pauseTimer, stopTimer, saveTimerProgress, saveSessionNotes } from './engine.js';

// ─── Timer state (module-level) ───────────────────────────────────────────────
const activeIntervals = new Map(); // sessionId → { tickInterval, saveInterval }

function getElapsedSeconds(session) {
    if (session.timerState === 'playing' && session.timerStartedAt) {
        const startedMs = new Date(session.timerStartedAt).getTime();
        return (session.elapsedSeconds || 0) + Math.floor((Date.now() - startedMs) / 1000);
    }
    return session.elapsedSeconds || 0;
}

function formatTime(totalSeconds) {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    const mm = String(m).padStart(2, '0');
    const ss = String(s).padStart(2, '0');
    return h > 0 ? `${String(h).padStart(2, '0')}:${mm}:${ss}` : `${mm}:${ss}`;
}

function startTimerTick(sessionId) {
    stopTimerTick(sessionId);
    let tickCount = 0;
    const tickInterval = setInterval(() => {
        const { sessions } = store.getState();
        const session = sessions.find(s => s.id === sessionId);
        if (!session || session.timerState !== 'playing') {
            stopTimerTick(sessionId);
            return;
        }
        // Update timer display in-place (no full re-render)
        const el = document.querySelector(`[data-timer="${sessionId}"]`);
        if (el) el.textContent = formatTime(getElapsedSeconds(session));

        // Save to Supabase every 30 seconds
        tickCount++;
        if (tickCount % 30 === 0) {
            saveTimerProgress(sessionId);
        }
    }, 1000);

    activeIntervals.set(sessionId, tickInterval);
}

function stopTimerTick(sessionId) {
    if (activeIntervals.has(sessionId)) {
        clearInterval(activeIntervals.get(sessionId));
        activeIntervals.delete(sessionId);
    }
}

// ─── Module state ─────────────────────────────────────────────────────────────
let isModalOpen = false;
let modalType = 'Estudo';
let modalDate = new Date().toISOString().slice(0, 10);
let modalConceptsOpen = false;
let selectedConceptIds = [];
const expandedSessionIds = new Set();
const pendingNotesSaves = new Map();

// ─── Type helpers ─────────────────────────────────────────────────────────────
const TYPE_COLORS = {
    'Estudo':  'bg-blue-50 text-blue-700 border-blue-200',
    'Revisão': 'bg-amber-50 text-amber-700 border-amber-200',
    'Prática': 'bg-purple-50 text-purple-700 border-purple-200',
};
const TYPE_DOT = {
    'Estudo':  'bg-blue-500',
    'Revisão': 'bg-amber-500',
    'Prática': 'bg-purple-500',
};
const TYPE_ACTIVE_BORDER = {
    'Estudo':  'bg-blue-50 text-blue-700 border-blue-300',
    'Revisão': 'bg-amber-50 text-amber-700 border-amber-300',
    'Prática': 'bg-purple-50 text-purple-700 border-purple-300',
};

// ─── Main render ──────────────────────────────────────────────────────────────
export function renderSessions(container, state) {
    const { sessions } = state;

    // Resume ticking for any sessions that were already playing
    sessions.forEach(s => {
        if (s.timerState === 'playing' && !activeIntervals.has(s.id)) {
            startTimerTick(s.id);
        }
    });

    const sorted = [...sessions].sort((a, b) => new Date(b.date) - new Date(a.date));

    container.innerHTML = `
        ${isModalOpen ? renderModal(state) : ''}
        <div class="p-6 max-w-4xl mx-auto h-full overflow-y-auto pb-20">
            <div class="flex items-center justify-between gap-4 mb-6">
                <div>
                    <h1 class="text-xl font-bold text-zinc-900">Sessões de Estudo</h1>
                    <p class="text-xs text-zinc-400 mt-0.5">${sessions.length} sessão${sessions.length !== 1 ? 'ões' : ''} registrada${sessions.length !== 1 ? 's' : ''}</p>
                </div>
                <button id="newSessionBtn"
                    class="flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 text-white px-4 py-2 rounded-lg text-xs font-semibold transition-colors shadow-sm">
                    <i data-lucide="plus" class="w-3.5 h-3.5"></i>
                    Nova Sessão
                </button>
            </div>

            ${sorted.length === 0 ? `
                <div class="flex flex-col items-center justify-center py-16 text-zinc-400 bg-zinc-50/50 border border-dashed border-zinc-200 rounded-xl">
                    <div class="w-12 h-12 bg-zinc-100 rounded-full flex items-center justify-center mb-3">
                        <i data-lucide="clock" class="w-5 h-5 text-zinc-400"></i>
                    </div>
                    <p class="text-sm font-medium text-zinc-500">Nenhuma sessão registrada.</p>
                    <p class="text-xs mt-1">Crie sua primeira sessão de estudo.</p>
                </div>
            ` : `
                <div class="space-y-2">
                    ${sorted.map(s => renderCard(s, state)).join('')}
                </div>
            `}
        </div>
    `;

    if (window.lucide) window.lucide.createIcons();
    bindEvents(container, state);
}

// ─── Session Card ─────────────────────────────────────────────────────────────
function renderCard(session, state) {
    const { concepts } = state;
    const isExpanded = expandedSessionIds.has(session.id);
    const elapsed = getElapsedSeconds(session);
    const isPlaying = session.timerState === 'playing';
    const isPaused  = session.timerState === 'paused';
    const isStopped = session.timerState === 'stopped';
    const sessionConcepts = concepts.filter(c => session.conceptIds.includes(c.id));
    const isPast = new Date(session.date + 'T12:00:00') < new Date().setHours(0, 0, 0, 0);

    let cardBorder;
    if (session.completed)  cardBorder = 'border-emerald-200 bg-emerald-50/20 opacity-80';
    else if (isPlaying)     cardBorder = 'border-blue-300 bg-blue-50/20 shadow-sm';
    else if (isPast)        cardBorder = 'border-red-200 bg-red-50/10';
    else                    cardBorder = 'border-zinc-200 bg-white hover:border-zinc-300';

    return `
    <div class="border rounded-xl transition-all duration-200 ${cardBorder}" data-session-id="${session.id}">
        <!-- Header (always visible, clickable to expand) -->
        <div class="flex items-center gap-3 px-4 py-3 cursor-pointer select-none session-header" data-id="${session.id}">
            <!-- Status indicator -->
            <div class="shrink-0 w-5 flex items-center justify-center">
                ${session.completed
                    ? `<i data-lucide="check-circle-2" class="w-4.5 h-4.5 text-emerald-500"></i>`
                    : isPlaying
                        ? `<span class="relative flex h-2.5 w-2.5">
                               <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                               <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500"></span>
                           </span>`
                        : `<span class="inline-flex rounded-full h-2 w-2 ${TYPE_DOT[session.type] || 'bg-zinc-300'} opacity-50"></span>`
                }
            </div>

            <!-- Title & meta -->
            <div class="flex-1 min-w-0">
                <div class="flex items-center gap-1.5 flex-wrap">
                    <h3 class="text-sm font-semibold ${session.completed ? 'text-zinc-400 line-through' : 'text-zinc-800'} truncate">${session.title}</h3>
                    <span class="text-[10px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${TYPE_COLORS[session.type] || 'bg-zinc-50 text-zinc-600 border-zinc-200'}">${session.type}</span>
                    ${isPast && !session.completed ? `<span class="text-[10px] font-semibold text-red-500 bg-red-50 px-1.5 py-0.5 rounded border border-red-200 shrink-0">Atrasada</span>` : ''}
                </div>
                <div class="flex items-center gap-2 text-[10px] text-zinc-400 mt-0.5">
                    <span>${new Date(session.date + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                    ${sessionConcepts.length > 0 ? `<span>·</span><span>${sessionConcepts.length} conceito${sessionConcepts.length !== 1 ? 's' : ''}</span>` : ''}
                    ${elapsed > 0 && !isPlaying ? `<span>·</span><span class="font-mono font-semibold text-zinc-500">${formatTime(elapsed)}</span>` : ''}
                </div>
            </div>

            <!-- Live timer (visible while playing or paused) -->
            <div class="shrink-0 text-right min-w-[56px]">
                <div class="font-mono text-sm font-bold ${isPlaying ? 'text-blue-600' : elapsed > 0 ? 'text-zinc-600' : 'text-zinc-200'}"
                     data-timer="${session.id}">
                    ${formatTime(elapsed)}
                </div>
                ${isPlaying ? `<div class="text-[9px] text-blue-400 font-medium mt-0.5 text-right">ao vivo</div>` : ''}
            </div>

            <!-- Timer controls (no propagation) -->
            <div class="flex items-center gap-0.5 shrink-0" onclick="event.stopPropagation()">
                ${!session.completed ? `
                    ${(isStopped || isPaused) ? `
                        <button class="timer-play-btn p-1.5 rounded-lg text-emerald-500 hover:bg-emerald-50 transition-colors" title="Iniciar timer" data-id="${session.id}">
                            <i data-lucide="play" class="w-4 h-4"></i>
                        </button>
                    ` : ''}
                    ${isPlaying ? `
                        <button class="timer-pause-btn p-1.5 rounded-lg text-amber-500 hover:bg-amber-50 transition-colors" title="Pausar" data-id="${session.id}">
                            <i data-lucide="pause" class="w-4 h-4"></i>
                        </button>
                    ` : ''}
                    ${(isPlaying || isPaused) ? `
                        <button class="timer-stop-btn p-1.5 rounded-lg text-red-400 hover:bg-red-50 transition-colors" title="Encerrar sessão" data-id="${session.id}">
                            <i data-lucide="square" class="w-4 h-4"></i>
                        </button>
                    ` : ''}
                ` : ''}
            </div>

            <!-- Expand chevron -->
            <div class="shrink-0 text-zinc-300">
                <i data-lucide="${isExpanded ? 'chevron-up' : 'chevron-down'}" class="w-4 h-4"></i>
            </div>
        </div>

        <!-- Expanded panel -->
        ${isExpanded ? `
        <div class="border-t border-zinc-100 px-4 py-4 space-y-4">
            <!-- Notes -->
            <div>
                <label class="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Anotações da Sessão</label>
                <textarea
                    class="session-notes mt-2 w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2.5 text-xs text-zinc-700 resize-none focus:outline-none focus:border-zinc-400 transition-colors leading-relaxed"
                    rows="4"
                    placeholder="Escreva observações, dúvidas, resumos ou insights desta sessão..."
                    data-id="${session.id}"
                >${session.notes || ''}</textarea>
            </div>

            ${sessionConcepts.length > 0 ? `
            <div>
                <label class="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Conceitos Vinculados</label>
                <div class="flex flex-wrap gap-1.5 mt-2">
                    ${sessionConcepts.map(c => `
                        <span class="text-[10px] bg-zinc-100 text-zinc-600 px-2 py-1 rounded-md font-medium">${c.name}</span>
                    `).join('')}
                </div>
            </div>
            ` : ''}

            <!-- Actions -->
            <div class="flex items-center justify-between pt-1 border-t border-zinc-100">
                <button class="toggle-complete-btn flex items-center gap-1.5 text-xs font-semibold transition-colors ${session.completed ? 'text-emerald-500 hover:text-zinc-500' : 'text-zinc-400 hover:text-emerald-500'}" data-id="${session.id}">
                    <i data-lucide="${session.completed ? 'check-circle-2' : 'circle'}" class="w-3.5 h-3.5"></i>
                    ${session.completed ? 'Concluída' : 'Marcar como concluída'}
                </button>
                <button class="delete-session-btn flex items-center gap-1 text-[11px] text-zinc-300 hover:text-red-500 transition-colors font-semibold" data-id="${session.id}">
                    <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                    Excluir
                </button>
            </div>
        </div>
        ` : ''}
    </div>
    `;
}

// ─── Creation Modal ───────────────────────────────────────────────────────────
function renderModal(state) {
    const { sessions, concepts } = state;
    const typeCount = sessions.filter(s => s.type === modalType).length + 1;
    const autoName = `${modalType} #${typeCount}`;

    return `
    <div id="modal-overlay"
        class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in" style="animation: fadeScaleIn .15s ease-out">

            <div class="px-6 pt-6 pb-5">
                <div class="flex items-center justify-between mb-5">
                    <h2 class="text-sm font-bold text-zinc-900">Nova Sessão de Estudo</h2>
                    <button id="closeModalBtn" class="p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors">
                        <i data-lucide="x" class="w-4 h-4"></i>
                    </button>
                </div>

                <!-- Type selector -->
                <div class="mb-4">
                    <label class="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Tipo de Sessão</label>
                    <div class="flex gap-2 mt-2">
                        ${['Estudo', 'Revisão', 'Prática'].map(type => `
                            <button class="modal-type-btn flex-1 py-2.5 px-3 rounded-xl border text-xs font-semibold transition-all ${
                                modalType === type ? TYPE_ACTIVE_BORDER[type] : 'bg-white text-zinc-500 border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50'
                            }" data-type="${type}">${type}</button>
                        `).join('')}
                    </div>
                </div>

                <!-- Auto name preview -->
                <div class="mb-4 px-3 py-2 bg-zinc-50 rounded-lg border border-zinc-100 flex items-center gap-2">
                    <i data-lucide="tag" class="w-3.5 h-3.5 text-zinc-400 shrink-0"></i>
                    <div>
                        <span class="text-[10px] text-zinc-400">Nome automático: </span>
                        <span class="text-xs font-bold text-zinc-700" id="autoNamePreview">${autoName}</span>
                    </div>
                </div>

                <!-- Date -->
                <div class="mb-4">
                    <label class="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Data</label>
                    <input type="date" id="modalDate" value="${modalDate}"
                        class="mt-1.5 w-full bg-white border border-zinc-200 text-zinc-700 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-zinc-400 transition-colors" />
                </div>

                <!-- Optional concepts accordion -->
                <div class="mb-5">
                    <button id="toggleConceptsBtn"
                        class="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-600 font-semibold transition-colors w-full">
                        <i data-lucide="${modalConceptsOpen ? 'chevron-down' : 'chevron-right'}" class="w-3.5 h-3.5 shrink-0"></i>
                        <span>Conceitos opcionais</span>
                        ${selectedConceptIds.length > 0 ? `
                            <span class="ml-auto bg-zinc-900 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">${selectedConceptIds.length}</span>
                        ` : ''}
                    </button>

                    ${modalConceptsOpen ? `
                    <div class="mt-2 border border-zinc-200 rounded-xl overflow-hidden">
                        <div class="p-2 bg-zinc-50 border-b border-zinc-100">
                            <div class="relative">
                                <i data-lucide="search" class="w-3 h-3 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2"></i>
                                <input type="text" id="modalConceptSearch" placeholder="Buscar conceitos..."
                                    class="w-full bg-white border border-zinc-200 text-zinc-700 text-[10px] rounded-lg pl-7 pr-3 py-1.5 focus:outline-none focus:border-zinc-400" />
                            </div>
                        </div>
                        <div class="h-44 overflow-y-auto p-1.5 space-y-0.5" id="modalConceptList">
                            ${renderConceptList(concepts, '')}
                        </div>
                    </div>
                    ` : ''}
                </div>

                <!-- Actions -->
                <div class="flex gap-2">
                    <button id="cancelModalBtn"
                        class="flex-1 py-2.5 rounded-xl border border-zinc-200 text-xs font-semibold text-zinc-500 hover:bg-zinc-50 transition-colors">
                        Cancelar
                    </button>
                    <button id="createSessionBtn"
                        class="flex-1 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold transition-colors">
                        Criar Sessão
                    </button>
                </div>
            </div>
        </div>
    </div>
    `;
}

function renderConceptList(concepts, query) {
    const filtered = query
        ? concepts.filter(c => c.name.toLowerCase().includes(query.toLowerCase()))
        : concepts;

    if (filtered.length === 0) {
        return `<div class="text-center text-zinc-400 py-4 text-[10px]">Nenhum conceito encontrado.</div>`;
    }

    return filtered.map(c => {
        const isSel = selectedConceptIds.includes(c.id);
        return `
        <button class="modal-concept-btn w-full text-left px-2.5 py-1.5 rounded-lg text-[10px] flex items-center justify-between transition-all ${
            isSel ? 'bg-zinc-900 text-white font-semibold' : 'text-zinc-500 hover:bg-zinc-50'
        }" data-id="${c.id}">
            <span class="truncate">${c.name}</span>
            ${isSel ? `<i data-lucide="check" class="w-3 h-3 shrink-0"></i>` : ''}
        </button>`;
    }).join('');
}

// ─── Event bindings ───────────────────────────────────────────────────────────
function bindEvents(container, state) {
    // Open modal
    document.getElementById('newSessionBtn')?.addEventListener('click', () => {
        isModalOpen = true;
        modalConceptsOpen = false;
        selectedConceptIds = [];
        renderSessions(container, store.getState());
    });

    // Close modal
    const closeModal = () => {
        isModalOpen = false;
        selectedConceptIds = [];
        modalConceptsOpen = false;
        renderSessions(container, store.getState());
    };
    document.getElementById('closeModalBtn')?.addEventListener('click', closeModal);
    document.getElementById('cancelModalBtn')?.addEventListener('click', closeModal);
    document.getElementById('modal-overlay')?.addEventListener('click', e => {
        if (e.target.id === 'modal-overlay') closeModal();
    });

    // Type buttons
    container.querySelectorAll('.modal-type-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            modalType = btn.dataset.type;
            const { sessions } = store.getState();
            const count = sessions.filter(s => s.type === modalType).length + 1;
            const preview = document.getElementById('autoNamePreview');
            if (preview) preview.textContent = `${modalType} #${count}`;

            container.querySelectorAll('.modal-type-btn').forEach(b => {
                const t = b.dataset.type;
                b.className = `modal-type-btn flex-1 py-2.5 px-3 rounded-xl border text-xs font-semibold transition-all ${
                    t === modalType ? TYPE_ACTIVE_BORDER[t] : 'bg-white text-zinc-500 border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50'
                }`;
            });
        });
    });

    // Date
    document.getElementById('modalDate')?.addEventListener('change', e => {
        modalDate = e.target.value;
    });

    // Toggle concepts
    document.getElementById('toggleConceptsBtn')?.addEventListener('click', () => {
        modalConceptsOpen = !modalConceptsOpen;
        renderSessions(container, store.getState());
    });

    // Concept search
    document.getElementById('modalConceptSearch')?.addEventListener('input', e => {
        const q = e.target.value;
        const list = document.getElementById('modalConceptList');
        if (!list) return;
        list.innerHTML = renderConceptList(store.getState().concepts, q);
        if (window.lucide) window.lucide.createIcons();
        bindConceptBtns(list, container);
    });

    // Concept toggle in modal
    const modalConceptList = document.getElementById('modalConceptList');
    if (modalConceptList) bindConceptBtns(modalConceptList, container);

    // Create session
    document.getElementById('createSessionBtn')?.addEventListener('click', async () => {
        const { sessions } = store.getState();
        const typeCount = sessions.filter(s => s.type === modalType).length + 1;
        const title = `${modalType} #${typeCount}`;
        const btn = document.getElementById('createSessionBtn');
        if (btn) { btn.disabled = true; btn.textContent = 'Criando...'; }
        await addSessionAction(title, modalType, modalDate, [...selectedConceptIds]);
        isModalOpen = false;
        selectedConceptIds = [];
        renderSessions(container, store.getState());
    });

    // Card expand / collapse
    container.querySelectorAll('.session-header').forEach(header => {
        header.addEventListener('click', () => {
            const id = header.dataset.id;
            if (expandedSessionIds.has(id)) expandedSessionIds.delete(id);
            else expandedSessionIds.add(id);
            renderSessions(container, store.getState());
        });
    });

    // Timer: play
    container.querySelectorAll('.timer-play-btn').forEach(btn => {
        btn.addEventListener('click', async e => {
            e.stopPropagation();
            await startTimer(btn.dataset.id);
            startTimerTick(btn.dataset.id);
            renderSessions(container, store.getState());
        });
    });

    // Timer: pause
    container.querySelectorAll('.timer-pause-btn').forEach(btn => {
        btn.addEventListener('click', async e => {
            e.stopPropagation();
            stopTimerTick(btn.dataset.id);
            await pauseTimer(btn.dataset.id);
            renderSessions(container, store.getState());
        });
    });

    // Timer: stop (encerrar sessão)
    container.querySelectorAll('.timer-stop-btn').forEach(btn => {
        btn.addEventListener('click', async e => {
            e.stopPropagation();
            stopTimerTick(btn.dataset.id);
            await stopTimer(btn.dataset.id);
            renderSessions(container, store.getState());
        });
    });

    // Notes (debounced auto-save, 1.5s)
    container.querySelectorAll('.session-notes').forEach(ta => {
        ta.addEventListener('input', e => {
            const id = ta.dataset.id;
            if (pendingNotesSaves.has(id)) clearTimeout(pendingNotesSaves.get(id));
            pendingNotesSaves.set(id, setTimeout(() => {
                saveSessionNotes(id, e.target.value);
                pendingNotesSaves.delete(id);
            }, 1500));
        });
    });

    // Toggle complete
    container.querySelectorAll('.toggle-complete-btn').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            toggleSessionComplete(btn.dataset.id);
        });
    });

    // Delete
    container.querySelectorAll('.delete-session-btn').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            if (!confirm('Excluir esta sessão permanentemente?')) return;
            stopTimerTick(btn.dataset.id);
            expandedSessionIds.delete(btn.dataset.id);
            deleteSession(btn.dataset.id);
        });
    });
}

function bindConceptBtns(listEl, container) {
    listEl.querySelectorAll('.modal-concept-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.id;
            if (selectedConceptIds.includes(id)) {
                selectedConceptIds = selectedConceptIds.filter(i => i !== id);
            } else {
                selectedConceptIds.push(id);
            }
            const isSel = selectedConceptIds.includes(id);
            btn.className = `modal-concept-btn w-full text-left px-2.5 py-1.5 rounded-lg text-[10px] flex items-center justify-between transition-all ${
                isSel ? 'bg-zinc-900 text-white font-semibold' : 'text-zinc-500 hover:bg-zinc-50'
            }`;
            btn.innerHTML = `<span class="truncate">${btn.querySelector('span').textContent}</span>${isSel ? `<i data-lucide="check" class="w-3 h-3 shrink-0"></i>` : ''}`;
            if (window.lucide) window.lucide.createIcons();

            // Update concept count badge in toggle button
            const toggleBtn = document.getElementById('toggleConceptsBtn');
            if (toggleBtn) {
                const badge = toggleBtn.querySelector('span.ml-auto');
                if (selectedConceptIds.length > 0) {
                    if (badge) badge.textContent = selectedConceptIds.length;
                    else toggleBtn.insertAdjacentHTML('beforeend', `<span class="ml-auto bg-zinc-900 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">${selectedConceptIds.length}</span>`);
                } else if (badge) {
                    badge.remove();
                }
            }
        });
    });
}
