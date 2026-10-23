/** 자동 정렬: dagre로 왼쪽→오른쪽 배치 */
import dagre from '@dagrejs/dagre';
import type { FlowEdge, FlowNode } from './convert';

export function autoLayout(nodes: FlowNode[], edges: FlowEdge[]): FlowNode[] {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'LR', nodesep: 50, ranksep: 90 });
  g.setDefaultEdgeLabel(() => ({}));
  for (const n of nodes) g.setNode(n.id, { width: n.measured?.width ?? 220, height: n.measured?.height ?? 90 });
  for (const e of edges) if (e.data?.condition !== 'retry' && e.data?.condition !== 'loop_back') g.setEdge(e.source, e.target);
  dagre.layout(g);
  return nodes.map((n) => {
    const p = g.node(n.id);
    if (!p) return n;
    const w = n.measured?.width ?? 220;
    const h = n.measured?.height ?? 90;
    return { ...n, position: { x: Math.round(p.x - w / 2), y: Math.round(p.y - h / 2) } };
  });
}
