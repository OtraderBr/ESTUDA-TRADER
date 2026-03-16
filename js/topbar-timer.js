// js/topbar-timer.js
// Widget de timer persistente no top bar — mostra sessão ativa em qualquer página.
import { store } from './state.js';
import { startTimer, pauseTimer, stopTimer } from './engine.js';

let tickInterval = null;
let lastRenderedId = null;
let lastRenderedState = null;

function getElapsed(session) {
    if (session.timerState === 'playing' && session.timerStartedAt) {
        return (session.elapsedSeconds || 0) + Math.floor((Date.now() - new Date(session.timerStartedAt).getTime()) / 1000);
    }
    return session.elapsedSeconds || 0;
}

function fmt(totalSeconds) {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    const mm = String(m).padStart(2, '0');
    const ss = String(s).padStart(2, '0');
    return h > 0 ? `${String(h).padStart(2, '0')}:${mm}:${ss}` : `${mm}:${ss}`;
}

function stopTick() {
    if (tickInterval) { clearInterval(tickInterval); tickInterval = null; }
}

function startTick(sessionId) {
    stopTick();
    tickInterval = setInterval(() => {
        const el = document.getElementById('topbar-elapsed');
        if (!el) { stopTick(); return; }
        const { sessions } = store.getState();
        const s = sessions.find(x => x.id === sessionId);
        if (!s || s.timerState !== 'playing') { stopTick(); return; }
        el.textContent = fmt(getElapsed(s));
    }, 1000);
}

function renderWidget(session) {
    const el = document.getElementById('topbar-timer');
    if (!el) return;

    if (!session) {
        el.innerHTML = '';
        return;
    }

    const isPlaying = session.timerState === 'playing';
    const isPaused  = session.timerState === 'paused';

    el.innerHTML = `
        <div class="flex items-center gap-2 bg-zinc-100 hover:bg-zinc-200/70 rounded-xl px-3 py-1.5 border border-zinc-200 transition-colors">
            <!-- Status dot -->
            <div class="shrink-0">
                ${isPlaying
                    ? `<span class="relative flex h-2 w-2">
                           <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                           <span class="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                       </span>`
                    : `<span class="inline-flex rounded-full h-2 w-2 bg-amber-400"></span>`
                }
            </div>

            <!-- Session title -->
            <span class="text-xs font-semibold text-zinc-600 max-w-[110px] truncate hidden sm:block">${session.title}</span>

            <!-- Elapsed time -->
            <span class="font-mono text-sm font-bold ${isPlaying ? 'text-blue-600' : 'text-amber-500'}"
                  id="topbar-elapsed">${fmt(getElapsed(session))}</span>

            <!-- Controls -->
            <div class="flex items-center gap-0.5 ml-1">
                ${isPaused ? `
                    <button id="topbar-play" title="Retomar"
                        class="p-1 rounded-lg text-emerald-500 hover:bg-emerald-100 transition-colors"
                        data-id="${session.id}">
                        <i data-lucide="play" class="w-3.5 h-3.5"></i>
                    </button>
                ` : ''}
                ${isPlaying ? `
                    <button id="topbar-pause" title="Pausar"
                        class="p-1 rounded-lg text-amber-500 hover:bg-amber-100 transition-colors"
                        data-id="${session.id}">
                        <i data-lucide="pause" class="w-3.5 h-3.5"></i>
                    </button>
                ` : ''}
                <button id="topbar-stop" title="Encerrar sessão"
                    class="p-1 rounded-lg text-red-400 hover:bg-red-100 transition-colors"
                    data-id="${session.id}">
                    <i data-lucide="square" class="w-3.5 h-3.5"></i>
                </button>
            </div>
        </div>
    `;

    if (window.lucide) window.lucide.createIcons({ nodes: el.querySelectorAll('[data-lucide]') });

    document.getElementById('topbar-play')?.addEventListener('click', async () => {
        await startTimer(session.id);
        startTick(session.id);
    });

    document.getElementById('topbar-pause')?.addEventListener('click', async () => {
        stopTick();
        await pauseTimer(session.id);
    });

    document.getElementById('topbar-stop')?.addEventListener('click', async () => {
        stopTick();
        await stopTimer(session.id);
    });
}

export function updateTopbarTimer(state) {
    // Mostra a sessão playing, ou se não houver, a paused mais recente
    const activeSession = state.sessions?.find(s => s.timerState === 'playing')
        || state.sessions?.find(s => s.timerState === 'paused');

    const newId    = activeSession?.id || null;
    const newState = activeSession?.timerState || null;

    const changed = newId !== lastRenderedId || newState !== lastRenderedState;
    if (!changed) return;

    lastRenderedId    = newId;
    lastRenderedState = newState;

    renderWidget(activeSession || null);

    if (activeSession?.timerState === 'playing') {
        startTick(activeSession.id);
    } else {
        stopTick();
    }
}
