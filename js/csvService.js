// js/csvService.js
// Responsável por carregar e processar o brooks.csv usando PapaParse via CDN
import { store } from './state.js';

export async function loadConcepts() {
    try {
        const response = await fetch('./data/brooks.csv');
        if (!response.ok) {
            throw new Error(`Erro ao carregar CSV: ${response.status}`);
        }
        const csvText = await response.text();

        return new Promise((resolve, reject) => {
            // O PapaParse está disponível globalmente através da tag script no index.html
            Papa.parse(csvText, {
                header: false,
                skipEmptyLines: true,
                complete: (results) => {
                    const concepts = [];
                    // Skip header row
                    for (let i = 1; i < results.data.length; i++) {
                        const row = results.data[i];
                        if (row.length >= 5) {
                            const name = row[0].trim();
                            const category = row[1].trim();
                            const subcategory = row[2].trim();
                            const prerequisite = row[3].trim();
                            const level = parseInt(row[4], 10) || 0;

                            if (name && category) {
                                concepts.push({
                                    id: name,
                                    name,
                                    category,
                                    subcategory,
                                    prerequisite,
                                    level
                                });
                            }
                        }
                    }
                    // Deduplicate by name
                    const uniqueConceptsMap = new Map();
                    concepts.forEach(item => uniqueConceptsMap.set(item.name, item));
                    const uniqueConcepts = Array.from(uniqueConceptsMap.values());
                    resolve(uniqueConcepts);
                },
                error: (error) => {
                    reject(error);
                }
            });
        });
    } catch (error) {
        console.error("Failed to load concepts:", error);
        return [];
    }
}
