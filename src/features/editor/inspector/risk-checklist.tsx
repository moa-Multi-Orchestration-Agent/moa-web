'use client';

import { Plus, Trash2 } from 'lucide-react';
import type { ChecklistItem } from '@/entities/workflow';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { AreaField, SelectField, TextField } from './fields';

const LEVEL_OPTIONS = ['높음', '중간', '낮음'].map((v) => ({ value: v, label: v }));

/** 백엔드가 항목을 id로 맞추므로 새 항목에는 겹치지 않는 id를 준다 */
function nextId(items: ChecklistItem[]): string {
  const used = new Set(items.map((c) => c.id));
  let n = items.length + 1;
  while (used.has(`item${n}`)) n += 1;
  return `item${n}`;
}

/** 계약서 검토 노드의 필수 체크리스트. 항목을 펼쳐 고치고, 더하거나 지울 수 있다. */
export function RiskChecklistEditor({ items, onChange, disabled }: { items: ChecklistItem[]; onChange: (next: ChecklistItem[]) => void; disabled?: boolean }) {
  const patch = (i: number, p: Partial<ChecklistItem>) => onChange(items.map((c, j) => (j === i ? { ...c, ...p } : c)));
  return (
    <div className="space-y-1.5">
      <p className="text-muted text-xs">필수 체크리스트 {items.length}개 (모두 검사하고, 빠지면 &quot;확인 필요&quot;로 표시)</p>
      <ol className="space-y-1" aria-label="필수 체크리스트">
        {items.map((c, i) => (
          <li key={c.id} className="bg-surface rounded-md text-xs">
            <details>
              <summary className="flex cursor-pointer items-center gap-1.5 px-2.5 py-1.5">
                <span className="text-muted font-mono">{i + 1}</span>
                <span className="flex-1 font-medium">{c.title || '(제목 없음)'}</span>
                {c.default_level ? <Badge variant="gray">기본 {c.default_level}</Badge> : null}
              </summary>
              <div className="space-y-2 px-2.5 pb-2.5">
                <TextField label="항목 이름" value={c.title} onChange={(v) => patch(i, { title: v })} disabled={disabled} />
                <AreaField label="확인할 것" value={c.check ?? ''} onChange={(v) => patch(i, { check: v })} rows={2} disabled={disabled} />
                <TextField label="관련 법" value={c.law ?? ''} onChange={(v) => patch(i, { law: v })} disabled={disabled} />
                <div className="flex items-end gap-1.5">
                  <div className="flex-1">
                    <SelectField label="기본 위험도" value={c.default_level ?? '중간'} onChange={(v) => patch(i, { default_level: v })} options={LEVEL_OPTIONS} disabled={disabled} />
                  </div>
                  <Button size="icon-sm" variant="ghost" onClick={() => onChange(items.filter((_, j) => j !== i))} disabled={disabled} aria-label={`체크리스트 ${c.title || i + 1} 삭제`}>
                    <Trash2 aria-hidden />
                  </Button>
                </div>
              </div>
            </details>
          </li>
        ))}
      </ol>
      <Button size="sm" variant="outline" onClick={() => onChange([...items, { id: nextId(items), title: '', check: '', law: '', default_level: '중간' }])} disabled={disabled}>
        <Plus aria-hidden /> 항목 추가
      </Button>
    </div>
  );
}
