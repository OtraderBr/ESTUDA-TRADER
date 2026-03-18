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
            aulaCurso: row.aula_curso || '',
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
        .order('scheduled_date', { ascending: false });
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
        conceptIds: linkMap[s.id] || [],
        elapsedSeconds: s.elapsed_seconds || 0,
        timerState: s.timer_state || 'stopped',
        timerStartedAt: s.timer_started_at || null,
        notes: s.notes || ''
    }));
}

/**
 * Atualiza o estado do timer de uma sessão.
 * @param {string} sessionId
 * @param {number} elapsedSeconds
 * @param {string} timerState - 'playing' | 'paused' | 'stopped'
 * @param {string|null} timerStartedAt - ISO timestamp ou null
 */
export async function updateSessionTimer(sessionId, elapsedSeconds, timerState, timerStartedAt) {
    const { error } = await supabase
        .from('study_sessions')
        .update({ elapsed_seconds: elapsedSeconds, timer_state: timerState, timer_started_at: timerStartedAt })
        .eq('id', sessionId);
    if (error) console.error('updateSessionTimer:', error);
}

/**
 * Atualiza as notas de uma sessão.
 * @param {string} sessionId
 * @param {string} notes
 */
export async function updateSessionNotes(sessionId, notes) {
    const { error } = await supabase
        .from('study_sessions')
        .update({ notes })
        .eq('id', sessionId);
    if (error) console.error('updateSessionNotes:', error);
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

// ─── FREE_NOTES ───────────────────────────────────────────────────────────────

/**
 * Busca toda a árvore de notas livres (sem content_html para performance na sidebar).
 * @returns {Promise<Array>}
 */
export async function getAllFreeNotes() {
    const { data, error } = await supabase
        .from('free_notes')
        .select('id, title, emoji, parent_id, sort_order, created_at, updated_at')
        .order('sort_order', { ascending: true });
    if (error) { console.error('getAllFreeNotes:', error); return []; }
    return data;
}

/**
 * Busca uma nota individual com conteúdo completo.
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
export async function getFreeNoteById(id) {
    const { data, error } = await supabase
        .from('free_notes')
        .select('*')
        .eq('id', id)
        .single();
    if (error) { console.error('getFreeNoteById:', error); return null; }
    return data;
}

/**
 * Cria uma nova nota livre.
 * @param {Object} fields - { title, emoji, parent_id, sort_order }
 * @returns {Promise<Object|null>}
 */
export async function createFreeNote(fields = {}) {
    const { data, error } = await supabase
        .from('free_notes')
        .insert({
            title: fields.title || 'Sem título',
            emoji: fields.emoji || '',
            parent_id: fields.parent_id || null,
            sort_order: fields.sort_order || 0,
            content_html: '',
            content_text: ''
        })
        .select()
        .single();
    if (error) { console.error('createFreeNote:', error); return null; }
    return data;
}

/**
 * Atualiza título/emoji de uma nota livre.
 * @param {string} id
 * @param {Object} fields - { title?, emoji? }
 */
export async function updateFreeNoteMetadata(id, fields) {
    const { error } = await supabase
        .from('free_notes')
        .update({ ...fields, updated_at: new Date().toISOString() })
        .eq('id', id);
    if (error) console.error('updateFreeNoteMetadata:', error);
}

/**
 * Salva o conteúdo de uma nota livre (auto-save do editor).
 * @param {string} id
 * @param {string} content_html
 * @param {string} content_text
 */
export async function saveFreeNoteContent(id, content_html, content_text) {
    const { error } = await supabase
        .from('free_notes')
        .update({ content_html, content_text, updated_at: new Date().toISOString() })
        .eq('id', id);
    if (error) console.error('saveFreeNoteContent:', error);
}

/**
 * Deleta uma nota livre (CASCADE apaga sub-páginas automaticamente).
 * @param {string} id
 */
export async function deleteFreeNote(id) {
    const { error } = await supabase
        .from('free_notes')
        .delete()
        .eq('id', id);
    if (error) console.error('deleteFreeNote:', error);
}

/**
 * Deleta uma nota pelo ID.
 * @param {string|number} id
 */
export async function deleteNoteById(id) {
    const { error } = await supabase
        .from('concept_notes')
        .delete()
        .eq('id', id);
    if (error) console.error('deleteNoteById:', error);
}

/**
 * Deleta uma avaliação pelo ID.
 * @param {string|number} id
 */
export async function deleteEvaluationById(id) {
    const { error } = await supabase
        .from('concept_evaluations')
        .delete()
        .eq('id', id);
    if (error) console.error('deleteEvaluationById:', error);
}

// ─── CONCEPT_IMAGES ───────────────────────────────────────────────────────────

/**
 * Busca todas as imagens de um conceito.
 * @param {string} conceitoName
 * @returns {Promise<Array>}
 */
export async function getConceptImages(conceitoName) {
    const { data, error } = await supabase
        .from('concept_images')
        .select('*')
        .eq('conceito_name', conceitoName)
        .order('created_at', { ascending: false });
    if (error) { console.error('getConceptImages:', error); return []; }
    return data;
}

// ─── CANVAS MAPS (Mapeamento Visual) ──────────────────────────────────────────

/**
 * Busca todos os canvas maps do usuário.
 * @returns {Promise<Array>}
 */
export async function getAllCanvasMaps() {
    const { data, error } = await supabase
        .from('canvas_maps')
        .select('*')
        .order('updated_at', { ascending: false });
    if (error) { console.error('getAllCanvasMaps:', error); return []; }
    return data;
}

/**
 * Cria um novo canvas map.
 * @param {Object} fields - { title, tags, description, thumbnail, viewport_x, viewport_y, viewport_scale }
 * @returns {Promise<Object|null>}
 */
export async function createCanvasMap(fields = {}) {
    const { data, error } = await supabase
        .from('canvas_maps')
        .insert({
            title: fields.title || 'Novo mapa',
            tags: fields.tags || [],
            description: fields.description || '',
            thumbnail: fields.thumbnail || '',
            viewport_x: fields.viewport_x ?? 0,
            viewport_y: fields.viewport_y ?? 0,
            viewport_scale: fields.viewport_scale ?? 1
        })
        .select()
        .single();
    if (error) { console.error('createCanvasMap:', error); return null; }
    return data;
}

/**
 * Atualiza um canvas map existente.
 * @param {string} mapId
 * @param {Object} fields
 */
export async function updateCanvasMap(mapId, fields) {
    const { error } = await supabase
        .from('canvas_maps')
        .update({ ...fields, updated_at: new Date().toISOString() })
        .eq('id', mapId);
    if (error) console.error('updateCanvasMap:', error);
}

/**
 * Deleta um canvas map (CASCADE apaga nodes e edges).
 * @param {string} mapId
 */
export async function deleteCanvasMap(mapId) {
    const { error } = await supabase
        .from('canvas_maps')
        .delete()
        .eq('id', mapId);
    if (error) console.error('deleteCanvasMap:', error);
}

/**
 * Busca todos os nodes de um canvas map.
 * @param {string} mapId
 * @returns {Promise<Array>}
 */
export async function getCanvasNodes(mapId) {
    const { data, error } = await supabase
        .from('canvas_nodes')
        .select('*')
        .eq('map_id', mapId)
        .order('z_index', { ascending: true });
    if (error) { console.error('getCanvasNodes:', error); return []; }
    return data;
}

/**
 * Cria um novo node no canvas.
 * @param {string} mapId
 * @param {Object} fields - { type, x, y, width, height, z_index, data }
 * @returns {Promise<Object|null>}
 */
export async function createCanvasNode(mapId, fields = {}) {
    const { data, error } = await supabase
        .from('canvas_nodes')
        .insert({
            map_id: mapId,
            type: fields.type || 'concept',
            x: fields.x ?? 100,
            y: fields.y ?? 100,
            width: fields.width ?? 160,
            height: fields.height ?? 60,
            z_index: fields.z_index ?? 0,
            data: fields.data || {}
        })
        .select()
        .single();
    if (error) { console.error('createCanvasNode:', error); return null; }
    return data;
}

/**
 * Atualiza um node existente.
 * @param {string} nodeId
 * @param {Object} fields
 */
export async function updateCanvasNode(nodeId, fields) {
    const { error } = await supabase
        .from('canvas_nodes')
        .update({ ...fields })
        .eq('id', nodeId);
    if (error) console.error('updateCanvasNode:', error);
}

/**
 * Deleta um node.
 * @param {string} nodeId
 */
export async function deleteCanvasNode(nodeId) {
    const { error } = await supabase
        .from('canvas_nodes')
        .delete()
        .eq('id', nodeId);
    if (error) console.error('deleteCanvasNode:', error);
}

/**
 * Busca todos os edges de um canvas map.
 * @param {string} mapId
 * @returns {Promise<Array>}
 */
export async function getCanvasEdges(mapId) {
    const { data, error } = await supabase
        .from('canvas_edges')
        .select('*')
        .eq('map_id', mapId);
    if (error) { console.error('getCanvasEdges:', error); return []; }
    return data;
}

/**
 * Cria um novo edge no canvas.
 * @param {string} mapId
 * @param {Object} fields - { source_id, target_id, edge_type, label, color }
 * @returns {Promise<Object|null>}
 */
export async function createCanvasEdge(mapId, fields = {}) {
    const { data, error } = await supabase
        .from('canvas_edges')
        .insert({
            map_id: mapId,
            source_id: fields.source_id,
            target_id: fields.target_id,
            edge_type: fields.edge_type || 'arrow',
            label: fields.label || '',
            color: fields.color || ''
        })
        .select()
        .single();
    if (error) { console.error('createCanvasEdge:', error); return null; }
    return data;
}

/**
 * Atualiza um edge existente.
 * @param {string} edgeId
 * @param {Object} fields
 */
export async function updateCanvasEdge(edgeId, fields) {
    const { error } = await supabase
        .from('canvas_edges')
        .update({ ...fields })
        .eq('id', edgeId);
    if (error) console.error('updateCanvasEdge:', error);
}

/**
 * Deleta um edge.
 * @param {string} edgeId
 */
export async function deleteCanvasEdge(edgeId) {
    const { error } = await supabase
        .from('canvas_edges')
        .delete()
        .eq('id', edgeId);
    if (error) console.error('deleteCanvasEdge:', error);
}

/**
 * Salva o estado completo de um canvas (map + nodes + edges).
 * @param {string} mapId
 * @param {Array} nodes
 * @param {Array} edges
 * @param {Object} viewport - { viewport_x, viewport_y, viewport_scale }
 */
export async function saveCanvasState(mapId, nodes, edges, viewport) {
    // Atualiza viewport do map
    await updateCanvasMap(mapId, viewport);

    // Deleta nodes existentes e recria (simples e efetivo)
    const { error: delNodes } = await supabase
        .from('canvas_nodes')
        .delete()
        .eq('map_id', mapId);
    if (delNodes) console.error('delNodes:', delNodes);

    // Recria nodes
    if (nodes && nodes.length > 0) {
        const nodesToInsert = nodes.map(n => ({
            map_id: mapId,
            type: n.type || 'concept',
            x: n.x ?? 100,
            y: n.y ?? 100,
            width: n.width ?? 160,
            height: n.height ?? 60,
            z_index: n.z_index ?? 0,
            data: n.data || {}
        }));
        const { error: insNodes } = await supabase
            .from('canvas_nodes')
            .insert(nodesToInsert);
        if (insNodes) console.error('insNodes:', insNodes);
    }

    // Deleta edges existentes e recria
    const { error: delEdges } = await supabase
        .from('canvas_edges')
        .delete()
        .eq('map_id', mapId);
    if (delEdges) console.error('delEdges:', delEdges);

    // Recria edges
    if (edges && edges.length > 0) {
        const edgesToInsert = edges.map(e => ({
            map_id: mapId,
            source_id: e.source_id,
            target_id: e.target_id,
            edge_type: e.edge_type || 'arrow',
            label: e.label || '',
            color: e.color || ''
        }));
        const { error: insEdges } = await supabase
            .from('canvas_edges')
            .insert(edgesToInsert);
        if (insEdges) console.error('insEdges:', insEdges);
    }
}
