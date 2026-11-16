'use client';

import { useWorkflows } from '@/entities/workflow';
import { useEditorStore } from '../store';
import type { FormProps } from './forms-ai';
import { SelectField, SliderField, TextField } from './fields';

/** logic.map: 항목마다 하위 워크플로를 동시에 실행한다 */
export function MapForm({ cfg, set, disabled }: FormProps) {
  const currentId = useEditorStore((s) => s.workflowId);
  const workflows = useWorkflows({ limit: 100, sort: 'name' });
  // 지금 편집 중인 워크플로는 고를 수 없다(자기 자신을 하위로 부르면 하위 실행 안에서 막힌다)
  const options = workflows.items.filter((w) => w.id !== currentId).map((w) => ({ value: w.id, label: w.name }));
  return (
    <div className="space-y-3">
      <SelectField
        label="하위 워크플로"
        value={String(cfg.workflow_id ?? '')}
        onChange={(v) => set({ workflow_id: v })}
        options={options}
        disabled={disabled}
        placeholder={workflows.isPending ? '불러오는 중…' : workflows.isError ? '목록을 불러오지 못했습니다' : '항목마다 실행할 워크플로 고르기'}
      />
      <SliderField label="동시 실행 수" value={Number(cfg.concurrency ?? 5)} onChange={(v) => set({ concurrency: v })} min={1} max={20} disabled={disabled} />
      <SliderField label="최대 항목 수 (넘는 항목은 건너뜀)" value={Number(cfg.max_items ?? 20)} onChange={(v) => set({ max_items: v })} min={1} max={100} disabled={disabled} />
      <TextField label="항목별 타임아웃(초)" type="number" value={Number(cfg.item_timeout_s ?? 300)} onChange={(v) => set({ item_timeout_s: Math.max(1, Number(v) || 300) })} disabled={disabled} />
      <TextField label="항목을 넣을 입력 필드" value={String(cfg.item_field ?? '')} onChange={(v) => set({ item_field: v.trim() })} mono disabled={disabled} hint="비우면 항목이 객체일 때 그대로, 아니면 item 필드로 넘깁니다" />
      <TextField label="순번을 넣을 입력 필드(선택)" value={String(cfg.index_field ?? '')} onChange={(v) => set({ index_field: v.trim() })} mono disabled={disabled} />
      <ul className="bg-surface text-muted list-disc space-y-1 rounded-md py-2 pr-3 pl-6 text-xs">
        <li>하위 워크플로는 저장된 초안으로 실행됩니다.</li>
        <li>실패한 항목은 results에도 표시되지만, 실패 여부는 errors의 index로 판단하세요.</li>
        <li>전체 시간이 길어질 수 있으니 아래 &quot;실행 안정성&quot;의 노드 타임아웃을 늘리세요.</li>
        <li>승인 단계가 있는 하위 워크플로는 그 항목이 실패합니다.</li>
      </ul>
    </div>
  );
}
