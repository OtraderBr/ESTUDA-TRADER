// js/engine.js
// Lógica de negócios central: mescla os dados do CSV com o localStorage e expõe as ações
import { store } from './state.js';
import { loadConcepts } from './csvService.js';

// ---- Helpers ----

function inferMacroCategory(category, subcategory) {
    const text = `${category} ${subcategory}`.toLowerCase();

    if (text.includes('matemática') || text.includes('probabilidade') || text.includes('risco') ||
        text.includes('alvo') || text.includes('equação') || text.includes('edge')) {
        return 'Probabilidades';
    }

    if (text.includes('regra') || text.includes('psicologia') || text.includes('comportamento') ||
        text.includes('gerenciamento') || text.includes('disciplina')) {
        return 'Regras';
    }

    if (text.includes('setup') || text.includes('entrada') || text.includes('sinal') ||
        text.includes('padrão') || text.includes('reversão') || text.includes('gatilho') ||
        text.includes('execução') || text.includes('ordem') || text.includes('estratégia')) {
        return 'Operacional';
    }

    return 'Fundamento';
}

function calculateMetrics(evaluations = []) {
    if (evaluations.length === 0) {
        return { masteryPercentage: 0, nextReview: new Date().toISOString() };
    }

    const latest = evaluations[0];
    const masteryPercentage = Math.round((latest.flashcardScore + latest.quizScore) / 2);

    let daysToAdd = 1;
    if (masteryPercentage >= 85) {
        daysToAdd = 7;
    } else if (masteryPercentage >= 50) {
        daysToAdd = 3;
    }

    const nextReviewDate = new Date();
    nextReviewDate.setDate(nextReviewDate.getDate() + daysToAdd);

    return {
        masteryPercentage,
        nextReview: nextReviewDate.toISOString()
    };
}

// ---- Modificadores de Estado (Persistência) ----

export function saveToStorage(updatedConcepts) {
    const progressMap = updatedConcepts.reduce((acc, c) => {
        acc[c.name] = {
            level: c.level,
            importance: c.importance,
            notesList: c.notesList,
            evaluations: c.evaluations,
            lastStudied: c.lastStudied,
            nextReview: c.nextReview,
            masteryPercentage: c.masteryPercentage,
            abcCategory: c.abcCategory,
            macroCategory: c.macroCategory
        };
        return acc;
    }, {});
    localStorage.setItem('brooks_progress_v4', JSON.stringify(progressMap));
}

export function saveSessionsToStorage(updatedSessions) {
    localStorage.setItem('brooks_sessions_v1', JSON.stringify(updatedSessions));
}

// ---- Ações Públicas ----

export async function initializeEngine() {
    const loadedConcepts = await loadConcepts();
    let finalConcepts = [];

    // Load saved progress from localStorage (v4)
    const savedProgress = localStorage.getItem('brooks_progress_v4');
    if (savedProgress) {
        const progressMap = JSON.parse(savedProgress);
        finalConcepts = loadedConcepts.map(c => {
            const savedData = progressMap[c.name];
            if (savedData) {
                return {
                    ...c,
                    level: savedData.level !== undefined ? savedData.level : c.level,
                    importance: savedData.importance,
                    notesList: savedData.notesList || [],
                    evaluations: savedData.evaluations || [],
                    lastStudied: savedData.lastStudied || '',
                    nextReview: savedData.nextReview || '',
                    masteryPercentage: savedData.masteryPercentage || 0,
                    abcCategory: savedData.abcCategory || 'C',
                    macroCategory: savedData.macroCategory || inferMacroCategory(c.category, c.subcategory)
                };
            }
            return { ...c, macroCategory: inferMacroCategory(c.category, c.subcategory) };
        });
    } else {
        // Tenta migrar da V3
        const oldProgress = localStorage.getItem('brooks_progress_v3');
        if (oldProgress) {
            const oldMap = JSON.parse(oldProgress);
            finalConcepts = loadedConcepts.map(c => {
                const oldData = oldMap[c.name];
                if (oldData) {
                    return {
                        ...c,
                        level: oldData.level !== undefined ? oldData.level : c.level,
                        importance: oldData.importance,
                        notesList: oldData.notesList || [],
                        evaluations: oldData.evaluations || [],
                        lastStudied: oldData.lastStudied || '',
                        nextReview: oldData.nextReview || '',
                        masteryPercentage: oldData.masteryPercentage || 0,
                        abcCategory: oldData.abcCategory || 'C',
                        macroCategory: inferMacroCategory(c.category, c.subcategory)
                    };
                }
                return { ...c, macroCategory: inferMacroCategory(c.category, c.subcategory) };
            });
        } else {
            finalConcepts = loadedConcepts.map(c => ({ ...c, macroCategory: inferMacroCategory(c.category, c.subcategory) }));
        }
    }

    // Load Sessions
    let finalSessions = [];
    const savedSessions = localStorage.getItem('brooks_sessions_v1');
    if (savedSessions) {
        finalSessions = JSON.parse(savedSessions);
    }

    // Define o estado inicial pronto!
    store.setState({
        concepts: finalConcepts,
        sessions: finalSessions,
        loading: false
    });
}

// Ações sobre Conceitos
export function addNote(conceptName, type, text) {
    const { concepts } = store.getState();
    const updatedConcepts = concepts.map(c => {
        if (c.name === conceptName) {
            const newNote = {
                id: Date.now().toString(),
                date: new Date().toISOString(),
                type,
                text
            };
            return {
                ...c,
                notesList: [newNote, ...(c.notesList || [])],
                lastStudied: new Date().toISOString()
            };
        }
        return c;
    });

    store.setState({ concepts: updatedConcepts });
    saveToStorage(updatedConcepts);
}

export function addEvaluation(conceptName, flashcardScore, quizScore, explanation) {
    const { concepts } = store.getState();
    const updatedConcepts = concepts.map(c => {
        if (c.name === conceptName) {
            const newEvaluation = {
                id: Date.now().toString(),
                date: new Date().toISOString(),
                flashcardScore,
                quizScore,
                explanation
            };
            const newEvaluations = [newEvaluation, ...(c.evaluations || [])];
            const metrics = calculateMetrics(newEvaluations);

            return {
                ...c,
                evaluations: newEvaluations,
                lastStudied: new Date().toISOString(),
                masteryPercentage: metrics.masteryPercentage,
                nextReview: metrics.nextReview
            };
        }
        return c;
    });

    store.setState({ concepts: updatedConcepts });
    saveToStorage(updatedConcepts);
}

export function updateImportance(conceptName, importance) {
    const { concepts } = store.getState();
    const updatedConcepts = concepts.map(c => c.name === conceptName ? { ...c, importance } : c);
    store.setState({ concepts: updatedConcepts });
    saveToStorage(updatedConcepts);
}

export function updateABC(conceptName, abcCategory) {
    const { concepts } = store.getState();
    const updatedConcepts = concepts.map(c => c.name === conceptName ? { ...c, abcCategory } : c);
    store.setState({ concepts: updatedConcepts });
    saveToStorage(updatedConcepts);
}

export function updateMacroCategory(conceptName, macroCategory) {
    const { concepts } = store.getState();
    const updatedConcepts = concepts.map(c => c.name === conceptName ? { ...c, macroCategory } : c);
    store.setState({ concepts: updatedConcepts });
    saveToStorage(updatedConcepts);
}

// Ações sobre Sessões
export function addSessionAction(title, type, date, conceptIds) {
    const { sessions } = store.getState();
    const newSession = {
        id: Date.now().toString(),
        title,
        type,
        date,
        conceptIds,
        completed: false
    };
    const updatedSessions = [newSession, ...sessions];
    store.setState({ sessions: updatedSessions });
    saveSessionsToStorage(updatedSessions);
}

export function toggleSessionComplete(sessionId) {
    const { sessions } = store.getState();
    const updatedSessions = sessions.map(s =>
        s.id === sessionId ? { ...s, completed: !s.completed } : s
    );
    store.setState({ sessions: updatedSessions });
    saveSessionsToStorage(updatedSessions);
}

export function deleteSession(sessionId) {
    const { sessions } = store.getState();
    const updatedSessions = sessions.filter(s => s.id !== sessionId);
    store.setState({ sessions: updatedSessions });
    saveSessionsToStorage(updatedSessions);
}

// Derivações de Estado (Selectors)
export function getUnlockedConcepts() {
    const { concepts } = store.getState();
    return concepts.filter(c => {
        if (c.prerequisite === 'Nenhum' || !c.prerequisite) return true;
        const prereq = concepts.find(p => p.name === c.prerequisite);
        return prereq && ((prereq.masteryPercentage || 0) >= 50 || prereq.level >= 7);
    });
}

export function getCategoryProgress() {
    const { concepts } = store.getState();
    const categories = Array.from(new Set(concepts.map(c => c.category)));
    return categories.map(cat => {
        const catConcepts = concepts.filter(c => c.category === cat);
        const totalMastery = catConcepts.reduce((sum, c) => sum + (c.masteryPercentage || 0), 0);
        const maxMastery = catConcepts.length * 100;
        return {
            category: cat,
            progress: maxMastery > 0 ? (totalMastery / maxMastery) * 100 : 0,
            completed: catConcepts.filter(c => (c.masteryPercentage || 0) >= 85).length,
            total: catConcepts.length
        };
    });
}
