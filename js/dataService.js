// js/dataService.js
// Responsável por buscar os conceitos diretamente da tabela `conceitos` no Supabase e mapear para o frontend
import { supabase } from './supabaseClient.js';

export async function loadConcepts() {
    try {
        console.log('Fetching concepts from Supabase...');
        const { data: conceitosData, error } = await supabase
            .from('conceitos')
            .select('*')
            .order('id', { ascending: true });

        if (error) {
            console.error('Supabase query error:', error);
            throw new Error(`Erro ao buscar conceitos no Supabase: ${error.message}`);
        }

        console.log(`Loaded ${conceitosData.length} concepts from DB.`);

        // Mapear os dados para o formato esperado pelo frontend mantendo camelCase original 
        // mas injetando os novos campos do banco. O campo 'id' original no frontend era a string do 'name'.
        // Agora o DB tem um serial 'id' autoincrementável (bigint) e o nome do conceito é 'conceito'.
        const mappedConcepts = conceitosData.map(row => {
            return {
                dbId: row.id,
                id: row.conceito.trim(), // 'id' frontend = nome string (para manter compatibilidade c/ localstorage e links)
                name: row.conceito.trim(),
                category: row.categoria ? row.categoria.trim() : 'Geral',
                subcategory: row.subcategoria ? row.subcategoria.trim() : '',
                prerequisite: row.prerequisito ? row.prerequisito.trim() : 'Nenhum',
                level: 0, // Level default frontend (mesclado posteriormente via engine)
                // New Fields from v2 Brooks upgrade
                macroCategoryStr: row.macro_categoria || '',
                moduloCurso: row.modulo_curso || '',
                conhecimentoAtual: row.conhecimento_atual || 0,
                objetivo: row.objetivo || 10,
                fonteEstudo: row.fonte_estudo || '',
                regrasOperacionais: row.regras_operacionais || '',
                probabilidade: row.probabilidade || '',
                mercadoAplicavel: row.mercado_aplicavel || '',
                notasBD: row.notas || ''
            };
        });

        return mappedConcepts;
    } catch (error) {
        console.error('Failed to load concepts:', error);
        return [];
    }
}
