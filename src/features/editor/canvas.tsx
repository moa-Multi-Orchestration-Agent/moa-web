'use client';

import { useCallback, useEffect, useRef } from 'react';
import { Background, ControlButton, Controls, MiniMap, ReactFlow, useReactFlow, type Connection, type Edge, type IsValidConnection } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { LayoutGrid, Redo2, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { isAssignable, portType, type Block } from '@/entities/workflow';
import { nodeColor } from '@/shared/ui/node-colors';
import { nextNodeId, nodeFromBlock, toDefinition, type FlowEdge, type FlowNode } from './convert';
import { autoLayout } from './layout';
import { DND_MIME } from './palette';
import { redo, undo, useEditorStore } from './store';
import { nodeTypes } from './wf-node';

function portOf(nodes: FlowNode[], id: string | null, port: string | null | undefined, dir: 'in' | 'out') {
  const n = nodes.find((x) => x.id === id);
  if (!n || !port) return undefined;
  return portType(toDefinition([n], []).nodes[0], port, dir);
}

export function Canvas({ blocks, readOnly }: { blocks: Block[]; readOnly?: boolean }) {
  const nodes = useEditorStore((s) => s.nodes);
  const edges = useEditorStore((s) => s.edges);
  const onNodesChange = useEditorStore((s) => s.onNodesChange);
  const onEdgesChange = useEditorStore((s) => s.onEdgesChange);
  const connect = useEditorStore((s) => s.connect);
  const addNode = useEditorStore((s) => s.addNode);
  const rf = useReactFlow<FlowNode, FlowEdge>();
  const wrapper = useRef<HTMLDivElement>(null);

  const isValid: IsValidConnection<FlowEdge> = useCallback(
    (c) => {
      if (c.source === c.target) return false;
      const all = useEditorStore.getState().nodes;
      return isAssignable(portOf(all, c.source, c.sourceHandle, 'out'), portOf(all, c.target, c.targetHandle, 'in'));
    },
    [],
  );

  const onConnect = useCallback(
    (c: Connection) => {
      const all = useEditorStore.getState().nodes;
      const src = portOf(all, c.source, c.sourceHandle, 'out');
      const dst = portOf(all, c.target, c.targetHandle, 'in');
      if (!isAssignable(src, dst)) {
        toast.error(`연결할 수 없습니다: ${src} → ${dst} (MOA-WF-003)`);
        return;
      }
      connect(c);
    },
    [connect],
  );

  const addAt = useCallback(
    (blockId: string, position: { x: number; y: number }) => {
      const b = blocks.find((x) => x.id === blockId);
      if (!b) return;
      addNode(nodeFromBlock(b, nextNodeId(useEditorStore.getState().nodes, b), position));
    },
    [blocks, addNode],
  );

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const id = e.dataTransfer.getData(DND_MIME);
    if (!id || readOnly) return;
    addAt(id, rf.screenToFlowPosition({ x: e.clientX - 110, y: e.clientY - 30 }));
  };

  const layout = useCallback(() => {
    const s = useEditorStore.getState();
    s.setNodes(autoLayout(s.nodes, s.edges));
    requestAnimationFrame(() => void rf.fitView({ padding: 0.2, duration: 300 }));
  }, [rf]);

  // 키보드: 실행 취소·다시 실행, 복사·붙여넣기, 방향키 이동, Tab 선택, L 정렬
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) || t.closest('[role="dialog"]'))) return;
      const mod = e.metaKey || e.ctrlKey;
      const s = useEditorStore.getState();
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (readOnly) return;
        if (e.shiftKey) redo();
        else undo();
      } else if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        if (!readOnly) redo();
      } else if (mod && e.key.toLowerCase() === 'c') {
        s.copySelection();
      } else if (mod && e.key.toLowerCase() === 'v') {
        if (!readOnly) s.paste();
      } else if (mod && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        useEditorStore.setState({ nodes: s.nodes.map((n) => ({ ...n, selected: true })) });
      } else if (!mod && e.key.startsWith('Arrow') && !readOnly) {
        const sel = s.nodes.filter((n) => n.selected);
        if (!sel.length) return;
        e.preventDefault();
        const d = e.shiftKey ? 50 : 10;
        const dx = e.key === 'ArrowLeft' ? -d : e.key === 'ArrowRight' ? d : 0;
        const dy = e.key === 'ArrowUp' ? -d : e.key === 'ArrowDown' ? d : 0;
        s.setNodes(s.nodes.map((n) => (n.selected ? { ...n, position: { x: n.position.x + dx, y: n.position.y + dy } } : n)));
      } else if (e.key === 'Tab' && !mod && wrapper.current?.contains(document.activeElement)) {
        e.preventDefault();
        if (!s.nodes.length) return;
        const idx = s.nodes.findIndex((n) => n.selected);
        const next = s.nodes[(idx + (e.shiftKey ? -1 : 1) + s.nodes.length) % s.nodes.length]!;
        s.selectOnly(next.id);
        void rf.setCenter(next.position.x + 110, next.position.y + 50, { duration: 200, zoom: rf.getZoom() });
      } else if (!mod && e.key.toLowerCase() === 'l' && !readOnly) {
        layout();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [rf, layout, readOnly]);

  const empty = nodes.length === 0;

  return (
    <div ref={wrapper} className="relative h-full w-full" onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }} onDrop={onDrop} tabIndex={-1} aria-label="워크플로 캔버스">
      <ReactFlow<FlowNode, FlowEdge>
        nodes={nodes}
        edges={edges as Edge[] as FlowEdge[]}
        nodeTypes={nodeTypes}
        onNodesChange={readOnly ? undefined : onNodesChange}
        onEdgesChange={readOnly ? undefined : onEdgesChange}
        onConnect={onConnect}
        isValidConnection={isValid}
        nodesDraggable={!readOnly}
        nodesConnectable={!readOnly}
        deleteKeyCode={readOnly ? null : ['Delete', 'Backspace']}
        multiSelectionKeyCode={['Meta', 'Control', 'Shift']}
        selectionOnDrag={false}
        fitView
        fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
        minZoom={0.2}
        defaultEdgeOptions={{ type: 'smoothstep' }}
        connectionLineStyle={{ strokeWidth: 2 }}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={20} size={1} />
        <MiniMap pannable zoomable ariaLabel="미니맵" nodeColor={(n) => nodeColor(String((n.data as { type?: string }).type)).accent} className="!rounded-lg !border" />
        <Controls showInteractive={false} aria-label="줌 조절">
          <ControlButton onClick={() => undo()} aria-label="실행 취소 (⌘Z)" title="실행 취소 (⌘Z)" disabled={readOnly}>
            <Undo2 />
          </ControlButton>
          <ControlButton onClick={() => redo()} aria-label="다시 실행 (⇧⌘Z)" title="다시 실행 (⇧⌘Z)" disabled={readOnly}>
            <Redo2 />
          </ControlButton>
          <ControlButton onClick={layout} aria-label="자동 정렬 (L)" title="자동 정렬 (L)" disabled={readOnly}>
            <LayoutGrid />
          </ControlButton>
        </Controls>
      </ReactFlow>
      <p className="bg-background/90 text-muted pointer-events-none absolute top-3 left-3 rounded-md border px-3 py-1.5 text-xs">
        {readOnly ? '읽기 전용입니다' : '노드를 클릭하면 오른쪽에서 설정합니다 · Delete로 삭제 · ⌘Z 실행 취소'}
      </p>
      {empty ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <p className="bg-background text-muted rounded-lg border border-dashed px-6 py-4 text-sm">왼쪽 팔레트에서 노드를 끌어다 놓아 시작하세요.</p>
        </div>
      ) : null}
    </div>
  );
}

export { autoLayout };
