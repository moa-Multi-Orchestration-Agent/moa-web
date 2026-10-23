/** 시드 워크플로 8개 (노드 4~10개, 조건 분기·승인·3D 예시 포함) */
import type { EdgeDef, WorkflowDefinition } from '@/entities/workflow/model';
import { makeNode } from './blocks';

let edgeSeq = 0;
export const e = (source: string, source_port: string, target: string, target_port: string, condition: string | null = null): EdgeDef => ({
  id: `e${++edgeSeq}`,
  source,
  source_port,
  target,
  target_port,
  condition,
});

const X = (i: number) => 60 + i * 280;
const Y = (r: number) => 60 + r * 170;

export interface SeedWorkflow {
  key: string;
  name: string;
  description: string;
  definition: WorkflowDefinition;
}

export const SEED_WORKFLOWS: SeedWorkflow[] = [
  {
    key: 'concept3d',
    name: '컨셉 3D 시각화 파이프라인',
    description: '스케치와 설명을 받아 디자인 가이드에 맞춰 3D 컨셉을 만들고 승인 후 돌려줍니다.',
    definition: {
      nodes: [
        makeNode('in', 'input.api', '에이전트 · API 호출', X(0), Y(0), {
          fields: [
            { name: 'sketch', type: 'string', required: true, description: '스케치 이미지 URL' },
            { name: 'description', type: 'string', required: true, description: '컨셉 설명' },
          ],
        }),
        makeNode('rag', 'kb.search', 'RAG 검색', X(1), Y(0), { kb_id: 'kb-design', kb_name: '디자인 가이드 v2', top_k: 4 }),
        makeNode('llm1', 'llm.generate', 'LLM 형태 해석', X(2), Y(0), {
          model: 'claude-sonnet-4',
          fallback_models: ['claude-haiku-4'],
          prompt: '디자인 가이드:\n{{rag.output.text}}\n\n설명: {{in.output.description}}\n형태·소재·비율을 정리해 줘.',
        }),
        makeNode('td', '3d.image_to_3d', '2D → 3D 변환', X(2), Y(1), {
          image: '{{in.output.sketch}}',
          volume: 60,
          density: 40,
          style: 70,
          preset: '캠핑 의자 v2',
        }),
        makeNode('cond', 'logic.condition', '조건 분기', X(1), Y(1), { rules: [{ left: 'quality', op: '>=', right: '0.7' }], label: '품질 점수 ≥ 0.7 ?' }),
        makeNode('apr', 'human.approval', '승인 대기', X(0), Y(1), { summary: '디자인 리드 확인', approvers: [] }),
        makeNode('out', 'output.result', '결과 반환', X(0), Y(2)),
      ],
      edges: [
        e('in', 'description', 'rag', 'query'),
        e('rag', 'text', 'llm1', 'context'),
        e('in', 'description', 'llm1', 'query'),
        e('llm1', 'text', 'td', 'description'),
        e('td', 'asset', 'cond', 'value'),
        e('cond', 'true', 'apr', 'payload'),
        e('cond', 'false', 'td', 'description', 'retry'),
        e('apr', 'approved', 'out', 'result'),
      ],
    },
  },
  {
    key: 'news',
    name: 'AI 뉴스 요약 발송',
    description: '매일 09:00 AI 뉴스를 모아 요약하고, 승인을 받은 뒤 팀 메일로 보냅니다.',
    definition: {
      nodes: [
        makeNode('in', 'input.schedule', '예약 · 매일 09:00', X(0), Y(0), { cron: '0 9 * * *', fields: [{ name: 'topic', type: 'string', required: false, description: '주제', default: 'AI 에이전트' }] }),
        makeNode('search', 'tool.web_search', '웹 검색', X(1), Y(0), { query: 'AI 에이전트 뉴스', top_k: 8 }),
        makeNode('sum', 'llm.summarize', '뉴스 요약', X(2), Y(0), { model: 'claude-haiku-4', prompt: '다음 기사 목록을 팀이 읽기 좋게 5줄로 요약해 줘.\n{{search.output.results}}' }),
        makeNode('apr', 'human.approval', '메일 발송 전 승인', X(3), Y(0), { summary: '오늘의 AI 뉴스 메일' }),
        makeNode('mail', 'tool.mail_send', '메일 발송', X(3), Y(1), { to: 'team@moa.dev' }),
        makeNode('out', 'output.result', '결과 반환', X(4), Y(1)),
      ],
      edges: [
        e('in', 'topic', 'search', 'query'),
        e('search', 'results', 'sum', 'context'),
        e('in', 'topic', 'sum', 'query'),
        e('sum', 'text', 'apr', 'payload'),
        e('apr', 'approved', 'mail', 'body'),
        e('mail', 'message_id', 'out', 'result'),
      ],
    },
  },
  {
    key: 'competitor',
    name: '주간 경쟁사 리포트',
    description: '경쟁사 소식을 모아 비교 분석하고 Slack에 게시합니다.',
    definition: {
      nodes: [
        makeNode('in', 'input.api', '에이전트 · API 호출', X(0), Y(0), { fields: [{ name: 'companies', type: 'string', required: true, description: '회사 목록(쉼표 구분)' }] }),
        makeNode('search', 'tool.web_search', '웹 검색', X(1), Y(0)),
        makeNode('http', 'tool.http', '채용 공고 수집', X(1), Y(1), { method: 'GET', url: 'https://jobs.example.com/api/search' }),
        makeNode('merge', 'logic.merge', '자료 병합', X(2), Y(0)),
        makeNode('llm1', 'llm.generate', '변화 비교 분석', X(3), Y(0), { model: 'claude-sonnet-4', prompt: '지난주 대비 변화를 표로 정리해 줘.\n{{merge.output.merged}}' }),
        makeNode('slack', 'tool.slack_post', 'Slack 게시', X(4), Y(0), { channel: '#market-intel' }),
        makeNode('out', 'output.result', '리포트 반환', X(4), Y(1)),
      ],
      edges: [
        e('in', 'companies', 'search', 'query'),
        e('in', 'companies', 'http', 'body'),
        e('search', 'results', 'merge', 'a'),
        e('http', 'response', 'merge', 'b'),
        e('merge', 'merged', 'llm1', 'context'),
        e('in', 'companies', 'llm1', 'query'),
        e('llm1', 'text', 'slack', 'text'),
        e('llm1', 'text', 'out', 'result'),
      ],
    },
  },
  {
    key: 'triage',
    name: '문의 분류',
    description: '받은 문의 메일을 분류하고 긴급 건을 표시합니다.',
    definition: {
      nodes: [
        makeNode('in', 'input.mail', '메일 수신', X(0), Y(0)),
        makeNode('cls', 'llm.classify', '문의 유형 분류', X(1), Y(0), { prompt: '{{in.output.subject}}\n{{in.output.body}}', labels: ['결제', '배송', '기술', '기타'] }),
        makeNode('cond', 'logic.condition', '긴급 여부', X(2), Y(0), { rules: [{ left: 'score', op: '>=', right: '0.8' }], label: '긴급 점수 ≥ 0.8 ?' }),
        makeNode('out', 'output.result', '분류 결과', X(3), Y(0)),
      ],
      edges: [e('in', 'body', 'cls', 'query'), e('cls', 'score', 'cond', 'value'), e('cond', 'true', 'out', 'result'), e('cond', 'false', 'out', 'result')],
    },
  },
  {
    key: 'minutes',
    name: '회의록 → Notion 등록',
    description: '회의록을 요약하고 할 일을 뽑아 Notion 데이터베이스에 등록합니다.',
    definition: {
      nodes: [
        makeNode('in', 'input.webhook', 'Webhook 수신', X(0), Y(0), { fields: [{ name: 'transcript', type: 'string', required: true, description: '회의 녹취 텍스트' }] }),
        makeNode('sum', 'llm.summarize', '회의 요약', X(1), Y(0), { prompt: '회의록을 요약하고 결정 사항을 정리해 줘.\n{{in.output.transcript}}' }),
        makeNode('notion', 'tool.notion_page', 'Notion 페이지 만들기', X(2), Y(0), { database: '회의록' }),
        makeNode('out', 'output.result', '페이지 링크 반환', X(3), Y(0)),
      ],
      edges: [e('in', 'transcript', 'sum', 'query'), e('sum', 'text', 'notion', 'title'), e('sum', 'text', 'notion', 'content'), e('notion', 'page_url', 'out', 'result')],
    },
  },
  {
    key: 'docsqa',
    name: '사내 문서 Q&A',
    description: '사내 규정 문서를 근거로 답하고 출처를 붙입니다.',
    definition: {
      nodes: [
        makeNode('in', 'input.api', '에이전트 · API 호출', X(0), Y(0), { fields: [{ name: 'question', type: 'string', required: true, description: '질문' }] }),
        makeNode('rag', 'kb.search', 'RAG 검색', X(1), Y(0), { kb_id: 'kb-policy', kb_name: '사내 규정', top_k: 5 }),
        makeNode('llm1', 'llm.generate', '근거 기반 답변', X(2), Y(0), { model: 'claude-haiku-4', prompt: '아래 근거로만 답해. 모르면 모른다고 해.\n{{rag.output.text}}\n\n질문: {{in.output.question}}' }),
        makeNode('cite', 'data.code', '출처 정리', X(3), Y(0), { code: 'def run(data):\n    return add_citations(data)' }),
        makeNode('out', 'output.result', '답변 반환', X(4), Y(0)),
      ],
      edges: [e('in', 'question', 'rag', 'query'), e('rag', 'text', 'llm1', 'context'), e('in', 'question', 'llm1', 'query'), e('llm1', 'json', 'cite', 'data'), e('cite', 'result', 'out', 'result')],
    },
  },
  {
    key: 'prreview',
    name: 'PR 리뷰 요약',
    description: '새 PR 변경점을 요약해 리뷰어에게 Slack으로 알립니다.',
    definition: {
      nodes: [
        makeNode('in', 'input.webhook', 'GitHub Webhook', X(0), Y(0), { fields: [{ name: 'pr_url', type: 'string', required: true, description: 'PR 주소' }] }),
        makeNode('gh', 'tool.github_issues', 'PR 정보 가져오기', X(1), Y(0)),
        makeNode('sum', 'llm.summarize', '변경점 요약', X(2), Y(0), { model: 'claude-sonnet-4', prompt: '이 PR의 변경점과 위험 요소를 정리해 줘.\n{{gh.output.items}}' }),
        makeNode('slack', 'tool.slack_post', '리뷰어 알림', X(3), Y(0), { channel: '#code-review' }),
        makeNode('out', 'output.result', '결과 반환', X(4), Y(0)),
      ],
      edges: [e('in', 'pr_url', 'gh', 'query'), e('gh', 'items', 'sum', 'context'), e('in', 'pr_url', 'sum', 'query'), e('sum', 'text', 'slack', 'text'), e('slack', 'ts', 'out', 'result')],
    },
  },
  {
    key: 'reviews',
    name: '쇼핑몰 리뷰 감성 분석',
    description: '상품 리뷰를 모아 항목별 감성을 분석하고 주간 리포트를 만듭니다.',
    definition: {
      nodes: [
        makeNode('in', 'input.manual', '수동 입력', X(0), Y(0), { fields: [{ name: 'product_url', type: 'string', required: true, description: '상품 페이지 주소' }] }),
        makeNode('http', 'tool.http', '리뷰 수집', X(1), Y(0), { method: 'GET', url: 'https://shop.example.com/api/reviews' }),
        makeNode('csv', 'data.json', '리뷰 목록 추출', X(2), Y(0), { expression: '$.reviews[*]' }),
        makeNode('loop', 'logic.loop', '리뷰마다 반복', X(3), Y(0)),
        makeNode('cls', 'llm.classify', '감성 분류', X(3), Y(1), { labels: ['긍정', '중립', '부정'] }),
        makeNode('agg', 'data.aggregate', '항목별 집계', X(4), Y(0)),
        makeNode('report', 'llm.generate', '리포트 작성', X(5), Y(0), { prompt: '집계 결과로 개선점 3가지를 써 줘.\n{{agg.output.result}}' }),
        makeNode('out', 'output.result', '리포트 반환', X(6), Y(0)),
      ],
      edges: [
        e('in', 'product_url', 'http', 'body'),
        e('http', 'response', 'csv', 'data'),
        e('csv', 'result', 'loop', 'items'),
        e('loop', 'item', 'cls', 'query'),
        e('loop', 'done', 'agg', 'items'),
        e('agg', 'result', 'report', 'context'),
        e('in', 'product_url', 'report', 'query'),
        e('report', 'text', 'out', 'result'),
      ],
    },
  },
];
