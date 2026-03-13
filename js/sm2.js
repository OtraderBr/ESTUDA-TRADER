// js/sm2.js
// Implementação do algoritmo SuperMemo SM-2 para repetição espaçada adaptativa.
// Módulo puro — sem dependências de DOM ou Supabase. Testável via Node.js.

/**
 * Converte os scores de flashcard e autoavaliação em qualidade SM-2 (0-5).
 * @param {number} flashcardScore - Acertos em flashcards (0-100)
 * @param {number} selfScore - Autoavaliação Feynman (0-100)
 * @returns {number} Qualidade SM-2 de 0 a 5
 */
export function calculateQuality(flashcardScore, selfScore) {
    const avg = (flashcardScore + selfScore) / 2;
    if (avg >= 90) return 5; // perfeito, sem hesitação
    if (avg >= 75) return 4; // correto após leve hesitação
    if (avg >= 60) return 3; // correto mas com dificuldade
    if (avg >= 40) return 2; // errado, mas resposta era recuperável
    if (avg >= 20) return 1; // errado, resposta muito difícil
    return 0;                // blackout total
}

/**
 * Aplica o algoritmo SM-2 ao progresso atual e retorna os campos atualizados.
 * @param {{ sm2_ease_factor: number, sm2_interval: number, sm2_repetitions: number }} progress
 * @param {number} quality - Qualidade SM-2 (0-5) calculada por calculateQuality()
 * @returns {{ sm2_ease_factor: number, sm2_interval: number, sm2_repetitions: number, next_review_at: Date }}
 */
export function applySM2(progress, quality) {
    let { sm2_ease_factor, sm2_interval, sm2_repetitions } = progress;

    if (quality < 3) {
        // Resposta insuficiente — reinicia a sequência.
        // next_review_at = amanhã (intervalo de 1 dia).
        sm2_repetitions = 0;
        sm2_interval = 1;
    } else {
        // Resposta correta — avança a sequência.
        if (sm2_repetitions === 0) {
            sm2_interval = 1;       // 1ª vez certa: revisar amanhã
        } else if (sm2_repetitions === 1) {
            sm2_interval = 6;       // 2ª vez certa: revisar em 6 dias
        } else {
            sm2_interval = Math.round(sm2_interval * sm2_ease_factor); // seguintes: intervalo × fator
        }
        sm2_repetitions += 1;
    }

    // Atualiza fator de facilidade (aplica-se em AMBOS os caminhos)
    sm2_ease_factor = Math.max(
        1.3, // mínimo absoluto do algoritmo SM-2
        sm2_ease_factor + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)
    );

    // Próxima revisão = hoje + sm2_interval dias (sempre no futuro, mínimo amanhã)
    const next_review_at = new Date();
    next_review_at.setDate(next_review_at.getDate() + sm2_interval);

    return { sm2_ease_factor, sm2_interval, sm2_repetitions, next_review_at };
}

/**
 * Calcula a porcentagem de domínio a partir dos dois scores da avaliação.
 * @param {number} flashcardScore - Acertos em flashcards (0-100)
 * @param {number} selfScore - Autoavaliação Feynman (0-100)
 * @returns {number} Porcentagem de domínio (0-100, inteiro)
 */
export function calculateMastery(flashcardScore, selfScore) {
    return Math.round((flashcardScore + selfScore) / 2);
}
