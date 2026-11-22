'use client';

import { Plus, Trash2 } from 'lucide-react';
import { MODELS } from '@/entities/agent';
import { boundCredential, modelPresets, useModels } from '@/entities/credential';
import { CONTRACT_PRESETS, CUSTOM_PRESET, contractPreset, presetConfig, type ChecklistItem, type Criterion } from '@/entities/workflow';
import { Button } from '@/shared/ui/button';
import { ModelPicker } from '@/shared/ui/model-params';
import { ModelKeyField, type FormProps } from './forms-ai';
import { AreaField, CheckField, SelectField, SliderField, TextField } from './fields';
import { RiskChecklistEditor } from './risk-checklist';

const PRESET_OPTIONS = [...CONTRACT_PRESETS.map((p) => ({ value: p.id, label: p.label })), { value: CUSTOM_PRESET, label: '직접 입력' }];

/** 프리셋 id가 없는 예전 config는 계약서 종류 이름으로 프리셋을 찾는다 */
function presetIdOf(cfg: Record<string, unknown>): string {
  if (typeof cfg.preset === 'string' && cfg.preset) return cfg.preset;
  return CONTRACT_PRESETS.find((p) => p.contract_kind === cfg.contract_kind)?.id ?? CUSTOM_PRESET;
}

const modelOptions = MODELS.map((m) => ({ value: m.id, label: m.label }));

/** llm.risk_check(계약서 검토): 계약서 종류 프리셋을 고르면 체크리스트·기준값·판단 원칙이 채워지고, 그 위에서 고칠 수 있다 */
export function RiskCheckForm({ cfg, set, disabled, bindings }: FormProps) {
  const model = String(cfg.model ?? 'claude-sonnet-4');
  const models = useModels();
  const checklist = (cfg.checklist as ChecklistItem[] | undefined) ?? [];
  const criteria = (cfg.criteria as Criterion[] | undefined) ?? [];
  const guidance = (cfg.guidance as string[] | undefined) ?? [];
  const presetId = presetIdOf(cfg);
  const preset = contractPreset(presetId);
  const stance = String(cfg.stance ?? '');
  const stanceOptions = [...new Set([...(preset?.stances ?? []), ...(stance ? [stance] : [])])].map((v) => ({ value: v, label: `${v} 입장` }));
  const choosePreset = (id: string) => {
    const p = contractPreset(id);
    set(p ? presetConfig(p) : { preset: CUSTOM_PRESET });
  };
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
      <SelectField label="계약서 종류" value={presetId} onChange={choosePreset} options={PRESET_OPTIONS} disabled={disabled} />
      <p className="text-muted text-[11px]">종류를 바꾸면 체크리스트·기준값·판단 원칙이 그 종류의 기본값으로 바뀝니다. 법 조항은 사용 전에 원문으로 확인하세요.</p>
      {preset ? (
        <SelectField label="검토 입장" value={stance} onChange={(v) => set({ stance: v })} options={stanceOptions} disabled={disabled} />
      ) : (
        <>
          <TextField label="계약서 이름" value={String(cfg.contract_kind ?? '')} onChange={(v) => set({ contract_kind: v })} placeholder="예: 비밀유지계약서" disabled={disabled} />
          <TextField label="검토자 역할" value={String(cfg.reviewer_role ?? '')} onChange={(v) => set({ reviewer_role: v })} placeholder="예: 계약 검토 전문가" disabled={disabled} />
          <TextField label="검토 입장" value={stance} onChange={(v) => set({ stance: v })} placeholder="예: 정보를 받는 쪽" disabled={disabled} />
        </>
      )}

      <RiskChecklistEditor items={checklist} onChange={(next) => set({ checklist: next })} disabled={disabled} />

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

      <AreaField label="판단 원칙 (한 줄에 하나)" value={guidance.join('\n')} onChange={(v) => set({ guidance: v.split('\n') })} rows={4} disabled={disabled} />

      <CheckField label="체크리스트 밖 위험도 찾기(추가 발견)" checked={cfg.find_extra !== false} onChange={(v) => set({ find_extra: v })} disabled={disabled} />
      <SliderField label="계약서 1건 최대 글자 수" value={Number(cfg.max_chars_per_contract ?? 1800)} onChange={(v) => set({ max_chars_per_contract: v })} min={800} max={4000} step={100} disabled={disabled} />
      <p className="text-muted text-[11px]">원문에 없는 인용은 &quot;원문 확인 필요&quot;로 표시됩니다. 키가 없어 데모 모델로 돌면 결과 맨 위에 형식 확인용이라는 경고가 붙습니다.</p>
    </div>
  );
}
