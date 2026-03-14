// js/engine.js
// Motor central: mescla dados do DB com progresso, expõe ações de negócio.
// v3: persistência migrada para Supabase. localStorage = cache de Edge Functions.
import { store } from './state.js';
import { loadConcepts, getAllProgress, getAllNotes, getAllEvaluations,
         getAllSessions, upsertProgress, addNote as dbAddNote,
         addEvaluation as dbAddEvaluation, upsertConceptDescription,
         createSession, setSessionCompleted, deleteSessionById,
         hasAnyProgress, deleteNoteById, deleteEvaluationById } from './dataService.js';
import { buildGraphDataFromConcepts } from './graph.js';
import { applySM2, calculateQuality, calculateMastery } from './sm2.js';
import { bustPlanCache } from './daily-plan.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function inferMacroCategory(category, subcategory) {
    const text = `${category} ${subcategory}`.toLowerCase();
    if (text.includes('matemática') || text.includes('probabilidade') || text.includes('risco') ||
        text.includes('alvo') || text.includes('equação') || text.includes('edge'))
        return 'Probabilidades';
    if (text.includes('regra') || text.includes('psicologia') || text.includes('comportamento') ||
        text.includes('gerenciamento') || text.includes('disciplina'))
        return 'Regras';
    if (text.includes('setup') || text.includes('entrada') || text.includes('sinal') ||
        text.includes('padrão') || text.includes('reversão') || text.includes('gatilho') ||
        text.includes('execução') || text.includes('ordem') || text.includes('estratégia'))
        return 'Operacional';
    return 'Fundamento';
}

// ─── Migração única do localStorage para Supabase ────────────────────────────

async function migrateIfNeeded() {
    if (await hasAnyProgress()) return;

    const raw = localStorage.getItem('brooks_progress_v4');
    if (!raw) return;

    console.log('[Migration] Iniciando migração do localStorage para Supabase...');
    const progressMap = JSON.parse(raw);

    for (const [name, data] of Object.entries(progressMap)) {
        await upsertProgress(name, {
            abc_category:      data.abcCategory || 'B',
            macro_category:    data.macroCategory || 'Fundamento',
            importance:        data.importance || 'Média',
            mastery_percentage: data.masteryPercentage || 0,
            last_studied_at:   data.lastStudied || null,
            next_review_at:    data.nextReview || null,
        });

        if (data.notesList && data.notesList.length > 0) {
            for (const note of data.notesList) {
                const html = `<p>${note.text.replace(/\n/g, '</p><p>')}</p>`;
                await dbAddNote(name, note.type, html, note.text);
            }
        }

        if (data.evaluations && data.evaluations.length > 0) {
            for (const ev of data.evaluations) {
                const fs = ev.flashcardScore || 0;
                const ss = ev.quizScore || 0;
                const quality = calculateQuality(fs, ss);
                await dbAddEvaluation(name, fs, ss, ev.explanation || '', ev.masteryPercentage || 0, quality);
            }
        }
    }

    const rawSessions = localStorage.getItem('brooks_sessions_v1');
    if (rawSessions) {
        const sessions = JSON.parse(rawSessions);
        for (const s of sessions) {
            await createSession(s.title, s.type, s.date, s.conceptIds || []);
        }
    }

    localStorage.setItem('v3_migrated', 'true');
    console.log('[Migration] Concluída com sucesso.');
}

// ─── Motor ABC: Retenção baseada em categorização ──────────────────────────────
function getMasteryFromABC(abcCategory) {
    const map = { A: 90, B: 55, C: 15, D: 100, E: 0 };
    return map[abcCategory] ?? 15;
}

function getNextReviewFromABC(abcCategory) {
    const days = { A: 30, B: 7, C: 1 }[abcCategory];
    if (!days) return null;
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString();
}

// ─── Inicialização ────────────────────────────────────────────────────────────

export async function initializeEngine() {
    await migrateIfNeeded();

    const [loadedConcepts, progressData, allNotes, allEvals, sessions] = await Promise.all([
        loadConcepts(),
        getAllProgress(),
        getAllNotes(),
        getAllEvaluations(),
        getAllSessions()
    ]);

    const progressMap = Object.fromEntries(progressData.map(p => [p.conceito_name, p]));

    const notesMap = {};
    const descriptionsMap = {};
    allNotes.forEach(note => {
        if (note.type === 'Descrição') {
            descriptionsMap[note.conceito_name] = note;
        } else {
            if (!notesMap[note.conceito_name]) notesMap[note.conceito_name] = [];
            notesMap[note.conceito_name].push(note);
        }
    });

    const evalsMap = {};
    allEvals.forEach(ev => {
        if (!evalsMap[ev.conceito_name]) evalsMap[ev.conceito_name] = [];
        evalsMap[ev.conceito_name].push(ev);
    });

    const finalConcepts = loadedConcepts.map(c => {
        const p = progressMap[c.name] || {};
        return {
            ...c,
            abcCategory:       p.abc_category || 'B',
            macroCategory:     p.macro_category || c.macroCategoryStr || inferMacroCategory(c.category, c.subcategory),
            importance:        p.importance || 'Média',
            masteryPercentage: getMasteryFromABC(p.abc_category || 'C'),
            lastStudied:       p.last_studied_at || '',
            nextReview:        p.next_review_at || '',
            sm2EaseFactor:     p.sm2_ease_factor || 2.5,
            sm2Interval:       p.sm2_interval || 1,
            sm2Repetitions:    p.sm2_repetitions || 0,
            tags:              p.tags || [],
            notesList:         notesMap[c.name] || [],
            description:       descriptionsMap[c.name] || null,
            evaluations:       evalsMap[c.name] || [],
        };
    });

    const { graphNodes, graphEdges } = buildGraphDataFromConcepts(finalConcepts);
    store.setState({ concepts: finalConcepts, sessions, graphNodes, graphEdges, loading: false });
}

// ─── Ações sobre Conceitos ────────────────────────────────────────────────────

export async function addNote(conceptName, type, text) {
    const html = `<p>${text.replace(/\n/g, '</p><p>')}</p>`;
    await dbAddNote(conceptName, type, html, text);

    const { concepts } = store.getState();
    const newNote = {
        id: Date.now().toString(),
        conceito_name: conceptName,
        type,
        content_html: html,
        content_text: text,
        created_at: new Date().toISOString()
    };
    const updatedConcepts = concepts.map(c => {
        if (c.name !== conceptName) return c;
        return { ...c, notesList: [newNote, ...(c.notesList || [])], lastStudied: new Date().toISOString() };
    });
    store.setState({ concepts: updatedConcepts });

    await upsertProgress(conceptName, { last_studied_at: new Date().toISOString() });
}

export async function deleteNote(conceptName, noteId) {
    await deleteNoteById(noteId);
    const { concepts } = store.getState();
    store.setState({
        concepts: concepts.map(c => c.name !== conceptName ? c : {
            ...c,
            notesList: (c.notesList || []).filter(n => String(n.id) !== String(noteId))
        })
    });
}

export async function addEvaluation(conceptName, flashcardScore, selfScore, explanation) {
    const { concepts } = store.getState();
    const concept = concepts.find(c => c.name === conceptName);
    if (!concept) return;

    const quality = calculateQuality(flashcardScore, selfScore);
    const mastery = calculateMastery(flashcardScore, selfScore);

    const sm2Result = applySM2({
        sm2_ease_factor: concept.sm2EaseFactor || 2.5,
        sm2_interval:    concept.sm2Interval || 1,
        sm2_repetitions: concept.sm2Repetitions || 0
    }, quality);

    const now = new Date().toISOString();

    await dbAddEvaluation(conceptName, flashcardScore, selfScore, explanation, mastery, quality);

    await upsertProgress(conceptName, {
        last_studied_at:    now,
        next_review_at:     sm2Result.next_review_at.toISOString(),
        sm2_ease_factor:    sm2Result.sm2_ease_factor,
        sm2_interval:       sm2Result.sm2_interval,
        sm2_repetitions:    sm2Result.sm2_repetitions
    });

    bustPlanCache();

    const newEvaluation = {
        id: Date.now().toString(),
        conceito_name: conceptName,
        flashcard_score: flashcardScore,
        self_score: selfScore,
        explanation,
        mastery_at_time: mastery,
        sm2_quality: quality,
        created_at: now
    };

    const updatedConcepts = concepts.map(c => {
        if (c.name !== conceptName) return c;
        return {
            ...c,
            evaluations:       [newEvaluation, ...(c.evaluations || [])],
            lastStudied:       now,
            nextReview:        sm2Result.next_review_at.toISOString(),
            sm2EaseFactor:     sm2Result.sm2_ease_factor,
            sm2Interval:       sm2Result.sm2_interval,
            sm2Repetitions:    sm2Result.sm2_repetitions
        };
    });
    store.setState({ concepts: updatedConcepts });
}

export async function deleteEvaluation(conceptName, evalId) {
    await deleteEvaluationById(evalId);
    const { concepts } = store.getState();
    store.setState({
        concepts: concepts.map(c => c.name !== conceptName ? c : {
            ...c,
            evaluations: (c.evaluations || []).filter(e => String(e.id) !== String(evalId))
        })
    });
}

export async function updateImportance(conceptName, importance) {
    await upsertProgress(conceptName, { importance });
    const { concepts } = store.getState();
    store.setState({ concepts: concepts.map(c => c.name === conceptName ? { ...c, importance } : c) });
}

export async function updateABC(conceptName, abcCategory) {
    const mastery = getMasteryFromABC(abcCategory);
    const nextReview = getNextReviewFromABC(abcCategory);
    const fields = { abc_category: abcCategory, mastery_percentage: mastery };
    if (nextReview) fields.next_review_at = nextReview;
    await upsertProgress(conceptName, fields);
    const { concepts } = store.getState();
    store.setState({
        concepts: concepts.map(c => c.name === conceptName ? {
            ...c,
            abcCategory,
            masteryPercentage: mastery,
            ...(nextReview ? { nextReview } : {})
        } : c)
    });
    bustPlanCache();
}

export async function updateMacroCategory(conceptName, macroCategory) {
    await upsertProgress(conceptName, { macro_category: macroCategory });
    const { concepts } = store.getState();
    store.setState({ concepts: concepts.map(c => c.name === conceptName ? { ...c, macroCategory } : c) });
}

export async function updateTags(conceptName, tags) {
    await upsertProgress(conceptName, { tags });
    const { concepts } = store.getState();
    store.setState({ concepts: concepts.map(c => c.name === conceptName ? { ...c, tags } : c) });
}

// ─── Ações sobre Sessões ──────────────────────────────────────────────────────

export async function addSessionAction(title, type, date, conceptNames) {
    const id = await createSession(title, type, date, conceptNames);
    if (!id) return;

    const newSession = { id, title, type, date, completed: false, completedAt: null, conceptIds: conceptNames };
    const { sessions } = store.getState();
    store.setState({ sessions: [newSession, ...sessions] });
}

export async function toggleSessionComplete(sessionId) {
    const { sessions } = store.getState();
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;

    const nowCompleted = !session.completed;
    await setSessionCompleted(sessionId, nowCompleted);
    if (nowCompleted) bustPlanCache();

    store.setState({
        sessions: sessions.map(s =>
            s.id === sessionId ? { ...s, completed: nowCompleted, completedAt: nowCompleted ? new Date().toISOString() : null } : s
        )
    });
}

export async function deleteSession(sessionId) {
    await deleteSessionById(sessionId);
    const { sessions } = store.getState();
    store.setState({ sessions: sessions.filter(s => s.id !== sessionId) });
}

// ─── Seletores ────────────────────────────────────────────────────────────────

export function getUnlockedConcepts() {
    const { concepts } = store.getState();
    // D e E são excluídos do "precisa ser estudado"
    return concepts.filter(c => {
        if (c.abcCategory === 'D' || c.abcCategory === 'E') return false;
        if ((c.masteryPercentage || 0) >= 85) return false;
        if (c.prerequisite === 'Nenhum' || !c.prerequisite) return true;
        const prereq = concepts.find(p => p.name === c.prerequisite);
        // D conta como pré-requisito satisfeito
        if (prereq && (prereq.abcCategory === 'D')) return true;
        return prereq && ((prereq.masteryPercentage || 0) >= 50 || prereq.level >= 7);
    });
}

export function getCategoryProgress() {
    const { concepts } = store.getState();
    // Exclui conceitos E dos cálculos
    const activeConcepts = concepts.filter(c => c.abcCategory !== 'E');
    const categories = Array.from(new Set(activeConcepts.map(c => c.category)));
    return categories.map(cat => {
        const catConcepts = activeConcepts.filter(c => c.category === cat);
        // D conta como 100% de domínio
        const totalMastery = catConcepts.reduce((sum, c) => {
            const mastery = c.abcCategory === 'D' ? 100 : (c.masteryPercentage || 0);
            return sum + mastery;
        }, 0);
        const maxMastery = catConcepts.length * 100;
        return {
            category: cat,
            progress: maxMastery > 0 ? (totalMastery / maxMastery) * 100 : 0,
            completed: catConcepts.filter(c => c.abcCategory === 'D' || (c.masteryPercentage || 0) >= 85).length,
            total: catConcepts.length
        };
    });
}
