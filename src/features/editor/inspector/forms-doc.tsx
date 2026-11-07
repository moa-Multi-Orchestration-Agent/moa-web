'use client';

import type { FormProps } from './forms-ai';
import { SliderField } from './fields';

/** doc.pdf_extract: 입력 files의 PDF에서 텍스트를 뽑는다 */
export function DocExtractForm({ cfg, set, disabled }: FormProps) {
  return (
    <div className="space-y-3">
      <SliderField label="최대 파일 수" value={Number(cfg.max_files ?? 10)} onChange={(v) => set({ max_files: v })} min={1} max={20} disabled={disabled} />
      <div className="bg-surface text-muted space-y-1 rounded-md px-3 py-2 text-xs">
        <p>입력 형식: 파일 목록 (파일당 최대 20MB, PDF만)</p>
        <pre className="font-mono text-[11px] whitespace-pre-wrap">{'[{ "filename": "계약서.pdf", "data_base64": "JVBERi0…" }]'}</pre>
        <p>스캔한 이미지 PDF는 글자를 읽지 못해 그 파일만 오류로 남고, 나머지는 계속 진행합니다.</p>
      </div>
    </div>
  );
}
