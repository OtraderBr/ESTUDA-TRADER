import { Concept } from './types';

export interface NodeData {
  id: string;
  x: number;
  y: number;
  concept: Concept;
  notes?: string;
  comments?: string;
  imageUrl?: string;
}

export interface EdgeData {
  id: string;
  source: string;
  sourceHandle: string;
  target: string;
  targetHandle: string;
}

export const state = {
  nodes: [] as NodeData[],
  edges: [] as EdgeData[],
  scale: 1,
  panX: 0,
  panY: 0,
  selectedNodeId: null as string | null,
  
  // Callbacks for UI updates
  onNodesChange: () => {},
  onEdgesChange: () => {},
};
