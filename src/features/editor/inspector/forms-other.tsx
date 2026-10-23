'use client';

import { Plus, Trash2 } from 'lucide-react';
import { inputSchemaOf, type InputField } from '@/entities/workflow';
import { useMembers, useCurrentWorkspace } from '@/entities/workspace';
import { Button } from '@/shared/ui/button';
import { portsFromFields } from '../convert';
import type { FormProps } from './forms-ai';
import { AreaField, CheckField, SelectField, SliderField, TextField } from './fields';
import { TemplateInput } from './template-input';
import { PresetBar, ResultPreview } from './three-d-extras';

export function HttpForm({ cfg, set, disabled }: FormProps) {
  const headers = (cfg.headers as { key: string; value: string }[]) ?? [];
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-[96px_1fr] gap-2">
        <SelectField label="메서드" value={String(cfg.method ?? 'GET')} onChange={(v) => set({ method: v })} options={['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => ({ value: m, label: m }))} disabled={disabled} />
        <TextField label="URL" value={String(cfg.url ?? '')} onChange={(v) => set({ url: v })} mono disabled={disabled} />
      </div>
      {/^https?:\/\/(localhost|127\.|10\.|169\.254\.|192\.168\.)/.test(String(cfg.url ?? '')) ? <p className="text-danger text-xs">내부 주소는 실행 시 차단됩니다(SSRF 방어, design.md 2.2.3).</p> : null}
      <p className="text-muted text-xs">헤더</p>
      {headers.map((h, i) => (
        <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-end gap-1.5">
          <TextField label="이름" value={h.key} onChange={(v) => set({ headers: headers.map((x, j) => (j === i ? { ...x, key: v } : x)) })} mono disabled={disabled} />
          <TextField label="값" value={h.value} onChange={(v) => set({ headers: headers.map((x, j) => (j === i ? { ...x, value: v } : x)) })} mono disabled={disabled} />
          <Button size="icon-sm" variant="ghost" onClick={() => set({ headers: headers.filter((_, j) => j !== i) })} disabled={disabled} aria-label={`헤더 ${h.key || i + 1} 삭제`}>
            <Trash2 aria-hidden />
          </Button>
        </div>
      ))}
      <Button size="sm" variant="outline" onClick={() => set({ headers: [...headers, { key: '', value: '' }] })} disabled={disabled}>
        <Plus aria-hidden /> 헤더 추가
      </Button>
    </div>
  );
}

export function CodeForm({ cfg, set, disabled, bindings }: FormProps) {
  if (cfg.template !== undefined) return <TemplateInput label="텍스트 템플릿" value={String(cfg.template ?? '')} onChange={(v) => set({ template: v })} options={bindings} disabled={disabled} />;
  if (cfg.expression !== undefined) return <TextField label="JSONPath" value={String(cfg.expression)} onChange={(v) => set({ expression: v })} mono disabled={disabled} />;
  if (cfg.seconds !== undefined) return <SliderField label="대기(초)" value={Number(cfg.seconds)} onChange={(v) => set({ seconds: v })} min={1} max={600} disabled={disabled} />;
  return (
    <div className="space-y-3">
      <SelectField label="언어" value={String(cfg.language ?? 'python')} onChange={(v) => set({ language: v })} options={[{ value: 'python', label: 'Python 3.11' }]} disabled={disabled} />
      <AreaField label="코드 (네트워크 차단 샌드박스 · 10초)" value={String(cfg.code ?? '')} onChange={(v) => set({ code: v })} mono rows={9} disabled={disabled} />
    </div>
  );
}

export function ThreeDForm({ node, cfg, set, disabled, bindings }: FormProps) {
  const formats = (cfg.formats as string[]) ?? ['glb'];
  const toggle = (f: string) => set({ formats: formats.includes(f) ? formats.filter((x) => x !== f) : [...formats, f] });
  return (
    <div className="space-y-3">
      <p className="bg-primary-soft text-primary rounded-md px-3 py-2 text-xs font-medium">오래 걸리는 작업이라 비동기 실행으로 고정됩니다</p>
      <PresetBar cfg={cfg} set={set} disabled={disabled} />
      <SelectField label="모드" value={String(cfg.mode ?? 'image_to_3d')} onChange={(v) => set({ mode: v })} options={[{ value: 'image_to_3d', label: '이미지 → 3D' }, { value: 'text_to_scene', label: '텍스트 → 장면' }, { value: 'edit', label: '편집' }, { value: 'render', label: '렌더링' }, { value: 'convert', label: '포맷 변환' }]} disabled={disabled} />
      {cfg.image !== undefined ? (
        <SelectField label="입력 이미지" value={String(cfg.image ?? '')} onChange={(v) => set({ image: v })} options={bindings.map((b) => ({ value: `{{${b.value}}}`, label: b.label }))} disabled={disabled} placeholder="앞 노드 출력 고르기" />
      ) : null}
      <SelectField label="해상도" value={String(cfg.resolution ?? 'medium')} onChange={(v) => set({ resolution: v })} options={[{ value: 'low', label: '낮음 (미리보기)' }, { value: 'medium', label: '보통' }, { value: 'high', label: '높음' }]} disabled={disabled} />
      {cfg.volume !== undefined ? (
        <>
          <p className="text-sm font-semibold">형태 파라미터</p>
          <SliderField label="볼륨감" value={Number(cfg.volume)} onChange={(v) => set({ volume: v })} disabled={disabled} />
          <SliderField label="메시 밀도" value={Number(cfg.density ?? 40)} onChange={(v) => set({ density: v })} disabled={disabled} />
          <SliderField label="스타일 적용도" value={Number(cfg.style ?? 70)} onChange={(v) => set({ style: v })} disabled={disabled} />
          <CheckField label="좌우 대칭 보정" checked={!!cfg.symmetry} onChange={(v) => set({ symmetry: v })} disabled={disabled} />
        </>
      ) : null}
      <fieldset className="space-y-1.5">
        <legend className="text-muted text-xs">내보내기 형식</legend>
        <div className="flex gap-4">
          {['glb', 'obj', 'fbx'].map((f) => (
            <CheckField key={f} label={f === 'glb' ? 'glTF' : f.toUpperCase()} checked={formats.includes(f)} onChange={() => toggle(f)} disabled={disabled} />
          ))}
        </div>
      </fieldset>
      <div className="space-y-1.5">
        <p className="text-sm font-semibold">결과 미리보기</p>
        <ResultPreview nodeId={node.id} />
      </div>
    </div>
  );
}

export function ApprovalForm({ cfg, set, disabled, bindings }: FormProps) {
  const { workspace } = useCurrentWorkspace();
  const members = useMembers(workspace?.id);
  const approvers = (cfg.approvers as string[]) ?? [];
  return (
    <div className="space-y-3">
      <fieldset className="space-y-1.5">
        <legend className="text-muted text-xs">승인자 (비우면 관리자 이상 누구나)</legend>
        {(members.data ?? [])
          .filter((m) => m.role !== 'viewer')
          .map((m) => (
            <CheckField key={m.userId} label={`${m.user.display_name} · ${m.role}`} checked={approvers.includes(m.userId)} onChange={(v) => set({ approvers: v ? [...approvers, m.userId] : approvers.filter((x) => x !== m.userId) })} disabled={disabled} />
          ))}
      </fieldset>
      <TemplateInput label="요약 문구(승인 화면에 보임)" value={String(cfg.summary ?? '')} onChange={(v) => set({ summary: v })} options={bindings} rows={3} disabled={disabled} />
      <p className="text-muted text-xs">72시간 안에 결정하지 않으면 만료되어 실행이 실패합니다(MOA-APR-002).</p>
    </div>
  );
}

/** 입력 노드: 필드 스키마 정의 → 출력 포트이자 배포 시 API 입력 스키마 */
export function InputForm({ cfg, set, setData, disabled }: FormProps) {
  const fields = (cfg.fields as InputField[]) ?? [];
  const update = (next: InputField[]) => {
    set({ fields: next });
    setData({ ports_out: portsFromFields(next) });
  };
  return (
    <div className="space-y-3">
      <SelectField label="트리거" value={String(cfg.trigger ?? 'manual')} onChange={(v) => set({ trigger: v })} options={[{ value: 'manual', label: '수동 실행' }, { value: 'agent', label: '에이전트 · API 호출' }, { value: 'schedule', label: '예약 (Cron)' }, { value: 'webhook', label: 'Webhook 수신' }, { value: 'mail', label: '메일 수신' }]} disabled={disabled} />
      {cfg.trigger === 'schedule' ? <TextField label="Cron 식" value={String(cfg.cron ?? '0 9 * * *')} onChange={(v) => set({ cron: v })} mono disabled={disabled} hint="예: 0 9 * * * (매일 09:00)" /> : null}
      <p className="text-sm font-semibold">입력 필드</p>
      {fields.map((f, i) => (
        <div key={i} className="space-y-2 rounded-md border p-2.5">
          <div className="grid grid-cols-[1fr_110px_auto] items-end gap-1.5">
            <TextField label="이름" value={f.name} onChange={(v) => update(fields.map((x, j) => (j === i ? { ...x, name: v.replace(/[^a-zA-Z0-9_]/g, '') } : x)))} mono disabled={disabled} />
            <SelectField label="타입" value={f.type} onChange={(v) => update(fields.map((x, j) => (j === i ? { ...x, type: v as InputField['type'] } : x)))} options={['string', 'number', 'integer', 'boolean', 'array', 'object'].map((t) => ({ value: t, label: t }))} disabled={disabled} />
            <Button size="icon-sm" variant="ghost" onClick={() => update(fields.filter((_, j) => j !== i))} disabled={disabled} aria-label={`필드 ${f.name || i + 1} 삭제`}>
              <Trash2 aria-hidden />
            </Button>
          </div>
          <TextField label="설명" value={f.description ?? ''} onChange={(v) => update(fields.map((x, j) => (j === i ? { ...x, description: v } : x)))} disabled={disabled} />
          <CheckField label="필수" checked={!!f.required} onChange={(v) => update(fields.map((x, j) => (j === i ? { ...x, required: v } : x)))} disabled={disabled} />
        </div>
      ))}
      <Button size="sm" variant="outline" onClick={() => update([...fields, { name: `field${fields.length + 1}`, type: 'string', required: false }])} disabled={disabled}>
        <Plus aria-hidden /> 필드 추가
      </Button>
      <details className="text-xs">
        <summary className="text-muted cursor-pointer">배포 시 API 입력 스키마 미리보기</summary>
        <pre className="bg-surface mt-2 overflow-auto rounded p-2 font-mono">{JSON.stringify(inputSchemaOf({ nodes: [{ id: 'in', type: 'input', name: '', config: { fields }, ports_in: [], ports_out: [] }] }), null, 2)}</pre>
      </details>
    </div>
  );
}

export function LoopForm({ cfg, set, disabled }: FormProps) {
  return <SliderField label="최대 반복 횟수 (상한 50)" value={Number(cfg.max_iter ?? 20)} onChange={(v) => set({ max_iter: v })} min={1} max={50} disabled={disabled} />;
}
