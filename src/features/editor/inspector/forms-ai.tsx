'use client';

import { Plus, Trash2 } from 'lucide-react';
import { MODELS } from '@/entities/agent';
import { useKnowledgeBases } from '@/entities/credential';
import { useMcpTools } from '@/entities/mcp';
import { Button } from '@/shared/ui/button';
import { Badge } from '@/shared/ui/badge';
import type { FlowNode } from '../convert';
import { CheckField, SelectField, SliderField, TextField } from './fields';
import { TemplateInput, type BindingOption } from './template-input';

export interface FormProps {
  node: FlowNode;
  cfg: Record<string, unknown>;
  set: (patch: Record<string, unknown>) => void;
  setData: (patch: Partial<FlowNode['data']>) => void;
  disabled?: boolean;
  bindings: BindingOption[];
}

const modelOptions = MODELS.map((m) => ({ value: m.id, label: m.label }));

export function LlmForm({ cfg, set, disabled, bindings }: FormProps) {
  const fallbacks = (cfg.fallback_models as string[]) ?? [];
  return (
    <div className="space-y-3">
      <SelectField label="모델" value={String(cfg.model ?? 'claude-sonnet-4')} onChange={(v) => set({ model: v })} options={modelOptions} disabled={disabled} />
      <TemplateInput label="프롬프트 템플릿" value={String(cfg.prompt ?? '')} onChange={(v) => set({ prompt: v })} options={bindings} disabled={disabled} />
      <div className="space-y-1.5">
        <p className="text-muted text-xs">실패 시 대체 모델(순서대로)</p>
        {fallbacks.map((m, i) => (
          <div key={`${m}-${i}`} className="flex items-center gap-2">
            <Badge variant="gray">{i + 1}</Badge>
            <span className="flex-1 text-sm">{MODELS.find((x) => x.id === m)?.label ?? m}</span>
            <Button size="icon-xs" variant="ghost" onClick={() => set({ fallback_models: fallbacks.filter((_, j) => j !== i) })} disabled={disabled} aria-label={`${m} 대체 모델 빼기`}>
              <Trash2 aria-hidden />
            </Button>
          </div>
        ))}
        <SelectField label="대체 모델 추가" value="" onChange={(v) => set({ fallback_models: [...fallbacks, v] })} options={modelOptions.filter((o) => o.value !== cfg.model && !fallbacks.includes(o.value))} disabled={disabled} placeholder="모델 고르기" />
      </div>
      <SliderField label="온도" value={Number(cfg.temperature ?? 0.7)} onChange={(v) => set({ temperature: v })} min={0} max={2} step={0.1} disabled={disabled} />
      {Array.isArray(cfg.labels) ? <TextField label="분류 라벨(쉼표로 구분)" value={(cfg.labels as string[]).join(', ')} onChange={(v) => set({ labels: v.split(',').map((x) => x.trim()).filter(Boolean) })} disabled={disabled} /> : null}
    </div>
  );
}

export function KbForm({ cfg, set, disabled }: FormProps) {
  const kbs = useKnowledgeBases();
  return (
    <div className="space-y-3">
      {cfg.source === 'memory' ? (
        <p className="text-muted text-sm">이 노드는 장기 기억에서 찾습니다.</p>
      ) : (
        <SelectField
          label="지식베이스"
          value={String(cfg.kb_id ?? '')}
          onChange={(v) => set({ kb_id: v, kb_name: kbs.data?.find((k) => k.id === v)?.name })}
          options={(kbs.data ?? []).map((k) => ({ value: k.id, label: `${k.name} · 문서 ${k.doc_count}` }))}
          disabled={disabled}
          placeholder={kbs.isPending ? '불러오는 중…' : '지식베이스 고르기'}
        />
      )}
      <SliderField label="top-k (가져올 문단 수)" value={Number(cfg.top_k ?? 4)} onChange={(v) => set({ top_k: v })} min={1} max={20} disabled={disabled} />
    </div>
  );
}

/** MCP·내장 도구: 도구를 고르면 입력 스키마로 폼을 만든다 */
export function ToolForm({ cfg, set, disabled }: FormProps) {
  const tools = useMcpTools();
  const servers = [...new Set((tools.data ?? []).map((t) => t.server_name))];
  const server = String(cfg.mcp_server ?? '');
  const tool = (tools.data ?? []).find((t) => t.server_name === server && t.name === cfg.tool);
  const props = (tool?.input_schema.properties ?? {}) as Record<string, { type?: string; description?: string }>;
  const required = (tool?.input_schema.required as string[] | undefined) ?? [];
  const args = (cfg.args as Record<string, unknown>) ?? {};

  if (!cfg.mcp_server && cfg.tool) {
    return (
      <div className="space-y-3">
        <p className="text-muted text-sm">내장 도구 · {String(cfg.tool)}</p>
        {cfg.to !== undefined ? <TextField label="받는 사람" value={String(cfg.to ?? '')} onChange={(v) => set({ to: v })} disabled={disabled} /> : null}
        {cfg.top_k !== undefined ? <SliderField label="결과 수" value={Number(cfg.top_k)} onChange={(v) => set({ top_k: v })} min={1} max={20} disabled={disabled} /> : null}
        {cfg.channel !== undefined ? <TextField label="채널" value={String(cfg.channel)} onChange={(v) => set({ channel: v })} disabled={disabled} /> : null}
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <SelectField label="MCP 서버" value={server} onChange={(v) => set({ mcp_server: v, tool: null, args: {} })} options={servers.map((s) => ({ value: s, label: s }))} disabled={disabled} placeholder={tools.isPending ? '불러오는 중…' : servers.length ? '서버 고르기' : '연결된 MCP 서버 없음'} />
      {server ? (
        <SelectField
          label="도구"
          value={String(cfg.tool ?? '')}
          onChange={(v) => set({ tool: v, args: {} })}
          options={(tools.data ?? []).filter((t) => t.server_name === server).map((t) => ({ value: t.name, label: `${t.annotations.title ?? t.name}${t.annotations.destructiveHint ? ' ⚠' : ''}` }))}
          disabled={disabled}
        />
      ) : null}
      {tool?.annotations.destructiveHint ? <p className="bg-warning-soft text-warning rounded-md px-3 py-2 text-xs">쓰기·삭제 작업을 하는 도구입니다. 앞에 승인 노드를 두는 것을 권합니다.</p> : null}
      {tool ? (
        <fieldset className="space-y-3 rounded-md border p-3">
          <legend className="px-1 text-xs font-semibold">입력 (스키마로 자동 생성)</legend>
          {Object.keys(props).length === 0 ? <p className="text-muted text-xs">입력이 없는 도구입니다.</p> : null}
          {Object.entries(props).map(([k, p]) =>
            p.type === 'boolean' ? (
              <CheckField key={k} label={`${k}${required.includes(k) ? ' *' : ''}`} checked={!!args[k]} onChange={(v) => set({ args: { ...args, [k]: v } })} disabled={disabled} />
            ) : (
              <TextField
                key={k}
                label={`${k}${required.includes(k) ? ' *' : ''} · ${p.type ?? 'string'}`}
                value={Array.isArray(args[k]) ? (args[k] as string[]).join(', ') : String(args[k] ?? '')}
                onChange={(v) => set({ args: { ...args, [k]: p.type === 'integer' || p.type === 'number' ? Number(v) : p.type === 'array' ? v.split(',').map((x) => x.trim()) : v } })}
                placeholder={p.description ?? '{{노드.output.필드}} 도 쓸 수 있어요'}
                type={p.type === 'integer' || p.type === 'number' ? 'number' : 'text'}
                disabled={disabled}
              />
            ),
          )}
        </fieldset>
      ) : null}
    </div>
  );
}

export function ConditionForm({ cfg, set, disabled }: FormProps) {
  const rules = (cfg.rules as { left: string; op: string; right: string }[]) ?? [];
  const update = (i: number, patch: Partial<(typeof rules)[number]>) => set({ rules: rules.map((r, j) => (j === i ? { ...r, ...patch } : r)), label: undefined });
  return (
    <div className="space-y-3">
      <p className="text-muted text-xs">모든 규칙이 맞으면 &quot;예(true)&quot;, 아니면 &quot;아니오(false)&quot; 포트로 갑니다.</p>
      {rules.map((r, i) => (
        <div key={i} className="grid grid-cols-[1fr_72px_1fr_auto] items-end gap-1.5">
          <TextField label="값" value={r.left} onChange={(v) => update(i, { left: v })} disabled={disabled} mono />
          <SelectField label="비교" value={r.op} onChange={(v) => update(i, { op: v })} options={['==', '!=', '>', '>=', '<', '<=', 'contains'].map((o) => ({ value: o, label: o }))} disabled={disabled} />
          <TextField label="기준" value={r.right} onChange={(v) => update(i, { right: v })} disabled={disabled} mono />
          <Button size="icon-sm" variant="ghost" onClick={() => set({ rules: rules.filter((_, j) => j !== i) })} disabled={disabled} aria-label={`규칙 ${i + 1} 삭제`}>
            <Trash2 aria-hidden />
          </Button>
        </div>
      ))}
      <Button size="sm" variant="outline" onClick={() => set({ rules: [...rules, { left: 'score', op: '>=', right: '0.5' }] })} disabled={disabled}>
        <Plus aria-hidden /> 규칙 추가
      </Button>
      <TextField label="캔버스에 보일 설명" value={String(cfg.label ?? '')} onChange={(v) => set({ label: v })} placeholder="예: 품질 점수 ≥ 0.7 ?" disabled={disabled} />
    </div>
  );
}
