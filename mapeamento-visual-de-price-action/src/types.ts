export type ConceptMode = 'evolucao' | 'operacao';

export interface Concept {
  id: string;
  mode: ConceptMode;
  category: string;
  subcategory: string;
  title: string;
  prerequisite?: string;
  notes?: string;
}

export interface NodeData extends Record<string, unknown> {
  title: string;
  category?: string;
  subcategory?: string;
  notes?: string;
  comments?: string;
  imageUrl?: string;
}

