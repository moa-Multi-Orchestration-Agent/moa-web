/**
 * 그래프 검증·정렬 (design.md 2.2.1 GraphCompiler.validate를 그대로 옮김).
 * 편집기 포트 연결 검사와 목 API 검증이 같은 함수를 쓴다.
 */
import type { EdgeDef, NodeDef, PortType, ValidationIssue, WorkflowDefinition } from './model';

export function isAssignable(src: PortType | undefined, dst: PortType | undefined): boolean {
  if (!src || !dst) return true;
  if (src === 'any' || dst === 'any') return true;
  if (src === dst) return true;
  if (src === 'integer' && dst === 'number') return true;
  if (src === 'image' && dst === 'string') return false;
  return false;
}

export function portType(node: NodeDef | undefined, port: string, dir: 'in' | 'out'): PortType | undefined {
  if (!node) return undefined;
  const ports = dir === 'in' ? node.ports_in : node.ports_out;
  return ports.find((p) => p.name === port)?.type;
}

/** loop 노드가 허용한 되돌아가기 엣지(조건 'loop_back' 또는 'retry')는 순환 검사에서 뺀다 */
export function isLoopBackEdge(e: EdgeDef): boolean {
  return e.condition === 'loop_back' || e.condition === 'retry';
}

const issue = (
  code: string,
  node_id: string | null,
  message: string,
  severity: 'error' | 'warn' = 'error',
  port: string | null = null,
): ValidationIssue => ({ code, node_id, port, message, severity });

export function validateDefinition(defn: Pick<WorkflowDefinition, 'nodes' | 'edges'>): {
  issues: ValidationIssue[];
  order: string[];
} {
  const issues: ValidationIssue[] = [];
  const byId = new Map(defn.nodes.map((n) => [n.id, n]));
  const starts = defn.nodes.filter((n) => n.type === 'input');
  if (starts.length !== 1) {
    issues.push(
      issue('MOA-WF-004', starts[1]?.id ?? null, starts.length === 0 ? '시작(입력) 노드가 없습니다' : '입력 노드는 정확히 1개여야 합니다'),
    );
  }

  const adj = new Map<string, string[]>();
  const indeg = new Map<string, number>();
  for (const n of defn.nodes) {
    adj.set(n.id, []);
    indeg.set(n.id, 0);
  }
  for (const e of defn.edges) {
    if (!byId.has(e.source) || !byId.has(e.target)) {
      issues.push(issue('MOA-WF-002', byId.has(e.target) ? e.target : null, '없는 노드를 가리키는 연결'));
      continue;
    }
    if (isLoopBackEdge(e)) continue;
    adj.get(e.source)!.push(e.target);
    indeg.set(e.target, (indeg.get(e.target) ?? 0) + 1);
    const srcT = portType(byId.get(e.source), e.source_port, 'out');
    const dstT = portType(byId.get(e.target), e.target_port, 'in');
    if (!isAssignable(srcT, dstT)) {
      issues.push(issue('MOA-WF-003', e.target, `${srcT} → ${dstT} 연결 불가`, 'error', e.target_port));
    }
  }

  const order = topoOrder(defn.nodes, adj, indeg);
  if (order.length !== defn.nodes.length) {
    const cyc = defn.nodes.filter((n) => !order.includes(n.id)).map((n) => n.id);
    issues.push(issue('MOA-WF-001', cyc[0] ?? null, `순환: ${cyc.join(' → ')}`));
  }

  for (const n of defn.nodes) {
    for (const p of n.ports_in) {
      if (!p.required) continue;
      const connected = defn.edges.some((e) => e.target === n.id && e.target_port === p.name && byId.has(e.source));
      const inConfig = n.config && Object.prototype.hasOwnProperty.call(n.config, p.name) && n.config[p.name] !== '';
      if (!connected && !inConfig) issues.push(issue('MOA-WF-002', n.id, `${p.label ?? p.name} 입력 없음`, 'error', p.name));
    }
    if (n.type === 'llm' && !n.config?.prompt) {
      issues.push(issue('MOA-WF-002', n.id, '프롬프트가 비어 있습니다', 'warn', 'prompt'));
    }
  }
  return { issues, order };
}

function topoOrder(nodes: NodeDef[], adj: Map<string, string[]>, indegIn: Map<string, number>): string[] {
  const indeg = new Map(indegIn);
  const q: string[] = nodes.filter((n) => (indeg.get(n.id) ?? 0) === 0).map((n) => n.id);
  const order: string[] = [];
  while (q.length) {
    const u = q.shift()!;
    order.push(u);
    for (const v of adj.get(u) ?? []) {
      indeg.set(v, (indeg.get(v) ?? 0) - 1);
      if (indeg.get(v) === 0) q.push(v);
    }
  }
  return order;
}

/** 입력 노드의 필드 정의 → JSON Schema (배포 시 API 입력 스키마, design.md 2.3.1) */
export interface InputField {
  name: string;
  type: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object';
  required?: boolean;
  description?: string;
  enum?: string[];
  default?: unknown;
}

export function inputFieldsOf(defn: Pick<WorkflowDefinition, 'nodes'>): InputField[] {
  const input = defn.nodes.find((n) => n.type === 'input');
  return ((input?.config?.fields as InputField[] | undefined) ?? []).filter((f) => f && f.name);
}

export function inputSchemaOf(defn: Pick<WorkflowDefinition, 'nodes'>): Record<string, unknown> {
  const fields = inputFieldsOf(defn);
  const properties: Record<string, unknown> = {};
  for (const f of fields) {
    properties[f.name] = {
      type: f.type,
      ...(f.description ? { description: f.description } : {}),
      ...(f.enum?.length ? { enum: f.enum } : {}),
      ...(f.default !== undefined ? { default: f.default } : {}),
    };
  }
  return {
    type: 'object',
    properties,
    required: fields.filter((f) => f.required).map((f) => f.name),
    additionalProperties: false,
  };
}

/** 입력 스키마로 예시 본문 만들기(호출 예시·플레이그라운드) */
export function exampleFromSchema(schema: Record<string, unknown>): Record<string, unknown> {
  const props = (schema.properties ?? {}) as Record<string, { type?: string; enum?: string[]; default?: unknown; description?: string }>;
  const out: Record<string, unknown> = {};
  for (const [k, p] of Object.entries(props)) {
    if (p.default !== undefined) out[k] = p.default;
    else if (p.enum?.length) out[k] = p.enum[0];
    else if (p.type === 'number' || p.type === 'integer') out[k] = 1200;
    else if (p.type === 'boolean') out[k] = true;
    else if (p.type === 'array') out[k] = [];
    else if (p.type === 'object') out[k] = {};
    else out[k] = p.description ? `${p.description} 예시` : '예시 값';
  }
  return out;
}

/** {{노드.output.필드}} 바인딩 (design.md 2.2.1 BINDING_RE) */
export const BINDING_RE = /\{\{\s*([\w-]+)\.output(\.[\w[\].]+)?\s*\}\}/g;
export function bindingsIn(text: string): { node: string; path: string }[] {
  return [...text.matchAll(BINDING_RE)].map((m) => ({ node: m[1]!, path: (m[2] ?? '').replace(/^\./, '') }));
}
