// js/tags.js
// Sistema de tags para conceitos: definições, renderização e toggle.
import { updateTags } from './engine.js';

/** Definição canônica das tags disponíveis. */
export const AVAILABLE_TAGS = [
    {
        id: 'knowledge_only',
        label: 'Só Conhecimento',
        lucideIcon: 'book-open',
        activeClasses: 'bg-zinc-200 text-zinc-700 border-zinc-400',
        inactiveClasses: 'border-dashed border-zinc-300 text-zinc-400 hover:border-zinc-400'
    },
    {
        id: 'needs_review',
        label: 'Revisar Urgente',
        lucideIcon: 'flag',
        activeClasses: 'bg-red-600/10 text-red-700 border-red-500',
        inactiveClasses: 'border-dashed border-zinc-300 text-zinc-400 hover:border-red-300'
    },
    {
        id: 'priority_high',
        label: 'Alta Prioridade',
        lucideIcon: 'flame',
        activeClasses: 'bg-orange-100 text-orange-700 border-orange-400',
        inactiveClasses: 'border-dashed border-zinc-300 text-zinc-400 hover:border-orange-300'
    },
    {
        id: 'favorite',
        label: 'Favorito',
        lucideIcon: 'star',
        activeClasses: 'bg-amber-100 text-amber-700 border-amber-400',
        inactiveClasses: 'border-dashed border-zinc-300 text-zinc-400 hover:border-amber-300'
    }
];

/**
 * Renderiza as pills de tags para um conceito.
 * @param {string[]} activeTags - array de IDs de tags ativas no conceito
 * @returns {string} HTML das pills
 */
export function renderTagPills(activeTags = []) {
    return AVAILABLE_TAGS.map(tag => {
        const isActive = activeTags.includes(tag.id);
        const classes = isActive ? tag.activeClasses : tag.inactiveClasses;
        return `
            <button
                class="tag-pill flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${classes}"
                data-tag-id="${tag.id}"
                title="${isActive ? 'Remover tag' : 'Adicionar tag'}"
            >
                <i data-lucide="${tag.lucideIcon}" class="w-3.5 h-3.5"></i> ${tag.label}
            </button>
        `;
    }).join('');
}

/**
 * Registra os event listeners das pills de tags num container.
 * @param {HTMLElement} container - elemento contendo as pills
 * @param {string} conceptName
 * @param {string[]} currentTags
 */
export function attachTagListeners(container, conceptName, currentTags) {
    container.querySelectorAll('.tag-pill').forEach(btn => {
        btn.addEventListener('click', async () => {
            const tagId = btn.getAttribute('data-tag-id');
            const newTags = currentTags.includes(tagId)
                ? currentTags.filter(t => t !== tagId)
                : [...currentTags, tagId];
            await updateTags(conceptName, newTags);
        });
    });
}
