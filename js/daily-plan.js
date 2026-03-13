// js/daily-plan.js
// Cache local e fetch das Edge Functions de inteligência.

const CACHE_KEYS = {
    gaps:    'mb_cache_gaps',
    plan:    'mb_cache_plan',
    tsGaps:  'mb_cache_ts_gaps',
    tsPlan:  'mb_cache_ts_plan',
};

const SUPABASE_URL = 'https://jebbklacmrxrhbajweug.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImplYmJrbGFjbXJ4cmhiYWp3ZXVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyMzgwOTcsImV4cCI6MjA4ODgxNDA5N30.-41Xg5zhF2hHiTJ3BUoT3TiL5LYwkhwzKfUUhTTUJks';
const TTL_MS = 60 * 60 * 1000; // 1 hora

/**
 * Verifica se o cache ainda é válido.
 * @param {string} tsKey - chave do timestamp no localStorage
 * @returns {boolean}
 */
export function isCacheValid(tsKey) {
    const ts = localStorage.getItem(tsKey);
    if (!ts) return false;
    return (Date.now() - new Date(ts).getTime()) < TTL_MS;
}

/**
 * Invalida o cache do plano diário e do gap analysis.
 * Deve ser chamado sempre que o progresso do usuário mudar.
 */
export function bustPlanCache() {
    Object.values(CACHE_KEYS).forEach(k => localStorage.removeItem(k));
}

/**
 * Busca o gap analysis da Edge Function (com cache de 1h).
 * @returns {Promise<Object|null>}
 */
export async function fetchGapAnalysis() {
    if (isCacheValid(CACHE_KEYS.tsGaps)) {
        const cached = localStorage.getItem(CACHE_KEYS.gaps);
        if (cached) return JSON.parse(cached);
    }

    try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/analyze-gaps`, {
            headers: { Authorization: `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' }
        });
        if (!res.ok) throw new Error(`analyze-gaps: ${res.status}`);
        const data = await res.json();
        localStorage.setItem(CACHE_KEYS.gaps, JSON.stringify(data));
        localStorage.setItem(CACHE_KEYS.tsGaps, new Date().toISOString());
        return data;
    } catch (err) {
        console.error('fetchGapAnalysis failed:', err);
        return null;
    }
}

/**
 * Busca o plano diário da Edge Function (com cache de 1h).
 * @returns {Promise<Object|null>}
 */
export async function fetchDailyPlan() {
    if (isCacheValid(CACHE_KEYS.tsPlan)) {
        const cached = localStorage.getItem(CACHE_KEYS.plan);
        if (cached) return JSON.parse(cached);
    }

    try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/generate-daily-plan`, {
            headers: { Authorization: `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' }
        });
        if (!res.ok) throw new Error(`generate-daily-plan: ${res.status}`);
        const data = await res.json();
        localStorage.setItem(CACHE_KEYS.plan, JSON.stringify(data));
        localStorage.setItem(CACHE_KEYS.tsPlan, new Date().toISOString());
        return data;
    } catch (err) {
        console.error('fetchDailyPlan failed:', err);
        return null;
    }
}
