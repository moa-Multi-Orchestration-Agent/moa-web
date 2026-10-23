'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { AlertCircle, CheckCircle2, Hand, Loader2, XCircle } from 'lucide-react';
import { modelLabel } from '@/entities/agent';
import { TRIGGER_LABEL } from '@/entities/workflow';
import { cn } from '@/shared/lib/utils';
import { nodeColor } from '@/shared/ui/node-colors';
import type { FlowNode } from './convert';
import { blockIcon } from './icons';
import { useEditorStore } from './store';

export function nodeSubtitle(d: FlowNode['data']): string {
  const c = d.config as Record<string, unknown>;
  switch (d.type) {
    case 'llm':
      return modelLabel(String(c.model ?? 'claude-sonnet-4'));
    case 'kb_search':
      return String(c.kb_name ?? (c.source === 'memory' ? '장기 기억' : '지식베이스 선택 필요'));
    case 'tool':
      return String(c.mcp_server ? `${c.mcp_server} · ${c.tool ?? '도구 선택'}` : (c.tool ?? '도구'));
    case 'http':
      return `${c.method ?? 'GET'} ${String(c.url ?? '').replace(/^https?:\/\//, '').slice(0, 24)}`;
    case 'three_d':
      return `비동기 · ${((c.formats as string[]) ?? ['glb']).join(', ')}`;
    case 'condition':
      return String(c.label ?? '조건을 정하세요');
    case 'approval':
      return String(c.summary ?? '승인자 확인');
    case 'input':
      return `${TRIGGER_LABEL[String(c.trigger ?? 'manual')] ?? '입력'} · ${(d.ports_out ?? []).map((p) => p.name).join(', ') || '필드 없음'}`;
    case 'output':
      return '결과 반환';
    case 'loop':
      return `최대 ${c.max_iter ?? 20}회`;
    default:
      return d.block ?? d.type;
  }
}

const STATUS = {
  running: { icon: Loader2, text: '실행 중', cls: 'text-primary', spin: true },
  ok: { icon: CheckCircle2, text: '완료', cls: 'text-success', spin: false },
  error: { icon: XCircle, text: '실패', cls: 'text-danger', spin: false },
  waiting: { icon: Hand, text: '승인 대기', cls: 'text-warning', spin: false },
} as const;

function WfNodeView({ id, data, selected }: NodeProps<FlowNode>) {
  const run = useEditorStore((s) => s.runState[id] ?? 'idle');
  const issues = useEditorStore((s) => s.issues[id]);
  const errors = issues?.filter((i) => i.severity === 'error') ?? [];
  const color = nodeColor(data.type);
  const Icon = blockIcon(iconForBlock(data.block, data.type));
  const status = run !== 'idle' ? STATUS[run] : null;
  const ins = data.ports_in ?? [];
  const outs = data.ports_out ?? [];

  return (
    <div
      className={cn(
        'bg-background w-[220px] rounded-lg border-2 shadow-sm transition-shadow',
        selected ? 'border-primary shadow-md' : errors.length ? 'border-danger' : 'border-border',
        run === 'running' && 'ring-primary/40 animate-pulse ring-4',
        run === 'ok' && 'border-success',
        run === 'error' && 'border-danger',
        run === 'waiting' && 'border-warning ring-warning/30 ring-4',
      )}
      data-testid={`node-${id}`}
      data-run={run}
      aria-label={`${data.name} 노드${status ? `, ${status.text}` : ''}${errors.length ? `, 오류 ${errors.length}건` : ''}`}
    >
      <div className="flex items-center gap-1.5 px-3 pt-2">
        <Icon className="size-3.5" style={{ color: color.accent }} aria-hidden />
        <span className="text-[11px] font-semibold" style={{ color: color.accent }}>
          {color.label}
        </span>
        {status ? (
          <span className={cn('ml-auto flex items-center gap-0.5 text-[11px] font-semibold', status.cls)}>
            <status.icon className={cn('size-3.5', status.spin && 'animate-spin')} aria-hidden /> {status.text}
          </span>
        ) : errors.length ? (
          <span className="text-danger ml-auto flex items-center gap-0.5 text-[11px] font-semibold" title={errors.map((e) => e.message).join('\n')}>
            <AlertCircle className="size-3.5" aria-hidden /> 오류 {errors.length}
          </span>
        ) : null}
      </div>
      <div className="px-3 pb-2">
        <p className="truncate text-sm font-bold">{data.name}</p>
        <p className="text-muted truncate text-xs">{nodeSubtitle(data)}</p>
      </div>
      {ins.length || outs.length ? (
        <div className="grid grid-cols-2 border-t py-1 text-[10px]">
          <div>
            {ins.map((p) => (
              <div key={p.name} className="relative flex h-5 items-center pl-3">
                <Handle type="target" position={Position.Left} id={p.name} className="!bg-background !size-2.5 !border-2" style={{ borderColor: color.accent, left: -6 }} title={`${p.name}: ${p.type}${p.required ? ' (필수)' : ''}`} />
                <span className="text-muted truncate">
                  {p.label ?? p.name}
                  {p.required ? <span className="text-danger">*</span> : null}
                </span>
              </div>
            ))}
          </div>
          <div>
            {outs.map((p) => (
              <div key={p.name} className="relative flex h-5 items-center justify-end pr-3">
                <span className="text-muted truncate">{p.label ?? p.name}</span>
                <Handle type="source" position={Position.Right} id={p.name} className="!size-2.5 !border-2" style={{ borderColor: color.accent, background: color.accent, right: -6 }} title={`${p.name}: ${p.type}`} />
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

const BLOCK_ICON: Record<string, string> = {
  input: 'Keyboard',
  output: 'Flag',
  llm: 'Sparkles',
  tool: 'Plug',
  http: 'ArrowLeftRight',
  code: 'Code',
  condition: 'GitBranch',
  loop: 'Repeat',
  parallel: 'Split',
  kb_search: 'BookOpenText',
  three_d: 'Box',
  approval: 'ShieldCheck',
};

let blockIcons: Record<string, string> = {};
export function registerBlockIcons(map: Record<string, string>) {
  blockIcons = map;
}
function iconForBlock(block: string | undefined, type: string) {
  return (block && blockIcons[block]) || BLOCK_ICON[type] || 'Puzzle';
}

export const WfNode = memo(WfNodeView);
export const nodeTypes = { wf: WfNode };
