// js/course-search.js
// Página de busca: em qual aula/módulo do curso Al Brooks cada conceito aparece

import { store } from './state.js';

export function renderCourseSearch(container, state) {
    const { concepts } = state;

    // ── Monta estrutura modulo → aula → conceitos ──────────────────────────────
    const moduleMap = {}; // { moduleName: { lessonName: [concepts] } }
    concepts.forEach(c => {
        const mod = c.moduloCurso || 'Sem módulo';
        const lesson = c.aulaCurso || '__sem_aula__';
        if (!moduleMap[mod]) moduleMap[mod] = {};
        if (!moduleMap[mod][lesson]) moduleMap[mod][lesson] = [];
        moduleMap[mod][lesson].push(c);
    });

    const sortedModules = Object.keys(moduleMap).sort((a, b) => {
        const na = parseInt(a.match(/\((\d+)/)?.[1] || '999');
        const nb = parseInt(b.match(/\((\d+)/)?.[1] || '999');
        return na - nb;
    });

    // ── Helpers ────────────────────────────────────────────────────────────────
    function moduleShort(mod) {
        const num   = mod.match(/\((\d+[^\)]*)\)/)?.[1] || '';
        const label = mod.includes('—') ? mod.split('—')[1].split('(')[0].trim() : mod;
        const theme = mod.toLowerCase().includes('fundamentos') ? 'fund' : 'oper';
        return { num, label, theme };
    }

    function abcBadge(cat) {
        const map = {
            A: 'text-emerald-700 bg-emerald-50 border-emerald-200',
            B: 'text-amber-700  bg-amber-50  border-amber-200',
            C: 'text-red-700    bg-red-50    border-red-200',
            D: 'text-violet-700 bg-violet-50 border-violet-200',
            E: 'text-zinc-500   bg-zinc-50   border-zinc-200',
        };
        return map[cat] || map.C;
    }

    function masteryBar(cat, pct) {
        const p = cat === 'D' ? 100 : (pct || 0);
        const color = { A:'bg-emerald-500', B:'bg-amber-400', C:'bg-red-400', D:'bg-violet-500', E:'bg-zinc-300' }[cat] || 'bg-red-400';
        return `<div class="h-1 w-16 bg-zinc-100 rounded-full overflow-hidden shrink-0">
            <div class="${color} h-full rounded-full" style="width:${p}%"></div></div>`;
    }

    function conceptRow(c) {
        const mastery = c.abcCategory === 'D' ? 100 : (c.masteryPercentage || 0);
        return `
        <button class="cs-concept w-full flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-50 transition-colors text-left group"
            data-cid="${c.id}">
          <div class="flex-1 min-w-0">
            <span class="text-[13px] font-medium text-zinc-700 group-hover:text-zinc-900 truncate block leading-snug">${c.name}</span>
          </div>
          ${masteryBar(c.abcCategory, mastery)}
          <span class="text-[10px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${abcBadge(c.abcCategory || 'C')}">${c.abcCategory || 'C'}</span>
          <i data-lucide="chevron-right" class="w-3.5 h-3.5 text-zinc-300 shrink-0"></i>
        </button>`;
    }

    // ── Render principal ───────────────────────────────────────────────────────
    container.innerHTML = `
    <div class="flex flex-col h-full" id="cs-root">

      <!-- Header -->
      <div class="px-5 pt-5 pb-4 border-b border-zinc-100 bg-white shrink-0">
        <div class="max-w-2xl mx-auto">
          <h1 class="text-[17px] font-bold text-zinc-900 leading-tight">Buscar nas Aulas</h1>
          <p class="text-xs text-zinc-400 mt-0.5">Encontre em qual aula do Al Brooks cada conceito é abordado</p>

          <!-- Search -->
          <div class="relative mt-4">
            <i data-lucide="search" class="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"></i>
            <input id="cs-input" type="text" placeholder="Conceito, aula ou módulo…"
              class="w-full bg-zinc-50 border border-zinc-200 rounded-xl pl-10 pr-10 py-3 text-sm text-zinc-800
                     placeholder:text-zinc-400 focus:outline-none focus:bg-white focus:border-zinc-400 focus:ring-2 focus:ring-zinc-100 transition-all"/>
            <button id="cs-clear" class="hidden absolute right-3 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-zinc-700 rounded-md hover:bg-zinc-100 transition-colors">
              <i data-lucide="x" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </div>
      </div>

      <!-- Body -->
      <div class="flex-1 overflow-y-auto" id="cs-body">
        <div class="max-w-2xl mx-auto px-5 py-5 pb-24 space-y-3" id="cs-results"></div>
      </div>
    </div>`;

    if (window.lucide) window.lucide.createIcons();

    const resultsEl = document.getElementById('cs-results');
    const searchInput = document.getElementById('cs-input');
    const clearBtn    = document.getElementById('cs-clear');

    // ── Browse: grade de módulos ───────────────────────────────────────────────
    function renderBrowse() {
        const html = `
          <p class="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest px-0.5 pb-1">Módulos do Curso</p>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            ${sortedModules.map(mod => {
                const { num, label, theme } = moduleShort(mod);
                const total    = Object.values(moduleMap[mod]).reduce((s, arr) => s + arr.length, 0);
                const mapped   = Object.entries(moduleMap[mod]).filter(([k]) => k !== '__sem_aula__').reduce((s,[,a])=>s+a.length,0);
                const accent   = theme === 'fund' ? 'border-blue-100 bg-gradient-to-br from-blue-50 to-white' : 'border-purple-100 bg-gradient-to-br from-purple-50 to-white';
                const numColor = theme === 'fund' ? 'text-blue-500' : 'text-purple-500';
                return `
                <button class="cs-mod-btn text-left p-4 bg-white border border-zinc-200 rounded-xl hover:border-zinc-300 hover:shadow-sm transition-all"
                    data-mod="${encodeURIComponent(mod)}">
                  <div class="flex items-start justify-between gap-2">
                    <div class="flex-1 min-w-0">
                      <div class="text-[10px] font-bold uppercase tracking-widest mb-0.5 ${numColor}">${num}</div>
                      <div class="text-[13px] font-semibold text-zinc-800 leading-snug">${label}</div>
                    </div>
                    <i data-lucide="chevron-right" class="w-4 h-4 text-zinc-300 mt-0.5 shrink-0"></i>
                  </div>
                  <div class="flex items-center gap-2 mt-3">
                    <span class="text-[11px] text-zinc-500">${total} conceitos</span>
                    ${mapped > 0 ? `<span class="text-[11px] text-emerald-600 font-medium">· ${mapped} com aula</span>` : ''}
                  </div>
                </button>`;
            }).join('')}
          </div>`;

        resultsEl.innerHTML = html;
        if (window.lucide) window.lucide.createIcons();

        resultsEl.querySelectorAll('.cs-mod-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                renderModule(decodeURIComponent(btn.getAttribute('data-mod')));
            });
        });
    }

    // ── Detalhe de módulo ──────────────────────────────────────────────────────
    function renderModule(mod) {
        const lessons = moduleMap[mod] || {};
        const mapped = Object.entries(lessons).filter(([k]) => k !== '__sem_aula__').sort(([a],[b]) => a.localeCompare(b));
        const unmap  = lessons['__sem_aula__'] || [];
        const total  = Object.values(lessons).reduce((s,a)=>s+a.length,0);

        const lessonBlock = (key, lessonConcepts, heading, subheading) => `
          <div class="bg-white border border-zinc-200 rounded-xl overflow-hidden" data-lesson-card>
            <button class="cs-lesson-toggle w-full flex items-center justify-between px-4 py-3.5 hover:bg-zinc-50 transition-colors text-left">
              <div class="flex-1 min-w-0">
                ${heading}
                <div class="text-[11px] text-zinc-400 mt-0.5">${lessonConcepts.length} conceito${lessonConcepts.length!==1?'s':''}</div>
              </div>
              <i data-lucide="chevron-right" class="w-4 h-4 text-zinc-300 transition-transform duration-200 shrink-0"></i>
            </button>
            <div class="lesson-body hidden divide-y divide-zinc-50 pt-1 pb-1">
              ${lessonConcepts.slice().sort((a,b)=>a.name.localeCompare(b.name)).map(conceptRow).join('')}
            </div>
          </div>`;

        resultsEl.innerHTML = `
          <button id="cs-back" class="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800 transition-colors mb-1">
            <i data-lucide="arrow-left" class="w-4 h-4"></i> Todos os módulos
          </button>
          <div class="bg-white border border-zinc-200 rounded-xl p-4 mb-1">
            <h2 class="text-[14px] font-bold text-zinc-900 leading-snug">${mod}</h2>
            <p class="text-[11px] text-zinc-400 mt-1">${mapped.length} aula${mapped.length!==1?'s':''} mapeada${mapped.length!==1?'s':''} · ${total} conceitos</p>
          </div>
          <div class="space-y-2.5">
            ${mapped.map(([lesson, lc]) => lessonBlock(lesson, lc, `
              <div class="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-0.5">Aula</div>
              <div class="text-[13px] font-semibold text-zinc-800 leading-snug">${lesson}</div>`, '')).join('')}
            ${unmap.length > 0 ? lessonBlock('__sem_aula__', unmap, `
              <div class="text-[13px] font-medium text-zinc-500">Sem aula específica mapeada</div>`, '') : ''}
          </div>`;

        if (window.lucide) window.lucide.createIcons();

        document.getElementById('cs-back')?.addEventListener('click', renderBrowse);

        resultsEl.querySelectorAll('.cs-lesson-toggle').forEach(btn => {
            btn.addEventListener('click', () => {
                const body = btn.nextElementSibling;
                const open = !body.classList.contains('hidden');
                body.classList.toggle('hidden', open);
                const icon = btn.querySelector('[data-lucide]');
                if (icon) icon.style.transform = open ? '' : 'rotate(90deg)';
                attachConcepts(body);
            });
        });
    }

    // ── Busca ──────────────────────────────────────────────────────────────────
    function renderSearch(term) {
        const q = term.toLowerCase();
        const matched = concepts.filter(c =>
            c.name.toLowerCase().includes(q) ||
            (c.moduloCurso || '').toLowerCase().includes(q) ||
            (c.aulaCurso || '').toLowerCase().includes(q) ||
            (c.category || '').toLowerCase().includes(q)
        );

        if (!matched.length) {
            resultsEl.innerHTML = `
              <div class="text-center py-16 bg-white border border-dashed border-zinc-200 rounded-xl">
                <i data-lucide="search-x" class="w-10 h-10 text-zinc-200 mx-auto mb-3"></i>
                <p class="text-sm font-medium text-zinc-400">Nenhum conceito encontrado</p>
                <p class="text-[11px] text-zinc-300 mt-1">Tente outro termo</p>
              </div>`;
            if (window.lucide) window.lucide.createIcons();
            return;
        }

        // Agrupar por módulo → aula
        const groups = {};
        matched.forEach(c => {
            const key = `${c.moduloCurso||''}||${c.aulaCurso||''}`;
            if (!groups[key]) groups[key] = { mod: c.moduloCurso||'Sem módulo', lesson: c.aulaCurso||'', concepts: [] };
            groups[key].concepts.push(c);
        });
        const sorted = Object.values(groups).sort((a,b) => a.mod.localeCompare(b.mod) || a.lesson.localeCompare(b.lesson));

        resultsEl.innerHTML = `
          <p class="text-[11px] text-zinc-400 px-0.5 pb-1">
            <strong class="text-zinc-700">${matched.length}</strong> resultado${matched.length!==1?'s':''} para "<strong class="text-zinc-700">${term}</strong>"
          </p>
          <div class="space-y-2.5">
            ${sorted.map(g => `
              <div class="bg-white border border-zinc-200 rounded-xl overflow-hidden">
                <div class="px-4 py-3 border-b border-zinc-50">
                  <div class="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider truncate">${g.mod}</div>
                  ${g.lesson ? `<div class="text-[12px] font-semibold text-emerald-700 mt-0.5">${g.lesson}</div>` : ''}
                </div>
                <div class="divide-y divide-zinc-50 pt-1 pb-1">
                  ${g.concepts.slice().sort((a,b)=>a.name.localeCompare(b.name)).map(conceptRow).join('')}
                </div>
              </div>`).join('')}
          </div>`;

        if (window.lucide) window.lucide.createIcons();
        attachConcepts(resultsEl);
    }

    function attachConcepts(root) {
        root.querySelectorAll('.cs-concept').forEach(btn => {
            btn.addEventListener('click', () => {
                store.setState({ selectedConceptId: btn.getAttribute('data-cid') });
            });
        });
        if (window.lucide) window.lucide.createIcons({ nodes: root.querySelectorAll('[data-lucide]') });
    }

    // ── Init ───────────────────────────────────────────────────────────────────
    renderBrowse();

    let debounce;
    searchInput.addEventListener('input', e => {
        const v = e.target.value.trim();
        clearBtn.classList.toggle('hidden', !v);
        clearTimeout(debounce);
        debounce = setTimeout(() => v.length >= 2 ? renderSearch(v) : renderBrowse(), 280);
    });

    clearBtn.addEventListener('click', () => {
        searchInput.value = '';
        clearBtn.classList.add('hidden');
        renderBrowse();
        searchInput.focus();
    });
}
