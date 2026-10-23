/** 저장 형식(WorkflowDefinition, design.md 2.2.1) ↔ React Flow 노드·엣지 */
import type { Edge, Node } from '@xyflow/react';
import type { Block, EdgeDef, NodeDef, Port, WorkflowDefinition } from '@/entities/workflow';

export type NodeData = Omit<NodeDef, 'id' | 'position'> & Record<string, unknown>;
export type FlowNode = Node<NodeData, 'wf'>;
export type FlowEdge = Edge<{ condition?: string | null }>;

export function toFlowNode(n: NodeDef): FlowNode {
  const { id, position, ...data } = n;
  return { id, type: 'wf', position: position ?? { x: 0, y: 0 }, data: data as NodeData };
}

export function toFlowEdge(e: EdgeDef, i: number): FlowEdge {
  return {
    id: e.id ?? `e-${e.source}-${e.source_port}-${e.target}-${e.target_port}-${i}`,
    source: e.source,
    sourceHandle: e.source_port,
    target: e.target,
    targetHandle: e.target_port,
    data: { condition: e.condition ?? null },
    label: e.source_port === 'true' ? '예' : e.source_port === 'false' ? (e.condition === 'retry' ? '아니오 → 재시도' : '아니오') : undefined,
    animated: false,
    style: e.condition ? { strokeDasharray: '5 4' } : undefined,
  };
}

export function fromDefinition(defn: Pick<WorkflowDefinition, 'nodes' | 'edges'>) {
  return { nodes: defn.nodes.map(toFlowNode), edges: defn.edges.map(toFlowEdge) };
}

export function toDefinition(nodes: FlowNode[], edges: FlowEdge[]): WorkflowDefinition {
  return {
    nodes: nodes.map((n) => {
      const d = n.data;
      return {
        id: n.id,
        type: d.type,
        block: d.block,
        name: d.name,
        config: d.config ?? {},
        ports_in: d.ports_in ?? [],
        ports_out: d.ports_out ?? [],
        ...(d.retry ? { retry: d.retry } : {}),
        ...(d.timeout_s ? { timeout_s: d.timeout_s } : {}),
        position: { x: Math.round(n.position.x), y: Math.round(n.position.y) },
      };
    }),
    edges: edges.map((e) => ({
      id: e.id,
      source: e.source,
      source_port: e.sourceHandle ?? 'out',
      target: e.target,
      target_port: e.targetHandle ?? 'in',
      condition: e.data?.condition ?? null,
    })),
  };
}

/** 입력 노드의 필드 정의 → 출력 포트 */
export function portsFromFields(fields: { name: string; type: string }[]): Port[] {
  return fields.filter((f) => f.name).map((f) => ({ name: f.name, type: (f.type === 'integer' ? 'number' : f.type) as Port['type'], label: f.name }));
}

export function nodeFromBlock(block: Block, id: string, position: { x: number; y: number }): FlowNode {
  const config = structuredClone(block.config ?? {});
  const ports_out = block.type === 'input' ? portsFromFields((config.fields as { name: string; type: string }[]) ?? []) : block.ports_out;
  return toFlowNode({
    id,
    type: block.type,
    block: block.id,
    name: block.label,
    config,
    ports_in: block.ports_in,
    ports_out,
    retry: block.type === 'llm' || block.type === 'tool' || block.type === 'http' ? { max_attempts: 3 } : undefined,
    timeout_s: block.type === 'three_d' ? 300 : 60,
    position,
  });
}

/** 새 노드 id: 블록 종류 + 번호 (예: llm2) */
export function nextNodeId(nodes: { id: string }[], block: Block) {
  const base = block.type === 'three_d' ? 'td' : block.type === 'kb_search' ? 'rag' : block.type;
  let i = 1;
  const ids = new Set(nodes.map((n) => n.id));
  while (ids.has(`${base}${i}`)) i += 1;
  return `${base}${i}`;
}
