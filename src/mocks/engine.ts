/**
 * 실행 시뮬레이션의 순수 함수들. 시드 실행 이력과 실시간 시뮬레이터가 함께 쓴다.
 */
import type { NodeDef, WorkflowDefinition } from '@/entities/workflow/model';
import { isLoopBackEdge, validateDefinition } from '@/entities/workflow/graph';
import { MODELS } from '@/entities/agent/model';

export const SAMPLE_GLB = 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/Duck/glTF-Binary/Duck.glb';
export const SAMPLE_PREVIEW = 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/Duck/screenshot/screenshot.png';

/** 조건 분기는 'true' 쪽으로만 간다고 보고, 도달 가능한 노드를 위상 순서대로 돌려준다. */
export function executionPlan(defn: Pick<WorkflowDefinition, 'nodes' | 'edges'>): NodeDef[] {
  const { order } = validateDefinition(defn);
  const byId = new Map(defn.nodes.map((n) => [n.id, n]));
  const start = defn.nodes.find((n) => n.type === 'input');
  if (!start) return order.map((id) => byId.get(id)!).filter(Boolean);
  const reachable = new Set<string>([start.id]);
  const queue = [start.id];
  while (queue.length) {
    const u = queue.shift()!;
    const node = byId.get(u);
    for (const e of defn.edges) {
      if (e.source !== u || isLoopBackEdge(e)) continue;
      if (node?.type === 'condition' && e.source_port === 'false') continue;
      if (!reachable.has(e.target)) {
        reachable.add(e.target);
        queue.push(e.target);
      }
    }
  }
  const ordered = order.filter((id) => reachable.has(id)).map((id) => byId.get(id)!);
  // 순환 등으로 order에 빠진 노드는 뒤에 붙인다
  for (const id of reachable) if (!order.includes(id)) ordered.push(byId.get(id)!);
  return ordered;
}

export function priceOf(model: string | null | undefined) {
  const m = MODELS.find((x) => x.id === model);
  return m ? { in: m.price_in, out: m.price_out } : { in: 1, out: 4 };
}

export function costOf(model: string | null | undefined, tin: number, tout: number) {
  const p = priceOf(model);
  return Number(((tin * p.in + tout * p.out) / 1_000_000).toFixed(6));
}

export function isLlmNode(n: NodeDef) {
  return n.type === 'llm';
}

/** 노드별 토큰 사용량(결정적) */
export function tokensFor(n: NodeDef, salt = 0): { in: number; out: number } {
  if (n.type === 'llm') return { in: 900 + ((n.id.length * 97 + salt * 31) % 700), out: 220 + ((n.name.length * 53 + salt * 17) % 380) };
  if (n.type === 'kb_search') return { in: 40, out: 0 };
  return { in: 0, out: 0 };
}

const LLM_TEXTS: Record<string, string> = {
  default: '요청하신 내용을 정리했습니다. 핵심은 세 가지입니다. 첫째, 목표 사용자와 사용 맥락을 분명히 합니다. 둘째, 비교 대상의 강점과 약점을 표로 정리합니다. 셋째, 다음 단계로 확인할 질문을 남깁니다.',
  summarize: '오늘의 주요 소식 5줄 요약: 1) 오픈소스 에이전트 프레임워크가 MCP 지원을 발표했습니다. 2) 대형 모델의 컨텍스트 창이 다시 늘었습니다. 3) 기업용 에이전트 도입 사례가 증가했습니다. 4) 비용 최적화 기법이 주목받고 있습니다. 5) 평가 지표 표준화 논의가 이어졌습니다.',
  shape: '형태 해석: 한 손 접이 구조, 알루미늄 X 프레임, 등받이 각도 2단, 좌판은 600D 폴리 원단. 비율은 폭 52 · 깊이 48 · 높이 76cm로 잡았습니다.',
  answer: '규정 제12조에 따르면 연차는 입사 1년 미만이어도 월 1일씩 발생합니다. [출처: 사내 규정 v3, 12조]',
  classify: '분류 결과: 결제 문의 (신뢰도 0.86)',
};

export function llmText(n: NodeDef): string {
  const name = n.name;
  if (n.block === 'llm.summarize' || name.includes('요약')) return LLM_TEXTS.summarize!;
  if (name.includes('형태')) return LLM_TEXTS.shape!;
  if (name.includes('답변')) return LLM_TEXTS.answer!;
  if (n.block === 'llm.classify' || name.includes('분류')) return LLM_TEXTS.classify!;
  return LLM_TEXTS.default!;
}

/** 노드 출력(목). 3D 노드는 공개 샘플 glb와 미리보기 이미지를 돌려준다. */
export function fakeOutput(n: NodeDef, input: Record<string, unknown>): unknown {
  switch (n.type) {
    case 'input':
      return input;
    case 'output':
      return { result: '완료', delivered_at: new Date().toISOString() };
    case 'llm':
      if (n.block === 'llm.classify') return { label: '결제', score: 0.86 };
      if (n.block === 'llm.extract') return { json: { title: '추출 결과', amount: 12000, date: '2026-10-21' } };
      return { text: llmText(n) };
    case 'kb_search':
      return {
        chunks: [
          { doc: String(n.config.kb_name ?? '지식베이스'), score: 0.82, text: '관련 문단 1' },
          { doc: String(n.config.kb_name ?? '지식베이스'), score: 0.77, text: '관련 문단 2' },
        ],
        text: '관련 문단 1\n관련 문단 2',
      };
    case 'tool':
      if (n.block === 'tool.web_search')
        return { results: [1, 2, 3, 4, 5].map((i) => ({ title: `검색 결과 ${i}`, url: `https://example.com/news/${i}` })) };
      if (n.block === 'tool.mail_send') return { message_id: `<${Date.now()}@moa.dev>` };
      if (n.block === 'tool.slack_post') return { ts: '1729651200.000100', channel: n.config.channel ?? '#general' };
      if (n.block === 'tool.notion_page') return { page_url: 'https://notion.so/moa/meeting-notes-1021' };
      return { result: 'ok' };
    case 'http':
      return { response: { status: 200, body: { items: 12 } } };
    case 'code':
      return { result: { rows: 12, ok: true } };
    case 'condition':
      return { branch: 'true', value: 0.82 };
    case 'loop':
      return { done: [1, 2, 3], iterations: 3 };
    case 'parallel':
      return { a: 'A', b: 'B' };
    case 'approval':
      return { approved: true };
    case 'three_d':
      return {
        asset: { format: 'glb', url: SAMPLE_GLB, poly_count: 4212, bytes: 120_484 },
        preview: SAMPLE_PREVIEW,
      };
    default:
      return null;
  }
}

/** 실행 시간(ms) — 시드 데이터용 */
export function latencyFor(n: NodeDef, salt = 0): number {
  const base: Record<string, number> = { input: 20, output: 30, llm: 2400, tool: 900, http: 600, code: 300, kb_search: 450, condition: 40, loop: 1200, parallel: 50, approval: 0, three_d: 18_000 };
  return (base[n.type] ?? 300) + ((n.id.length * 131 + salt * 71) % 800);
}

/** 입력 문구에 따라 실패할 노드: 'fail'이 있으면 가운데쯤 LLM·도구 노드 */
export function failNodeFor(plan: NodeDef[], input: unknown): string | null {
  const text = JSON.stringify(input ?? {}).toLowerCase();
  if (!text.includes('fail')) return null;
  const mids = plan.filter((n) => n.type !== 'input' && n.type !== 'output' && n.type !== 'approval');
  return (mids[Math.floor(mids.length / 2)] ?? mids[0])?.id ?? null;
}

export function errorCodeFor(n: NodeDef): string {
  if (n.type === 'llm') return 'MOA-NODE-001';
  if (n.type === 'tool' || n.type === 'http') return 'MOA-NODE-002';
  if (n.type === 'three_d') return 'MOA-3D-001';
  return 'MOA-NODE-003';
}
