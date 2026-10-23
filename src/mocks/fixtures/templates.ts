/** 공식 템플릿 24개 (8개 카테고리 × 3) */
import type { EdgeDef, NodeDef, WorkflowDefinition } from '@/entities/workflow/model';
import { isAssignable } from '@/entities/workflow/graph';
import type { DbTemplate } from '../db';
import { makeNode } from './blocks';

type Step = [blockId: string, name: string, config?: Record<string, unknown>];

/** 블록을 차례로 이어 붙인 선형 워크플로. 포트는 타입이 맞는 첫 쌍으로 연결한다. */
export function chain(steps: Step[]): WorkflowDefinition {
  const nodes: NodeDef[] = steps.map(([block, name, config], i) =>
    makeNode(i === 0 ? 'in' : i === steps.length - 1 && block.startsWith('output') ? 'out' : `n${i}`, block, name, 60 + i * 260, 120 + (i % 2) * 40, config),
  );
  const edges: EdgeDef[] = [];
  for (let i = 1; i < nodes.length; i++) {
    const prev = nodes[i - 1]!;
    const cur = nodes[i]!;
    const target = cur.ports_in.find((p) => p.required) ?? cur.ports_in[0];
    if (!target) continue;
    const source = prev.ports_out.find((p) => isAssignable(p.type, target.type)) ?? prev.ports_out[0];
    if (!source) continue;
    edges.push({ id: `e${i}`, source: prev.id, source_port: source.name, target: cur.id, target_port: target.name, condition: null });
    // 앞 노드 외에 다른 필수 입력은 시작 노드에서 끌어온다
    for (const p of cur.ports_in.filter((x) => x.required && x.name !== target.name)) {
      if (cur.config[p.name] !== undefined) continue;
      const fromIn = nodes[0]!.ports_out.find((o) => isAssignable(o.type, p.type));
      if (fromIn) edges.push({ id: `e${i}-${p.name}`, source: nodes[0]!.id, source_port: fromIn.name, target: cur.id, target_port: p.name, condition: null });
      else cur.config[p.name] = '';
    }
  }
  return { nodes, edges };
}

const field = (name: string, description: string, type = 'string', required = true) => ({ name, type, required, description });
const T = (
  id: number,
  t: Omit<DbTemplate, 'id' | 'definition' | 'description'> & { description?: string },
  steps: Step[],
): DbTemplate => ({
  ...t,
  id: `tpl-${String(id).padStart(2, '0')}`,
  description: t.description ?? `${t.summary}. 복제하면 스튜디오에 추가되고, 필요한 연동만 연결하면 바로 실행할 수 있습니다.`,
  definition: chain(steps),
});

const mcp = (provider: string) => ({ kind: 'mcp' as const, provider, label: `${provider} (MCP)` });
const cred = (provider: string, label: string) => ({ kind: 'credential' as const, provider, label });
const kb = (label: string) => ({ kind: 'kb' as const, provider: 'kb', label });

export const SEED_TEMPLATES: DbTemplate[] = [
  // 콘텐츠
  T(1, { name: '블로그 초안 작성', summary: '주제와 톤을 받아 블로그 초안을 씁니다', category: 'content', kind: 'workflow', difficulty: 'easy', icon: '✍️', trigger: 'api', model: 'claude-sonnet-4', skills: [], required_connections: [] }, [
    ['input.api', '주제 입력', { fields: [field('topic', '주제'), field('tone', '톤', 'string', false)] }],
    ['tool.web_search', '자료 검색'],
    ['llm.generate', '초안 작성', { prompt: '{{in.output.topic}} 주제로 1200자 블로그 글을 써 줘.' }],
    ['output.result', '초안 반환'],
  ]),
  T(2, { name: 'SNS 카피 생성기', summary: '제품 설명으로 채널별 SNS 문구를 만듭니다', category: 'content', kind: 'agent', difficulty: 'easy', icon: '📣', trigger: 'agent', model: 'claude-haiku-4', skills: ['웹 검색'], required_connections: [], agent: { system_prompt: '너는 SNS 마케터다. 채널별 글자 수 제한을 지켜 문구를 쓴다.', builtin_skills: ['web_search'] } }, [
    ['input.api', '제품 설명', { fields: [field('product', '제품 설명')] }],
    ['llm.generate', '채널별 카피', { prompt: '인스타·X·링크드인용 문구를 각각 써 줘.\n{{in.output.product}}' }],
    ['output.result', '카피 반환'],
  ]),
  T(3, { name: '유튜브 대본 요약', summary: '영상 대본을 챕터별로 요약합니다', category: 'content', kind: 'workflow', difficulty: 'medium', icon: '🎬', trigger: 'manual', model: 'claude-haiku-4', skills: [], required_connections: [] }, [
    ['input.manual', '대본 입력', { fields: [field('script', '대본')] }],
    ['llm.summarize', '챕터 요약'],
    ['data.template', '마크다운 정리', { template: '## 요약\n{{n1.output.text}}' }],
    ['output.result', '요약 반환'],
  ]),
  // 리서치
  T(4, { name: '디자인 리서치 에이전트', summary: '스케치를 받아 조사 · 컨셉 정리 · 3D 시각화', category: 'research', kind: 'agent', difficulty: 'hard', icon: '🎨', trigger: 'agent', model: 'claude-sonnet-4', skills: ['웹 검색', 'RAG 검색', '2D → 3D 변환', 'Slack 메시지'], required_connections: [mcp('Slack')], agent: { system_prompt: '너는 제품 디자인팀의 리서치 담당이다. 유사 제품을 조사하고 디자인 가이드에 맞춰 컨셉을 정리한다.', builtin_skills: ['web_search', 'kb_search', 'three_d'] } }, [
    ['input.api', '스케치·설명', { fields: [field('sketch', '스케치 URL'), field('description', '설명')] }],
    ['tool.web_search', '유사 제품 조사'],
    ['llm.generate', '컨셉 정리'],
    ['3d.text_to_scene', '3D 시각화'],
    ['output.result', '결과 반환'],
  ]),
  T(5, { name: '경쟁사 모니터링 리포트', summary: '주간 경쟁사 소식을 정리해 Slack에 게시', category: 'research', kind: 'workflow', difficulty: 'medium', icon: '🔭', trigger: 'schedule', model: 'claude-sonnet-4', skills: [], required_connections: [mcp('Slack')] }, [
    ['input.schedule', '매주 월요일 09:00', { cron: '0 9 * * 1', fields: [field('companies', '회사 목록')] }],
    ['tool.web_search', '소식 검색'],
    ['llm.generate', '비교 분석'],
    ['tool.slack_post', 'Slack 게시', { channel: '#market-intel' }],
    ['output.result', '결과 반환'],
  ]),
  T(6, { name: '논문 요약 · 인용 정리', summary: '논문 PDF를 요약하고 인용 형식을 맞춥니다', category: 'research', kind: 'workflow', difficulty: 'medium', icon: '📄', trigger: 'manual', model: 'claude-sonnet-4', skills: [], required_connections: [] }, [
    ['input.manual', '논문 URL', { fields: [field('url', 'PDF 주소')] }],
    ['kb.load_doc', '문서 로드'],
    ['llm.summarize', '요약'],
    ['llm.extract', '인용 정보 추출'],
    ['output.result', '결과 반환'],
  ]),
  // 고객지원
  T(7, { name: '고객 문의 응대 에이전트', summary: '메일 문의를 읽고 승인 후 답장합니다', category: 'support', kind: 'agent', difficulty: 'medium', icon: '💬', trigger: 'mail', model: 'claude-sonnet-4', skills: ['메일 읽기', '메일 보내기(승인)'], required_connections: [cred('smtp', '메일 계정(SMTP)')], agent: { system_prompt: '너는 친절한 고객지원 담당자다. 확실하지 않은 내용은 확인 후 안내한다고 답한다.', builtin_skills: ['mail_send', 'kb_search'] } }, [
    ['input.mail', '메일 수신'],
    ['llm.classify', '문의 분류'],
    ['llm.generate', '답장 초안'],
    ['human.approval', '발송 전 승인'],
    ['tool.mail_send', '답장 발송', { to: '{{in.output.from}}' }],
    ['output.result', '결과 반환'],
  ]),
  T(8, { name: 'FAQ 챗봇', summary: 'FAQ 문서를 근거로 답하는 챗봇', category: 'support', kind: 'agent', difficulty: 'easy', icon: '❓', trigger: 'agent', model: 'claude-haiku-4', skills: ['RAG 검색'], required_connections: [kb('FAQ 지식베이스')], agent: { system_prompt: 'FAQ 문서에 있는 내용만 답한다.', builtin_skills: ['kb_search'] } }, [
    ['input.api', '질문', { fields: [field('question', '질문')] }],
    ['kb.search', 'FAQ 검색'],
    ['llm.generate', '답변'],
    ['output.result', '답변 반환'],
  ]),
  T(9, { name: '불만 리뷰 에스컬레이션', summary: '부정 리뷰를 찾아 담당자에게 알립니다', category: 'support', kind: 'workflow', difficulty: 'medium', icon: '🚨', trigger: 'webhook', model: 'claude-haiku-4', skills: [], required_connections: [mcp('Slack')] }, [
    ['input.webhook', '리뷰 이벤트'],
    ['llm.classify', '감성 분류', { labels: ['긍정', '중립', '부정'] }],
    ['logic.condition', '부정이면'],
    ['human.notify', '담당자 알림'],
    ['output.result', '결과 반환'],
  ]),
  // 데이터
  T(10, { name: 'CSV 리포트 자동화', summary: 'CSV를 집계해 요약 리포트를 만듭니다', category: 'data', kind: 'workflow', difficulty: 'easy', icon: '📊', trigger: 'manual', model: 'claude-haiku-4', skills: [], required_connections: [] }, [
    ['input.manual', 'CSV 입력', { fields: [field('csv', 'CSV 본문')] }],
    ['data.csv', 'CSV 파싱'],
    ['data.aggregate', '집계'],
    ['llm.summarize', '리포트 요약'],
    ['output.result', '리포트 반환'],
  ]),
  T(11, { name: '쇼핑몰 리뷰 분석 리포트', summary: '리뷰를 수집해 항목별 감성을 분석', category: 'data', kind: 'workflow', difficulty: 'hard', icon: '🛍️', trigger: 'schedule', model: 'claude-sonnet-4', skills: [], required_connections: [] }, [
    ['input.schedule', '매일 08:00', { cron: '0 8 * * *', fields: [field('product_url', '상품 주소')] }],
    ['tool.http', '리뷰 수집'],
    ['data.json', '리뷰 추출'],
    ['llm.classify', '감성 분류'],
    ['data.aggregate', '집계'],
    ['llm.generate', '리포트 작성'],
    ['output.result', '리포트 반환'],
  ]),
  T(12, { name: '영수증 데이터 추출', summary: '영수증 이미지에서 금액·날짜를 뽑습니다', category: 'data', kind: 'workflow', difficulty: 'medium', icon: '🧾', trigger: 'api', model: 'claude-sonnet-4', skills: [], required_connections: [] }, [
    ['input.api', '영수증 업로드', { fields: [field('image_url', '이미지 URL')] }],
    ['llm.vision', '이미지 읽기', { image: '{{in.output.image_url}}' }],
    ['llm.extract', '항목 추출'],
    ['output.result', 'JSON 반환'],
  ]),
  // 개발
  T(13, { name: 'PR 리뷰 요약', summary: '새 PR 변경점을 요약해 알림', category: 'dev', kind: 'workflow', difficulty: 'medium', icon: '🔀', trigger: 'webhook', model: 'claude-sonnet-4', skills: [], required_connections: [mcp('GitHub'), mcp('Slack')] }, [
    ['input.webhook', 'GitHub Webhook', { fields: [field('pr_url', 'PR 주소')] }],
    ['tool.github_issues', 'PR 가져오기'],
    ['llm.summarize', '변경점 요약'],
    ['tool.slack_post', '리뷰어 알림'],
    ['output.result', '결과 반환'],
  ]),
  T(14, { name: 'GitHub 이슈 자동 분류', summary: '새 이슈에 라벨과 담당자를 제안합니다', category: 'dev', kind: 'workflow', difficulty: 'easy', icon: '🏷️', trigger: 'webhook', model: 'claude-haiku-4', skills: [], required_connections: [mcp('GitHub')] }, [
    ['input.webhook', '이슈 이벤트'],
    ['llm.classify', '라벨 분류', { labels: ['bug', 'feature', 'question'] }],
    ['tool.mcp', '라벨 적용', { mcp_server: 'GitHub', tool: 'add_labels' }],
    ['output.result', '결과 반환'],
  ]),
  T(15, { name: '장애 로그 분석 에이전트', summary: '에러 로그를 읽고 원인 후보를 정리', category: 'dev', kind: 'agent', difficulty: 'hard', icon: '🛠️', trigger: 'agent', model: 'claude-sonnet-4', skills: ['코드 실행', '웹 검색'], required_connections: [], agent: { system_prompt: '너는 SRE다. 로그에서 원인 후보와 확인 순서를 제시한다.', builtin_skills: ['code_exec', 'web_search'] } }, [
    ['input.api', '로그 입력', { fields: [field('log', '에러 로그')] }],
    ['data.code', '스택 추출'],
    ['llm.generate', '원인 분석'],
    ['output.result', '분석 반환'],
  ]),
  // 마케팅
  T(16, { name: '광고 카피 A/B 생성', summary: '타깃별 광고 문구 두 벌을 만듭니다', category: 'marketing', kind: 'workflow', difficulty: 'easy', icon: '🅰️', trigger: 'api', model: 'claude-haiku-4', skills: [], required_connections: [] }, [
    ['input.api', '캠페인 정보', { fields: [field('campaign', '캠페인 설명')] }],
    ['logic.parallel', '병렬 생성'],
    ['llm.generate', 'A안 작성'],
    ['output.result', '카피 반환'],
  ]),
  T(17, { name: '뉴스레터 큐레이션', summary: '업계 뉴스를 골라 뉴스레터 초안을 만듭니다', category: 'marketing', kind: 'workflow', difficulty: 'medium', icon: '📰', trigger: 'schedule', model: 'claude-sonnet-4', skills: [], required_connections: [cred('smtp', '메일 계정(SMTP)')] }, [
    ['input.schedule', '매주 금요일', { cron: '0 10 * * 5', fields: [field('topic', '주제')] }],
    ['tool.web_search', '뉴스 검색'],
    ['llm.summarize', '큐레이션'],
    ['human.approval', '발송 전 승인'],
    ['tool.mail_send', '뉴스레터 발송', { to: 'subscribers@moa.dev' }],
    ['output.result', '결과 반환'],
  ]),
  T(18, { name: '키워드 SEO 분석 에이전트', summary: '키워드 경쟁도와 콘텐츠 아이디어 제안', category: 'marketing', kind: 'agent', difficulty: 'medium', icon: '🔍', trigger: 'agent', model: 'claude-sonnet-4', skills: ['웹 검색'], required_connections: [], agent: { system_prompt: '너는 SEO 전문가다.', builtin_skills: ['web_search'] } }, [
    ['input.api', '키워드', { fields: [field('keyword', '키워드')] }],
    ['tool.web_search', '검색 결과 수집'],
    ['llm.generate', '아이디어 제안'],
    ['output.result', '제안 반환'],
  ]),
  // 3D·디자인
  T(19, { name: '스케치 → 3D 컨셉', summary: '스케치를 3D로 바꾸고 승인 후 반환', category: 'design3d', kind: 'workflow', difficulty: 'hard', icon: '🧊', trigger: 'agent', model: 'claude-sonnet-4', skills: [], required_connections: [cred('three_d', '3D 엔진 키')] }, [
    ['input.api', '스케치 입력', { fields: [field('sketch', '스케치 URL'), field('description', '설명')] }],
    ['llm.generate', '형태 해석'],
    ['3d.image_to_3d', '2D → 3D 변환', { image: '{{in.output.sketch}}' }],
    ['human.approval', '디자인 리드 승인'],
    ['output.result', '결과 반환'],
  ]),
  T(20, { name: '제품 렌더 이미지 생성', summary: '3D 모델을 여러 각도로 렌더링합니다', category: 'design3d', kind: 'workflow', difficulty: 'medium', icon: '📷', trigger: 'api', model: null, skills: [], required_connections: [cred('three_d', '3D 엔진 키')] }, [
    ['input.api', '모델 URL', { fields: [field('model_url', '모델 URL')] }],
    ['3d.text_to_scene', '장면 구성'],
    ['3d.render', '렌더링'],
    ['output.result', '이미지 반환'],
  ]),
  T(21, { name: '가구 스케치 3D 프리셋', summary: '가구 스케치용 3D 변환 프리셋 모음', category: 'design3d', kind: 'workflow', difficulty: 'easy', icon: '🪑', trigger: 'manual', model: null, skills: [], required_connections: [cred('three_d', '3D 엔진 키')] }, [
    ['input.manual', '스케치 입력', { fields: [field('description', '가구 설명')] }],
    ['3d.text_to_scene', '3D 장면'],
    ['3d.convert', 'OBJ로 변환'],
    ['output.result', '모델 반환'],
  ]),
  // 업무자동화
  T(22, { name: '회의록 정리 에이전트', summary: '회의록 요약과 할 일을 Notion에 등록', category: 'automation', kind: 'agent', difficulty: 'easy', icon: '📝', trigger: 'webhook', model: 'claude-sonnet-4', skills: ['Notion 페이지 만들기'], required_connections: [mcp('Notion')], agent: { system_prompt: '회의록을 요약하고 담당자별 할 일을 뽑는다.', builtin_skills: ['memory_save'] } }, [
    ['input.webhook', '회의록 수신', { fields: [field('transcript', '회의 녹취')] }],
    ['llm.summarize', '요약'],
    ['tool.notion_page', 'Notion 등록'],
    ['output.result', '링크 반환'],
  ]),
  T(23, { name: 'AI 뉴스 요약 발송', summary: '매일 뉴스를 모아 요약해 메일로 발송', category: 'automation', kind: 'workflow', difficulty: 'easy', icon: '🗞️', trigger: 'schedule', model: 'claude-haiku-4', skills: [], required_connections: [cred('smtp', '메일 계정(SMTP)')] }, [
    ['input.schedule', '매일 09:00', { fields: [field('topic', '주제')] }],
    ['tool.web_search', '뉴스 검색'],
    ['llm.summarize', '요약'],
    ['tool.mail_send', '메일 발송', { to: 'team@moa.dev' }],
    ['output.result', '결과 반환'],
  ]),
  T(24, { name: '휴가 신청 승인 흐름', summary: '휴가 신청을 받아 팀장 승인 후 캘린더 등록', category: 'automation', kind: 'workflow', difficulty: 'easy', icon: '🌴', trigger: 'webhook', model: null, skills: [], required_connections: [] }, [
    ['input.webhook', '신청서 수신'],
    ['human.approval', '팀장 승인'],
    ['tool.http', '캘린더 등록', { method: 'POST', url: 'https://calendar.example.com/api/events' }],
    ['output.result', '결과 반환'],
  ]),
];
