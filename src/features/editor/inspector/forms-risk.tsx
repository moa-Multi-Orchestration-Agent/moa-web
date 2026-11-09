'use client';

import { Plus, Trash2 } from 'lucide-react';
import { MODELS } from '@/entities/agent';
import { boundCredential, modelPresets, useModels } from '@/entities/credential';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { ModelPicker } from '@/shared/ui/model-params';
import { ModelKeyField, type FormProps } from './forms-ai';
import { CheckField, SelectField, SliderField, TextField } from './fields';

interface ChecklistItem {
  id: string;
  title: string;
  check?: string;
  law?: string;
  default_level?: string;
}
interface Criterion {
  label: string;
  value: string;
}

const modelOptions = MODELS.map((m) => ({ value: m.id, label: m.label }));

/** llm.risk_check: 체크리스트·기준값은 config에 있고, 여기서는 보고 고칠 수 있게만 보여 준다 */
export function RiskCheckForm({ cfg, set, disabled, bindings }: FormProps) {
  const model = String(cfg.model ?? 'claude-sonnet-4');
  const models = useModels();
  const checklist = (cfg.checklist as ChecklistItem[] | undefined) ?? [];
  const criteria = (cfg.criteria as Criterion[] | undefined) ?? [];
  const setCriterion = (i: number, patch: Partial<Criterion>) => set({ criteria: criteria.map((c, j) => (j === i ? { ...c, ...patch } : c)) });
  return (
    <div className="space-y-3">
      <ModelPicker label="모델" value={model} onChange={(v) => set({ model: v, credential_id: boundCredential(models.data, v) })} presets={modelPresets(modelOptions, models.data)} disabled={disabled} />
      <ModelKeyField model={model} credentialId={(cfg.credential_id as string | null) ?? null} onChange={(id) => set({ credential_id: id })} disabled={disabled} />
      <SelectField
        label="검사할 문서"
        value={String(cfg.document ?? '')}
        onChange={(v) => set({ document: v })}
        options={bindings.map((b) => ({ value: `{{${b.value}}}`, label: b.label }))}
        disabled={disabled}
        placeholder="앞 노드 출력 고르기 ({filename, text})"
      />
      <TextField label="계약서 종류" value={String(cfg.contract_kind ?? '')} onChange={(v) => set({ contract_kind: v })} disabled={disabled} />

      <div className="space-y-1.5">
        <p className="text-muted text-xs">필수 체크리스트 {checklist.length}개 (모두 검사하고, 빠지면 &quot;확인 필요&quot;로 표시)</p>
        <ol className="space-y-1" aria-label="필수 체크리스트">
          {checklist.map((c, i) => (
            <li key={c.id} className="bg-surface rounded-md px-2.5 py-1.5 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="text-muted font-mono">{i + 1}</span>
                <span className="flex-1 font-medium">{c.title}</span>
                {c.default_level ? <Badge variant="gray">기본 {c.default_level}</Badge> : null}
              </div>
              {c.law ? <p className="text-muted mt-0.5">{c.law}</p> : null}
            </li>
          ))}
        </ol>
      </div>

      <div className="space-y-1.5">
        <p className="text-muted text-xs">판단 기준값</p>
        {criteria.map((c, i) => (
          <div key={i} className="grid grid-cols-[1fr_120px_auto] items-end gap-1.5">
            <TextField label="항목" value={c.label} onChange={(v) => setCriterion(i, { label: v })} disabled={disabled} />
            <TextField label="값" value={c.value} onChange={(v) => setCriterion(i, { value: v })} disabled={disabled} />
            <Button size="icon-sm" variant="ghost" onClick={() => set({ criteria: criteria.filter((_, j) => j !== i) })} disabled={disabled} aria-label={`기준값 ${c.label || i + 1} 삭제`}>
              <Trash2 aria-hidden />
            </Button>
          </div>
        ))}
        <Button size="sm" variant="outline" onClick={() => set({ criteria: [...criteria, { label: '', value: '' }] })} disabled={disabled}>
          <Plus aria-hidden /> 기준값 추가
        </Button>
      </div>

      <CheckField label="체크리스트 밖 위험도 찾기(추가 발견)" checked={cfg.find_extra !== false} onChange={(v) => set({ find_extra: v })} disabled={disabled} />
      <SliderField label="계약서 1건 최대 글자 수" value={Number(cfg.max_chars_per_contract ?? 1800)} onChange={(v) => set({ max_chars_per_contract: v })} min={800} max={4000} step={100} disabled={disabled} />
      <p className="text-muted text-[11px]">원문에 없는 인용은 &quot;원문 확인 필요&quot;로 표시됩니다. 키가 없어 데모 모델로 돌면 결과 맨 위에 형식 확인용이라는 경고가 붙습니다.</p>
    </div>
  );
}
