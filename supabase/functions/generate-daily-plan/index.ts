// supabase/functions/generate-daily-plan/index.ts
// Gera o plano de estudo diário inteligente com até 8 conceitos priorizados.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function estimateMinutes(mastery: number): number {
    if (mastery >= 70) return 5;
    if (mastery >= 40) return 10;
    return 20;
}

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

    const { data: allProgress } = await supabase
        .from('user_concept_progress')
        .select('conceito_name, mastery_percentage, next_review_at, tags, last_studied_at');

    const active = (allProgress || []).filter((p: any) => !p.tags?.includes('knowledge_only'));
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    const plan: Array<{
        conceito_name: string;
        reason: string;
        mastery: number;
        estimatedMinutes: number;
    }> = [];
    const added = new Set<string>();

    // SLOT 0: Conceitos com tag needs_review (máx. 2)
    const needsReview = active
        .filter((p: any) => p.tags?.includes('needs_review'))
        .sort((a: any, b: any) => (a.mastery_percentage || 0) - (b.mastery_percentage || 0))
        .slice(0, 2);

    needsReview.forEach((p: any) => {
        plan.push({ conceito_name: p.conceito_name, reason: 'needs_review_tag', mastery: p.mastery_percentage || 0, estimatedMinutes: estimateMinutes(p.mastery_percentage || 0) });
        added.add(p.conceito_name);
    });

    // SLOT 1: Revisões SM-2 devidas (máx. 5 - count(slot0))
    const slot1Limit = 5 - plan.length;
    const sm2Due = active
        .filter((p: any) => !added.has(p.conceito_name) && p.next_review_at && p.next_review_at.split('T')[0] <= today)
        .sort((a: any, b: any) => {
            const dateA = a.next_review_at || '9999';
            const dateB = b.next_review_at || '9999';
            if (dateA !== dateB) return dateA.localeCompare(dateB);
            return (a.mastery_percentage || 0) - (b.mastery_percentage || 0);
        })
        .slice(0, slot1Limit);

    sm2Due.forEach((p: any) => {
        plan.push({ conceito_name: p.conceito_name, reason: 'sm2_due', mastery: p.mastery_percentage || 0, estimatedMinutes: estimateMinutes(p.mastery_percentage || 0) });
        added.add(p.conceito_name);
    });

    // SLOT 2: Gaps críticos (máx. 2 total)
    if (plan.length < 7) {
        const gapCandidates = active
            .filter((p: any) => !added.has(p.conceito_name) && (p.mastery_percentage || 0) < 50)
            .sort((a: any, b: any) => (a.mastery_percentage || 0) - (b.mastery_percentage || 0))
            .slice(0, 2);

        gapCandidates.forEach((p: any) => {
            if (plan.length < 7) {
                plan.push({ conceito_name: p.conceito_name, reason: 'gap_critical', mastery: p.mastery_percentage || 0, estimatedMinutes: estimateMinutes(p.mastery_percentage || 0) });
                added.add(p.conceito_name);
            }
        });
    }

    // SLOT 3: Conceito novo (1 vaga, se total < 8)
    if (plan.length < 8) {
        const { data: conceitos } = await supabase
            .from('conceitos')
            .select('conceito, prerequisito')
            .order('id', { ascending: true });

        const masteryByName: Record<string, number> = {};
        active.forEach((p: any) => { masteryByName[p.conceito_name] = p.mastery_percentage || 0; });

        const newConcept = (conceitos || []).find((c: any) => {
            if (added.has(c.conceito)) return false;
            if ((masteryByName[c.conceito] || 0) > 0) return false;
            if (!c.prerequisito || c.prerequisito === 'Nenhum') return true;
            return (masteryByName[c.prerequisito] || 0) >= 50;
        });

        if (newConcept) {
            plan.push({ conceito_name: (newConcept as any).conceito, reason: 'new_concept', mastery: 0, estimatedMinutes: 20 });
        }
    }

    const totalEstimatedMinutes = plan.reduce((sum, p) => sum + p.estimatedMinutes, 0);

    return new Response(JSON.stringify({ plan, totalEstimatedMinutes, generatedAt: new Date().toISOString() }), {
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        }
    });
});
