'use client';

import { useMemo } from 'react';
import { Background, Handle, Position, ReactFlow, ReactFlowProvider, type Edge, type Node, type NodeProps } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { WorkflowDefinition } from '@/entities/workflow';
import { nodeColor } from '@/shared/ui/node-colors';

type PreviewData = { label: string; type: string };

function PreviewNode({ data }: NodeProps<Node<PreviewData>>) {
  const c = nodeColor(data.type);
  return (
    <div className="bg-background min-w-[150px] rounded-md border px-3 py-2 text-xs shadow-sm" style={{ borderLeft: `3px solid ${c.accent}` }}>
      <Handle type="target" position={Position.Left} className="!size-1.5 !border-0 !bg-transparent" />
      <div className="text-[10px] font-medium" style={{ color: c.accent }}>
        {c.label}
      </div>
      <div className="font-semibold">{data.label}</div>
      <Handle type="source" position={Position.Right} className="!size-1.5 !border-0 !bg-transparent" />
    </div>
  );
}

const nodeTypes = { preview: PreviewNode };

/** 읽기 전용 워크플로 축소판(템플릿 상세·마켓 구성 미리보기·버전 보기) */
export function FlowPreview({ definition, height = 260 }: { definition: Pick<WorkflowDefinition, 'nodes' | 'edges'>; height?: number }) {
  const { nodes, edges } = useMemo(() => {
    const nodes: Node<PreviewData>[] = definition.nodes.map((n, i) => ({
      id: n.id,
      type: 'preview',
      position: n.position ?? { x: i * 220, y: 0 },
      data: { label: n.name, type: n.type },
      draggable: false,
      selectable: false,
    }));
    const edges: Edge[] = definition.edges.map((e, i) => ({
      id: e.id ?? `e${i}`,
      source: e.source,
      target: e.target,
      animated: false,
      style: e.condition ? { strokeDasharray: '4 4' } : undefined,
      label: e.source_port === 'true' ? '예' : e.source_port === 'false' ? '아니오' : undefined,
    }));
    return { nodes, edges };
  }, [definition]);

  return (
    <div style={{ height }} className="bg-surface overflow-hidden rounded-lg border" role="img" aria-label={`노드 ${nodes.length}개로 된 워크플로 미리보기`}>
      <ReactFlowProvider>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          panOnDrag
          zoomOnScroll={false}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={16} size={1} />
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  );
}

export default FlowPreview;
