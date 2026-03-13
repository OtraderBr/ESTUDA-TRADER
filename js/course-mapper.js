// js/course-mapper.js
// Script one-shot: enriquece a tabela `conceitos` com modulo_curso e aula_curso
// Uso: await window.__runCourseMapper() no DevTools Console

import { supabase } from './supabaseClient.js';

export async function runCourseMapper() {
    const res = await fetch('./data/course-mapping.json');
    const mapping = await res.json();

    const entries = Object.entries(mapping);
    let updated = 0;
    let notFound = 0;
    const notFoundList = [];

    for (const [conceito, { modulo, aula }] of entries) {
        const { data, error } = await supabase
            .from('conceitos')
            .update({ modulo_curso: modulo, aula_curso: aula })
            .eq('conceito', conceito)
            .select('id');

        if (error) {
            console.error(`Erro ao atualizar "${conceito}":`, error.message);
        } else if (!data || data.length === 0) {
            notFoundList.push(conceito);
            notFound++;
        } else {
            updated++;
        }
    }

    console.log(`✅ Mapeamento concluído: ${updated} conceitos atualizados.`);
    if (notFound > 0) {
        console.warn(`⚠️ ${notFound} conceitos não encontrados no banco:`, notFoundList);
    }

    return { updated, notFound, notFoundList };
}
