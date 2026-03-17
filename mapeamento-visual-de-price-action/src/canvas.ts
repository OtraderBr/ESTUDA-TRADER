import { state, NodeData, EdgeData } from './state';
import { openModal } from './modal';
import { v4 as uuidv4 } from 'uuid';
import { createIcons, BookOpen, Activity, MessageSquare, Image as ImageIcon } from 'lucide';
import { Concept } from './types';

let container: HTMLElement;
let transformLayer: HTMLElement;
let nodesLayer: HTMLElement;
let edgesLayer: SVGSVGElement;

// Interaction state
let isDraggingNode = false;
let hasDragged = false;
let draggedNodeId: string | null = null;
let dragStartX = 0;
let dragStartY = 0;
let nodeStartX = 0;
let nodeStartY = 0;

let isPanning = false;
let panStartX = 0;
let panStartY = 0;

let isConnecting = false;
let connectionSourceNode: string | null = null;
let connectionSourceHandle: string | null = null;
let tempEdgePath: SVGPathElement | null = null;

export function initCanvas() {
  container = document.getElementById('canvas-container')!;
  transformLayer = document.getElementById('canvas-transform')!;
  nodesLayer = document.getElementById('nodes-layer')!;
  edgesLayer = document.getElementById('edges-layer') as any as SVGSVGElement;

  state.onNodesChange = renderNodes;
  state.onEdgesChange = renderEdges;

  setupPanZoom();
  setupDragDrop();
  setupInteractions();

  // Initial render
  updateTransform();
  renderNodes();
  renderEdges();
}

export function updateTransform() {
  transformLayer.style.transform = `translate(${state.panX}px, ${state.panY}px) scale(${state.scale})`;
  const bg = document.getElementById('canvas-bg');
  if (bg) {
    bg.style.backgroundPosition = `${state.panX}px ${state.panY}px`;
    bg.style.backgroundSize = `${24 * state.scale}px ${24 * state.scale}px`;
  }
}

function setupPanZoom() {
  container.addEventListener('wheel', (e) => {
    e.preventDefault();
    
    // Normalize delta across different browsers/devices
    let delta = e.deltaY;
    if (e.deltaMode === 1) delta *= 16; // DOM_DELTA_LINE
    else if (e.deltaMode === 2) delta *= 800; // DOM_DELTA_PAGE
    
    const zoomSensitivity = 0.002;
    // Use exponential zoom for smoother scaling
    const zoomFactor = Math.exp(-delta * zoomSensitivity);
    const newScale = Math.min(Math.max(0.1, state.scale * zoomFactor), 3);
    
    const rect = container.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    state.panX = mouseX - (mouseX - state.panX) * (newScale / state.scale);
    state.panY = mouseY - (mouseY - state.panY) * (newScale / state.scale);
    state.scale = newScale;
    
    updateTransform();
  }, { passive: false });

  container.addEventListener('mousedown', (e) => {
    // Only pan on middle click or left click on background
    const target = e.target as HTMLElement;
    const isBackground = target === container || target === transformLayer || target.id === 'canvas-bg' || target.id === 'nodes-layer' || target.id === 'edges-layer';
    
    if (e.button === 1 || (e.button === 0 && isBackground)) {
      isPanning = true;
      panStartX = e.clientX - state.panX;
      panStartY = e.clientY - state.panY;
      container.style.cursor = 'grabbing';
    }
  });

  window.addEventListener('mousemove', (e) => {
    if (isPanning) {
      state.panX = e.clientX - panStartX;
      state.panY = e.clientY - panStartY;
      updateTransform();
    }
  });

  window.addEventListener('mouseup', () => {
    if (isPanning) {
      isPanning = false;
      container.style.cursor = 'default';
    }
  });
}

function setupDragDrop() {
  container.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer!.dropEffect = 'move';
  });

  container.addEventListener('drop', (e) => {
    e.preventDefault();
    const conceptStr = e.dataTransfer!.getData('application/json');
    if (!conceptStr) return;

    const concept: Concept = JSON.parse(conceptStr);
    const rect = container.getBoundingClientRect();
    
    // Convert screen coordinates to canvas coordinates
    const x = (e.clientX - rect.left - state.panX) / state.scale;
    const y = (e.clientY - rect.top - state.panY) / state.scale;

    const newNode: NodeData = {
      id: uuidv4(),
      x,
      y,
      concept,
      notes: concept.notes,
    };

    state.nodes.push(newNode);
    renderNodes();
  });
}

function setupInteractions() {
    window.addEventListener('mousemove', (e) => {
    if (isDraggingNode && draggedNodeId) {
      const dx = (e.clientX - dragStartX) / state.scale;
      const dy = (e.clientY - dragStartY) / state.scale;
      
      if (Math.abs(e.clientX - dragStartX) > 3 || Math.abs(e.clientY - dragStartY) > 3) {
        hasDragged = true;
      }
      
      const node = state.nodes.find(n => n.id === draggedNodeId);
      if (node) {
        node.x = nodeStartX + dx;
        node.y = nodeStartY + dy;
        
        const el = document.getElementById(`node-${node.id}`);
        if (el) {
          el.style.transform = `translate(${node.x}px, ${node.y}px)`;
        }
        renderEdges();
      }
    }

    if (isConnecting && connectionSourceNode && connectionSourceHandle) {
      const rect = container.getBoundingClientRect();
      const mouseX = (e.clientX - rect.left - state.panX) / state.scale;
      const mouseY = (e.clientY - rect.top - state.panY) / state.scale;
      
      const sourcePos = getHandlePosition(connectionSourceNode, connectionSourceHandle);
      if (sourcePos && tempEdgePath) {
        tempEdgePath.setAttribute('d', getBezierPath(sourcePos.x, sourcePos.y, mouseX, mouseY, connectionSourceHandle, 'top'));
      }
    }
  });

  window.addEventListener('mouseup', (e) => {
    if (isDraggingNode) {
      isDraggingNode = false;
      draggedNodeId = null;
    }

    if (isConnecting) {
      const targetHandleEl = (e.target as HTMLElement).closest('.node-handle');
      if (targetHandleEl) {
        const targetNode = targetHandleEl.getAttribute('data-node-id')!;
        const targetHandle = targetHandleEl.getAttribute('data-handle-id')!;
        
        if (targetNode !== connectionSourceNode) {
          // Prevent duplicate edges
          const edgeExists = state.edges.some(e => 
            (e.source === connectionSourceNode && e.target === targetNode && e.sourceHandle === connectionSourceHandle && e.targetHandle === targetHandle) ||
            (e.source === targetNode && e.target === connectionSourceNode && e.sourceHandle === targetHandle && e.targetHandle === connectionSourceHandle)
          );
          
          if (!edgeExists) {
            state.edges.push({
              id: uuidv4(),
              source: connectionSourceNode!,
              sourceHandle: connectionSourceHandle!,
              target: targetNode,
              targetHandle: targetHandle,
            });
            renderEdges();
          }
        }
      }
      
      isConnecting = false;
      connectionSourceNode = null;
      connectionSourceHandle = null;
      if (tempEdgePath) {
        tempEdgePath.remove();
        tempEdgePath = null;
      }
    }
  });
}

function renderNodes() {
  nodesLayer.innerHTML = '';
  
  state.nodes.forEach(node => {
    const isEvolucao = node.concept.mode === 'evolucao';
    const bgClass = isEvolucao ? 'bg-blue-50 border-blue-200 text-blue-900' : 'bg-emerald-50 border-emerald-200 text-emerald-900';
    const iconColor = isEvolucao ? 'text-blue-600' : 'text-emerald-600';
    const iconName = isEvolucao ? 'book-open' : 'activity';

    const el = document.createElement('div');
    el.id = `node-${node.id}`;
    el.className = `absolute rounded-xl border-2 shadow-sm transition-shadow duration-200 min-w-[220px] ${bgClass} cursor-pointer pointer-events-auto hover:shadow-md`;
    el.style.transform = `translate(${node.x}px, ${node.y}px)`;
    
    // Handles
    const handles = ['top', 'right', 'bottom', 'left'].map(pos => {
      let posClass = '';
      if (pos === 'top') posClass = 'top-0 left-1/2 -translate-x-1/2 -translate-y-1/2';
      if (pos === 'bottom') posClass = 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2';
      if (pos === 'left') posClass = 'left-0 top-1/2 -translate-x-1/2 -translate-y-1/2';
      if (pos === 'right') posClass = 'right-0 top-1/2 translate-x-1/2 -translate-y-1/2';
      
      return `<div data-node-id="${node.id}" data-handle-id="${pos}" class="node-handle absolute w-3 h-3 bg-slate-400 border-2 border-white rounded-full cursor-crosshair z-10 ${posClass}"></div>`;
    }).join('');

    let extras = '';
    if (node.notes) {
      extras += `<div class="mt-2 text-xs opacity-80 italic border-l-2 border-black/10 pl-2">${node.notes}</div>`;
    }
    if (node.comments || node.imageUrl) {
      extras += `<div class="mt-3 pt-3 border-t border-black/10 flex gap-3 text-xs font-medium opacity-80">`;
      if (node.comments) extras += `<div class="flex items-center gap-1"><i data-lucide="message-square" class="w-3.5 h-3.5"></i><span>Anotações</span></div>`;
      if (node.imageUrl) extras += `<div class="flex items-center gap-1"><i data-lucide="image" class="w-3.5 h-3.5"></i><span>Imagem</span></div>`;
      extras += `</div>`;
    }

    el.innerHTML = `
      ${handles}
      <div class="p-4">
        <div class="flex items-start gap-3 mb-2">
          <div class="p-2 bg-white rounded-lg shadow-sm shrink-0">
            <i data-lucide="${iconName}" class="w-5 h-5 ${iconColor}"></i>
          </div>
          <div class="flex-1 min-w-0">
            <h3 class="font-bold text-sm leading-tight mb-1">${node.concept.title}</h3>
            <p class="text-[10px] font-bold uppercase tracking-wider opacity-60 truncate">${node.concept.category} &bull; ${node.concept.subcategory}</p>
          </div>
        </div>
        ${extras}
      </div>
    `;

    // Node Dragging
    el.addEventListener('mousedown', (e) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('node-handle')) {
        // Start connection
        isConnecting = true;
        connectionSourceNode = target.getAttribute('data-node-id');
        connectionSourceHandle = target.getAttribute('data-handle-id');
        
        tempEdgePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        tempEdgePath.setAttribute('stroke', '#94a3b8');
        tempEdgePath.setAttribute('stroke-width', '2');
        tempEdgePath.setAttribute('fill', 'none');
        tempEdgePath.setAttribute('stroke-dasharray', '5,5');
        edgesLayer.appendChild(tempEdgePath);
        
        e.stopPropagation();
        return;
      }

      // Start drag
      isDraggingNode = true;
      hasDragged = false;
      draggedNodeId = node.id;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      nodeStartX = node.x;
      nodeStartY = node.y;
      
      // Move node to end of array to render on top
      const nodeIndex = state.nodes.findIndex(n => n.id === node.id);
      if (nodeIndex > -1) {
        state.nodes.push(state.nodes.splice(nodeIndex, 1)[0]);
        // Re-append element to DOM to bring to front
        nodesLayer.appendChild(el);
      }
      
      e.stopPropagation();
    });

    // Node Click (Modal)
    el.addEventListener('click', (e) => {
      if (!hasDragged && !(e.target as HTMLElement).classList.contains('node-handle')) {
        openModal(node.id);
      }
    });

    nodesLayer.appendChild(el);
  });

  createIcons({
    icons: {
      BookOpen,
      Activity,
      MessageSquare,
      Image: ImageIcon
    }
  });
  renderEdges();
}

function getHandlePosition(nodeId: string, handleId: string) {
  const node = state.nodes.find(n => n.id === nodeId);
  const el = document.getElementById(`node-${nodeId}`);
  if (!node || !el) return null;

  const x = node.x;
  const y = node.y;
  const w = el.offsetWidth;
  const h = el.offsetHeight;

  if (handleId === 'top') return { x: x + w / 2, y };
  if (handleId === 'bottom') return { x: x + w / 2, y: y + h };
  if (handleId === 'left') return { x, y: y + h / 2 };
  if (handleId === 'right') return { x: x + w, y: y + h / 2 };
  
  return { x, y };
}

function getBezierPath(x1: number, y1: number, x2: number, y2: number, pos1: string, pos2: string) {
  const dx = Math.abs(x2 - x1) * 0.5;
  const dy = Math.abs(y2 - y1) * 0.5;
  const offset = Math.max(dx, dy, 50);

  let cp1x = x1, cp1y = y1;
  if (pos1 === 'top') cp1y -= offset;
  if (pos1 === 'bottom') cp1y += offset;
  if (pos1 === 'left') cp1x -= offset;
  if (pos1 === 'right') cp1x += offset;

  let cp2x = x2, cp2y = y2;
  if (pos2 === 'top') cp2y -= offset;
  if (pos2 === 'bottom') cp2y += offset;
  if (pos2 === 'left') cp2x -= offset;
  if (pos2 === 'right') cp2x += offset;

  return `M ${x1} ${y1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${y2}`;
}

function renderEdges() {
  // Keep temp edge if it exists
  const tempEdge = tempEdgePath;
  edgesLayer.innerHTML = '';
  if (tempEdge) edgesLayer.appendChild(tempEdge);

  state.edges.forEach(edge => {
    const sourcePos = getHandlePosition(edge.source, edge.sourceHandle);
    const targetPos = getHandlePosition(edge.target, edge.targetHandle);

    if (sourcePos && targetPos) {
      const d = getBezierPath(sourcePos.x, sourcePos.y, targetPos.x, targetPos.y, edge.sourceHandle, edge.targetHandle);
      
      // Visible path
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', d);
      path.setAttribute('stroke', '#94a3b8');
      path.setAttribute('stroke-width', '2');
      path.setAttribute('fill', 'none');
      path.style.transition = 'stroke 0.2s, stroke-width 0.2s';
      path.style.pointerEvents = 'none'; // Let hit area handle events
      
      // Invisible hit area path
      const hitPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      hitPath.setAttribute('d', d);
      hitPath.setAttribute('stroke', 'transparent');
      hitPath.setAttribute('stroke-width', '15');
      hitPath.setAttribute('fill', 'none');
      hitPath.style.pointerEvents = 'stroke';
      hitPath.style.cursor = 'pointer';
      
      hitPath.addEventListener('mouseenter', () => {
        path.setAttribute('stroke', '#ef4444');
        path.setAttribute('stroke-width', '4');
      });
      
      hitPath.addEventListener('mouseleave', () => {
        path.setAttribute('stroke', '#94a3b8');
        path.setAttribute('stroke-width', '2');
      });

      hitPath.addEventListener('dblclick', () => {
        state.edges = state.edges.filter(e => e.id !== edge.id);
        renderEdges();
      });

      edgesLayer.appendChild(path);
      edgesLayer.appendChild(hitPath);
    }
  });
}
