'use client';

import { useMemo } from 'react';
import { AlertCircle, AlertTriangle, Trash2 } from 'lucide-react';
import type { ValidationIssue } from '@/entities/workflow';
import { Button } from '@/shared/ui/button';
import { nodeColor } from '@/shared/ui/node-colors';
import type { FlowNode } from '../convert';
import { useEditorStore } from '../store';
import { ConditionForm, KbForm, LlmForm, ToolForm, type FormProps } from './forms-ai';
import { ApprovalForm, CodeForm, HttpForm, InputForm, LoopForm, ThreeDForm } from './forms-other';
import { CheckField, Section, TextField } from './fields';
import type { BindingOption } from './template-input';

const FORMS: Partial<Record<string, (p: FormProps) => React.ReactNode>> = {
  llm: LlmForm,
  kb_search: KbForm,
  tool: ToolForm,
  condition: ConditionForm,
  http: HttpForm,
  code: CodeForm,
  three_d: ThreeDForm,
  approval: ApprovalForm,
  input: InputForm,
  loop: LoopForm,
};

/** 검증 결과 목록(인스펙터 상단). 누르면 그 노드로 이동 */
export function IssueList({ onFocus }: { onFocus: (id: string) => void }) {
  const byNode = useEditorStore((s) => s.issues);
  const global = useEditorStore((s) => s.globalIssues);
  const nodes = useEditorStore((s) => s.nodes);
  const all: ValidationIssue[] = [...global, ...Object.values(byNode).flat()];
  if (!all.length) return null;
  const errors = all.filter((i) => i.severity === 'error').length;
  return (
    <section className="border-b px-4 py-3" aria-label="검증 결과">
      <p className={errors ? 'text-danger text-sm font-semibold' : 'text-warning text-sm font-semibold'}>
        {errors ? `오류 ${errors}건` : ''}
        {errors && all.length - errors ? ' · ' : ''}
        {all.length - errors ? `경고 ${all.length - errors}건` : ''}
        <span className="text-muted font-normal"> — 저장은 되지만 버전 저장·배포가 막힙니다</span>
      </p>
      <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto">
        {all.map((i, k) => {
          const n = nodes.find((x) => x.id === i.node_id);
          const Icon = i.severity === 'error' ? AlertCircle : AlertTriangle;
          return (
            <li key={k}>
              <button
                type="button"
                disabled={!n}
                onClick={() => n && onFocus(n.id)}
                className="hover:bg-surface flex w-full items-start gap-2 rounded px-2 py-1 text-left text-xs disabled:cursor-default"
              >
                <Icon className={i.severity === 'error' ? 'text-danger mt-0.5 size-3.5 shrink-0' : 'text-warning mt-0.5 size-3.5 shrink-0'} aria-hidden />
                <span>
                  <span className="font-mono">{i.code}</span> {n ? <b>{n.data.name}</b> : null} {i.message}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function Inspector({ readOnly }: { readOnly?: boolean; onFocus?: (id: string) => void }) {
  const nodes = useEditorStore((s) => s.nodes);
  const edges = useEditorStore((s) => s.edges);
  const selected = nodes.filter((n) => n.selected);
  const node = selected.length === 1 ? selected[0]! : null;
  const updateConfig = useEditorStore((s) => s.updateConfig);
  const updateNode = useEditorStore((s) => s.updateNode);
  const deleteSelected = useEditorStore((s) => s.deleteSelected);

  // 이 노드보다 앞에 있는(조상) 노드의 출력 → {{노드.output.필드}} 후보
  const bindings: BindingOption[] = useMemo(() => {
    if (!node) return [];
    const parents = new Map<string, string[]>();
    for (const e of edges) parents.set(e.target, [...(parents.get(e.target) ?? []), e.source]);
    const seen = new Set<string>();
    const stack = [...(parents.get(node.id) ?? [])];
    while (stack.length) {
      const id = stack.pop()!;
      if (seen.has(id)) continue;
      seen.add(id);
      stack.push(...(parents.get(id) ?? []));
    }
    const ordered = [...nodes.filter((n) => seen.has(n.id)), ...nodes.filter((n) => !seen.has(n.id) && n.id !== node.id)];
    return ordered.flatMap((n) => (n.data.ports_out ?? []).map((p) => ({ value: `${n.id}.output.${p.name}`, label: `${n.data.name} › ${p.name}`, type: p.type })));
  }, [node, nodes, edges]);

  if (selected.length > 1) {
    return (
      <div className="space-y-3 p-4">
        <p className="text-sm font-semibold">노드 {selected.length}개 선택됨</p>
        <p className="text-muted text-xs">⌘C로 복사, ⌘V로 붙여넣기, Delete로 한꺼번에 지웁니다.</p>
        <Button variant="outline" size="sm" onClick={deleteSelected} disabled={readOnly}>
          <Trash2 aria-hidden /> 선택한 노드 삭제
        </Button>
      </div>
    );
  }
  if (!node) {
    return (
      <div className="text-muted space-y-2 p-4 text-sm">
        <p className="text-foreground font-semibold">노드 설정</p>
        <p>캔버스에서 노드를 누르면 여기서 설정합니다.</p>
        <p className="text-xs">Tab으로 노드를 차례로 고르고, 방향키로 옮길 수 있어요.</p>
      </div>
    );
  }
  const c = nodeColor(node.data.type);
  const cfg = node.data.config as Record<string, unknown>;
  const Form = FORMS[node.data.type];
  const set = (patch: Record<string, unknown>) => updateConfig(node.id, patch);
  const setData = (patch: Partial<FlowNode['data']>) => updateNode(node.id, patch);

  return (
    <div className="pb-6" data-testid="inspector">
      <Section>
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold" style={{ color: c.accent }}>
            {c.label} · <span className="text-muted font-mono font-normal">{node.id}</span>
          </span>
          <Button variant="ghost" size="sm" onClick={deleteSelected} disabled={readOnly} aria-label={`${node.data.name} 노드 삭제`}>
            삭제
          </Button>
        </div>
        <TextField label="이름" value={node.data.name} onChange={(v) => setData({ name: v })} disabled={readOnly} />
      </Section>
      {Form ? (
        <Section title="설정">
          <Form node={node} cfg={cfg} set={set} setData={setData} disabled={readOnly} bindings={bindings} />
        </Section>
      ) : (
        <Section>
          <p className="text-muted text-sm">이 노드는 따로 설정할 것이 없어요.</p>
        </Section>
      )}
      {node.data.type !== 'input' && node.data.type !== 'output' ? (
        <Section title="실행 안정성">
          <div className="grid grid-cols-2 gap-3">
            <TextField label="타임아웃(초)" type="number" value={node.data.timeout_s ?? 60} onChange={(v) => setData({ timeout_s: Math.max(1, Number(v) || 60) })} disabled={readOnly} />
            <TextField label="재시도(회)" type="number" value={node.data.retry?.max_attempts ?? 1} onChange={(v) => setData({ retry: { max_attempts: Math.min(10, Math.max(1, Number(v) || 1)) } })} disabled={readOnly} />
          </div>
          {node.data.type === 'tool' || node.data.type === 'http' ? (
            <CheckField label="실패해도 다음 노드로 계속" checked={cfg.on_error === 'continue'} onChange={(v) => set({ on_error: v ? 'continue' : 'stop' })} disabled={readOnly} />
          ) : null}
        </Section>
      ) : null}
    </div>
  );
}
