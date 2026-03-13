// supabase/functions/analyze-gaps/index.ts
// Analisa o progresso do usuário e retorna gaps críticos de aprendizado.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'authorization, content-type',
            }
        });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. weakCategories: macro-categorias com média de domínio abaixo de 60%
    const { data: allProgress } = await supabase
        .from('user_concept_progress')
        .select('macro_category, mastery_percentage, tags, conceito_name, last_studied_at');

    const activeProgress = (allProgress || []).filter((p: any) => !p.tags?.includes('knowledge_only'));

    // Agrupar por macro_category
    const macroMap: Record<string, number[]> = {};
    activeProgress.forEach((p: any) => {
        const macro = p.macro_category || 'Fundamento';
        if (!macroMap[macro]) macroMap[macro] = [];
        macroMap[macro].push(p.mastery_percentage || 0);
    });

    const weakCategories = Object.entries(macroMap)
        .map(([name, masteries]) => ({
            name,
            healthScore: Math.round(masteries.reduce((a, b) => a + b, 0) / masteries.length),
            conceptsBelow50: masteries.filter(m => m < 50).length
        }))
        .filter(c => c.healthScore < 60)
        .sort((a, b) => a.healthScore - b.healthScore)
        .slice(0, 3);

    // 2. neglectedConcepts: estudados há mais de 30 dias sem domínio completo
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const neglectedConcepts = activeProgress
        .filter((p: any) => {
            if ((p.mastery_percentage || 0) >= 85) return false;
            if (!p.last_studied_at) return true;
            return new Date(p.last_studied_at) < thirtyDaysAgo;
        })
        .sort((a: any, b: any) => {
            if (!a.last_studied_at) return -1;
            if (!b.last_studied_at) return 1;
            return new Date(a.last_studied_at).getTime() - new Date(b.last_studied_at).getTime();
        })
        .slice(0, 5)
        .map((p: any) => ({
            name: p.conceito_name,
            lastStudied: p.last_studied_at,
            daysSince: p.last_studied_at
                ? Math.floor((Date.now() - new Date(p.last_studied_at).getTime()) / 86400000)
                : null
        }));

    // 3. prerequisiteGaps: conceitos cujo pré-requisito não foi dominado
    const { data: conceitos } = await supabase
        .from('conceitos')
        .select('conceito, prerequisito')
        .not('prerequisito', 'is', null)
        .neq('prerequisito', 'Nenhum');

    const progressByName: Record<string, number> = {};
    activeProgress.forEach((p: any) => { progressByName[p.conceito_name] = p.mastery_percentage || 0; });

    const prerequisiteGaps = (conceitos || [])
        .filter((c: any) => {
            const prereqMastery = progressByName[c.prerequisito] ?? 0;
            const selfMastery = progressByName[c.conceito] ?? 0;
            return prereqMastery < 50 && selfMastery < 85;
        })
        .slice(0, 5)
        .map((c: any) => ({
            concept: c.conceito,
            prerequisite: c.prerequisito,
            prereqMastery: progressByName[c.prerequisito] ?? 0
        }));

    // 4. overallHealth: média geral de domínio (%)
    const overallHealth = activeProgress.length > 0
        ? Math.round(activeProgress.reduce((sum: number, p: any) => sum + (p.mastery_percentage || 0), 0) / activeProgress.length)
        : 0;

    const result = { weakCategories, neglectedConcepts, prerequisiteGaps, overallHealth };

    return new Response(JSON.stringify(result), {
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        }
    });
});
