// js/dataService.js
// Camada de acesso a dados: busca conceitos do banco e expõe CRUD
// para todas as tabelas do Motor Brooks v3.
import { supabase } from './supabaseClient.js';

// ─── CONCEITOS (tabela existente, somente leitura) ───────────────────────────

export async function loadConcepts() {
    try {
        const { data, error } = await supabase
            .from('conceitos')
            .select('*')
            .order('id', { ascending: true });

        if (error) throw new Error(`Erro ao buscar conceitos: ${error.message}`);

        return data.map(row => ({
            dbId: row.id,
            id: row.conceito.trim(),
            name: row.conceito.trim(),
            category: row.categoria ? row.categoria.trim() : 'Geral',
            subcategory: row.subcategoria ? row.subcategoria.trim() : '',
            prerequisite: row.prerequisito ? row.prerequisito.trim() : 'Nenhum',
            level: 0,
            macroCategoryStr: row.macro_categoria || '',
            moduloCurso: row.modulo_curso || '',
            conhecimentoAtual: row.conhecimento_atual || 0,
            objetivo: row.objetivo || 10,
            fonteEstudo: row.fonte_estudo || '',
            regrasOperacionais: row.regras_operacionais || '',
            probabilidade: row.probabilidade || '',
            mercadoAplicavel: row.mercado_aplicavel || '',
            notasBD: row.notas || ''
        }));
    } catch (err) {
        console.error('loadConcepts failed:', err);
        return [];
    }
}

// ─── USER_CONCEPT_PROGRESS ────────────────────────────────────────────────────

/**
 * Busca todos os registros de progresso.
 * @returns {Promise<Array>}
 */
export async function getAllProgress() {
    const { data, error } = await supabase
        .from('user_concept_progress')
        .select('*');
    if (error) { console.error('getAllProgress:', error); return []; }
    return data;
}

/**
 * Cria ou atualiza o progresso de um conceito.
 * @param {string} conceitoName
 * @param {Object} fields - campos a atualizar
 */
export async function upsertProgress(conceitoName, fields) {
    const { error } = await supabase
        .from('user_concept_progress')
        .upsert(
            { conceito_name: conceitoName, ...fields, updated_at: new Date().toISOString() },
            { onConflict: 'conceito_name' }
        );
    if (error) console.error('upsertProgress:', error);
}

// ─── CONCEPT_NOTES ────────────────────────────────────────────────────────────

/**
 * Busca todas as notas de todos os conceitos.
 * @returns {Promise<Array>}
 */
export async function getAllNotes() {
    const { data, error } = await supabase
        .from('concept_notes')
        .select('*')
        .order('created_at', { ascending: false });
    if (error) { console.error('getAllNotes:', error); return []; }
    return data;
}

/**
 * Insere uma nova anotação (tipos: Anotação, Dúvida, Pergunta, Questionamento, Observação de Tela).
 * @param {string} conceitoName
 * @param {string} type
 * @param {string} html - conteúdo HTML
 * @param {string} text - conteúdo plain-text para busca
 */
export async function addNote(conceitoName, type, html, text) {
    const { error } = await supabase
        .from('concept_notes')
        .insert({ conceito_name: conceitoName, type, content_html: html, content_text: text });
    if (error) console.error('addNote:', error);
}

/**
 * Cria ou atualiza a Descrição principal do conceito (tipo 'Descrição', único por conceito).
 * @param {string} conceitoName
 * @param {string} html
 * @param {string} text
 */
export async function upsertConceptDescription(conceitoName, html, text) {
    // Tenta buscar se já existe uma Descrição
    const { data: existing } = await supabase
        .from('concept_notes')
        .select('id')
        .eq('conceito_name', conceitoName)
        .eq('type', 'Descrição')
        .maybeSingle();

    if (existing) {
        const { error } = await supabase
            .from('concept_notes')
            .update({ content_html: html, content_text: text, updated_at: new Date().toISOString() })
            .eq('id', existing.id);
        if (error) console.error('upsertConceptDescription update:', error);
    } else {
        const { error } = await supabase
            .from('concept_notes')
            .insert({ conceito_name: conceitoName, type: 'Descrição', content_html: html, content_text: text });
        if (error) console.error('upsertConceptDescription insert:', error);
    }
}

// ─── CONCEPT_EVALUATIONS ──────────────────────────────────────────────────────

/**
 * Busca todas as avaliações de todos os conceitos.
 * @returns {Promise<Array>}
 */
export async function getAllEvaluations() {
    const { data, error } = await supabase
        .from('concept_evaluations')
        .select('*')
        .order('created_at', { ascending: false });
    if (error) { console.error('getAllEvaluations:', error); return []; }
    return data;
}

/**
 * Insere uma nova avaliação.
 * @param {string} conceitoName
 * @param {number} flashcardScore - 0-100
 * @param {number} selfScore - autoavaliação Feynman 0-100
 * @param {string} explanation
 * @param {number} masteryAtTime - mastery_percentage no momento da avaliação
 * @param {number} sm2Quality - 0-5
 */
export async function addEvaluation(conceitoName, flashcardScore, selfScore, explanation, masteryAtTime, sm2Quality) {
    const { error } = await supabase
        .from('concept_evaluations')
        .insert({
            conceito_name: conceitoName,
            flashcard_score: flashcardScore,
            self_score: selfScore,
            explanation,
            mastery_at_time: masteryAtTime,
            sm2_quality: sm2Quality
        });
    if (error) console.error('addEvaluation:', error);
}

// ─── STUDY_SESSIONS ───────────────────────────────────────────────────────────

/**
 * Busca todas as sessões com seus conceitos vinculados.
 * @returns {Promise<Array>} Array de sessões com campo conceptIds[]
 */
export async function getAllSessions() {
    const { data: sessions, error: sErr } = await supabase
        .from('study_sessions')
        .select('*')
        .order('scheduled_date', { ascending: true });
    if (sErr) { console.error('getAllSessions:', sErr); return []; }

    const { data: links, error: lErr } = await supabase
        .from('session_concepts')
        .select('session_id, conceito_name');
    if (lErr) { console.error('getAllSessions links:', lErr); return sessions; }

    const linkMap = {};
    links.forEach(l => {
        if (!linkMap[l.session_id]) linkMap[l.session_id] = [];
        linkMap[l.session_id].push(l.conceito_name);
    });

    return sessions.map(s => ({
        id: s.id,
        title: s.title,
        type: s.type,
        date: s.scheduled_date,
        completed: !!s.completed_at,
        completedAt: s.completed_at,
        conceptIds: linkMap[s.id] || []
    }));
}

/**
 * Cria uma nova sessão de estudo e vincula os conceitos.
 * @param {string} title
 * @param {string} type
 * @param {string} date - formato YYYY-MM-DD
 * @param {string[]} conceptNames
 * @returns {Promise<string|null>} ID da sessão criada, ou null em caso de erro
 */
export async function createSession(title, type, date, conceptNames) {
    const { data, error } = await supabase
        .from('study_sessions')
        .insert({ title, type, scheduled_date: date })
        .select('id')
        .single();
    if (error) { console.error('createSession:', error); return null; }

    if (conceptNames.length > 0) {
        const links = conceptNames.map(name => ({ session_id: data.id, conceito_name: name }));
        const { error: lErr } = await supabase.from('session_concepts').insert(links);
        if (lErr) console.error('createSession links:', lErr);
    }

    return data.id;
}

/**
 * Marca ou desmarca uma sessão como concluída.
 * @param {string} sessionId
 * @param {boolean} completed
 */
export async function setSessionCompleted(sessionId, completed) {
    const { error } = await supabase
        .from('study_sessions')
        .update({ completed_at: completed ? new Date().toISOString() : null })
        .eq('id', sessionId);
    if (error) console.error('setSessionCompleted:', error);
}

/**
 * Deleta uma sessão (CASCADE apaga session_concepts automaticamente).
 * @param {string} sessionId
 */
export async function deleteSessionById(sessionId) {
    const { error } = await supabase
        .from('study_sessions')
        .delete()
        .eq('id', sessionId);
    if (error) console.error('deleteSessionById:', error);
}

/**
 * Verifica se já existe algum progresso no Supabase.
 * Usado por migrateIfNeeded() para detectar se a migração já foi feita.
 * @returns {Promise<boolean>}
 */
export async function hasAnyProgress() {
    const { count, error } = await supabase
        .from('user_concept_progress')
        .select('*', { count: 'exact', head: true });
    if (error) return false;
    return (count || 0) > 0;
}
