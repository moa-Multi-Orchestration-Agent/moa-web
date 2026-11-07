'use client';

import type { FormProps } from './forms-ai';
import { SliderField, TextField } from './fields';

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

/** logic.collect: 반복 본문 끝에 두고 next 포트에서 반복 노드로 되돌림(loop_back) 엣지를 잇는다 */
export function CollectForm({ cfg, set, disabled }: FormProps) {
  return (
    <div className="space-y-3">
      <TextField label="이어 붙일 텍스트 필드" value={String(cfg.text_field ?? 'text')} onChange={(v) => set({ text_field: v })} mono disabled={disabled} hint="모은 항목마다 이 필드 값을 이어 붙여 text로 냅니다" />
      <p className="text-muted text-xs">반복 노드의 본문 끝에 두고, next 포트에서 반복 노드로 되돌아가는 연결을 이으세요. 다 돈 뒤 다른 노드에서 {'{{이 노드.output.items}}'}로 모은 결과를 씁니다.</p>
    </div>
  );
}
