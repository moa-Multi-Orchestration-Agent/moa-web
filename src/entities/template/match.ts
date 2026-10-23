import type { Template } from './model';

/**
 * "설명으로 초안 만들기"(frontend-plan D4): 설계서에 자연어 → 초안 API가 없어,
 * 설명과 가장 많이 겹치는 템플릿을 골라 instantiate 한다. 겹치는 게 없으면 null.
 */
export function pickTemplate(text: string, kind: 'agent' | 'workflow', templates: Template[]): Template | null {
  const words = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2);
  let best: { t: Template; score: number } | null = null;
  for (const t of templates) {
    if (t.kind !== kind) continue;
    const hay = `${t.name} ${t.summary} ${t.skills.join(' ')}`.toLowerCase();
    let score = 0;
    for (const w of words) {
      const stem = w.slice(0, Math.max(2, w.length - 1));
      if (hay.includes(stem)) score += stem.length >= 3 ? 2 : 1;
    }
    if (score > (best?.score ?? 0)) best = { t, score };
  }
  return best && best.score >= 2 ? best.t : null;
}

/** 설명 첫 부분으로 이름을 만든다 */
export function nameFromPrompt(text: string, kind: 'agent' | 'workflow') {
  const first = text.split(/[.\n。!?]/)[0]?.trim() ?? '';
  const cleaned = first.replace(/(을|를)?\s*(만들어\s*줘|만들어\s*주세요|만들어|해\s*줘)$/u, '').trim();
  const base = cleaned.length > 24 ? `${cleaned.slice(0, 24)}…` : cleaned;
  return base || (kind === 'agent' ? '새 에이전트' : '새 워크플로');
}
