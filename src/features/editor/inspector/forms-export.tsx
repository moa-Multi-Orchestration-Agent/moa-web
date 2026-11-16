'use client';

import type { FormProps } from './forms-ai';
import { SelectField, SliderField } from './fields';
import { TemplateInput } from './template-input';

/** 문서 내보내기(data.export_document): 앞 노드가 쓴 마크다운을 PDF·PNG 파일로 만든다. */
export function ExportForm({ cfg, set, disabled, bindings }: FormProps) {
  const fmt = String(cfg.format ?? 'pdf');
  return (
    <div className="space-y-3">
      <SelectField label="형식" value={fmt} onChange={(v) => set({ format: v })} options={[{ value: 'pdf', label: 'PDF 문서' }, { value: 'png', label: 'PNG 이미지 (내용을 그림으로)' }]} disabled={disabled} />
      <TemplateInput label="제목 (비우면 제목 없이)" value={String(cfg.title ?? '')} onChange={(v) => set({ title: v })} options={bindings} disabled={disabled} rows={1} />
      <TemplateInput label="파일 이름 (비우면 제목이나 '문서')" value={String(cfg.filename ?? '')} onChange={(v) => set({ filename: v })} options={bindings} disabled={disabled} rows={1} />
      {fmt === 'pdf' ? (
        <SelectField label="용지 크기" value={String(cfg.page_size ?? 'A4')} onChange={(v) => set({ page_size: v })} options={[{ value: 'A4', label: 'A4' }, { value: 'Letter', label: 'Letter' }]} disabled={disabled} />
      ) : (
        <SliderField label={`이미지 너비 ${Number(cfg.width ?? 1080)}px`} value={Number(cfg.width ?? 1080)} onChange={(v) => set({ width: v })} min={480} max={2400} step={40} disabled={disabled} />
      )}
      <p className="text-muted text-xs">제목·목록·인용·코드·굵게 정도의 마크다운을 지원합니다. 표와 이미지는 글로 남습니다. 긴 글은 PDF를 쓰세요.</p>
    </div>
  );
}
