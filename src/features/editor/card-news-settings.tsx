'use client';

import type { FormProps } from './inspector/forms-ai';
import { TextField } from './inspector/fields';

export function CardNewsSettings({ cfg, set, disabled }: FormProps) {
  return <div className="space-y-3">
    <TextField label="표지 제목" value={String(cfg.title ?? '국내 주식 브리핑')} onChange={(title) => set({ title })} disabled={disabled} />
    <TextField label="인스타 계정명" value={String(cfg.account ?? 'ryorlr_moa')} onChange={(account) => set({ account })} disabled={disabled} />
    <p className="text-muted text-xs">표지 1장 + 기사 4장 · 1080×1350 JPEG</p>
    <p className="text-muted text-xs">LLM의 JSON 출력을 ‘기사 요약 JSON’에, 뉴스 수집의 articles를 ‘수집 원문’에 연결하세요. 이미지는 실행 콘솔의 ‘카드뉴스’ 탭에서 확인합니다.</p>
    <p className="text-warning text-xs">현재는 검토용 이미지 생성 단계입니다. 인스타 게시 노드는 아직 연결되지 않았습니다.</p>
  </div>;
}
