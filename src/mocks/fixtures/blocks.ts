/**
 * 노드 팔레트: 8그룹 47블록 (prompts.md 2단계 5), frontend-plan D23).
 * type은 design.md 2.2.3 HANDLERS 중 하나다. icon은 lucide 아이콘 이름.
 */
import type { Block, NodeDef, Port } from '@/entities/workflow/model';

export const BLOCK_GROUPS = [
  { id: 'io', label: '입력·출력' },
  { id: 'llm', label: 'LLM' },
  { id: 'tool', label: '도구·MCP' },
  { id: 'logic', label: '로직' },
  { id: 'data', label: '데이터' },
  { id: 'knowledge', label: '지식' },
  { id: 'three_d', label: '3D' },
  { id: 'human', label: '사람·승인' },
];

const p = (name: string, type: Port['type'], required = false, label?: string): Port => ({ name, type, required, label });
const LLM_IN = [p('query', 'string', true, '질문·지시'), p('context', 'any', false, '참고 자료')];
const LLM_OUT = [p('text', 'string'), p('json', 'object')];

type B = Omit<Block, 'config'> & { config?: Record<string, unknown> };
const b = (x: B): Block => ({ config: {}, ...x });

export const BLOCKS: Block[] = [
  // 입력·출력 (6)
  b({ id: 'input.manual', group: 'io', type: 'input', label: '수동 입력', description: '실행할 때 직접 값을 넣습니다', icon: 'Keyboard', ports_in: [], ports_out: [], config: { trigger: 'manual', fields: [{ name: 'text', type: 'string', required: true, description: '입력 텍스트' }] } }),
  b({ id: 'input.api', group: 'io', type: 'input', label: '에이전트 · API 호출', description: '에이전트나 배포 API가 이 워크플로를 부릅니다', icon: 'Webhook', ports_in: [], ports_out: [], config: { trigger: 'agent', fields: [{ name: 'query', type: 'string', required: true, description: '요청 내용' }] } }),
  b({ id: 'input.schedule', group: 'io', type: 'input', label: '예약 (Cron)', description: '정해진 시각에 자동 실행합니다', icon: 'CalendarClock', ports_in: [], ports_out: [], config: { trigger: 'schedule', cron: '0 9 * * *', fields: [{ name: 'date', type: 'string', required: false, description: '실행 날짜' }] } }),
  b({ id: 'input.webhook', group: 'io', type: 'input', label: 'Webhook 수신', description: '외부 서비스가 보낸 이벤트로 시작합니다', icon: 'Radio', ports_in: [], ports_out: [], config: { trigger: 'webhook', fields: [{ name: 'payload', type: 'object', required: true, description: '이벤트 본문' }] } }),
  b({ id: 'input.mail', group: 'io', type: 'input', label: '메일 수신', description: '받은 메일로 시작합니다', icon: 'Inbox', ports_in: [], ports_out: [], config: { trigger: 'mail', fields: [{ name: 'subject', type: 'string', required: true }, { name: 'body', type: 'string', required: true }] } }),
  b({ id: 'output.result', group: 'io', type: 'output', label: '결과 반환', description: '워크플로 결과를 돌려줍니다', icon: 'Flag', ports_in: [p('result', 'any', true, '결과')], ports_out: [] }),

  // LLM (7)
  b({ id: 'llm.generate', group: 'llm', type: 'llm', label: 'LLM', description: '프롬프트로 글을 생성합니다', icon: 'Sparkles', ports_in: LLM_IN, ports_out: LLM_OUT, config: { model: 'claude-sonnet-4', prompt: '', fallback_models: [], temperature: 0.7 } }),
  b({ id: 'llm.summarize', group: 'llm', type: 'llm', label: '요약', description: '긴 글을 핵심만 요약합니다', icon: 'AlignLeft', ports_in: LLM_IN, ports_out: LLM_OUT, config: { model: 'claude-haiku-4', prompt: '다음 내용을 5줄로 요약해 줘.\n\n{{in.output.text}}', fallback_models: [] } }),
  b({ id: 'llm.classify', group: 'llm', type: 'llm', label: '분류', description: '정해진 라벨 중 하나로 분류합니다', icon: 'Tags', ports_in: LLM_IN, ports_out: [p('label', 'string'), p('score', 'number')], config: { model: 'claude-haiku-4', prompt: '', labels: ['문의', '불만', '칭찬'] } }),
  b({ id: 'llm.extract', group: 'llm', type: 'llm', label: '정보 추출', description: '글에서 구조화된 값을 뽑습니다', icon: 'Braces', ports_in: LLM_IN, ports_out: [p('json', 'object')], config: { model: 'claude-sonnet-4', prompt: '', output_schema: {} } }),
  b({ id: 'llm.translate', group: 'llm', type: 'llm', label: '번역', description: '다른 언어로 옮깁니다', icon: 'Languages', ports_in: LLM_IN, ports_out: LLM_OUT, config: { model: 'claude-haiku-4', prompt: '', target_lang: 'en' } }),
  b({ id: 'llm.vision', group: 'llm', type: 'llm', label: '이미지 이해', description: '이미지를 보고 설명합니다', icon: 'ScanEye', ports_in: [p('image', 'image', true, '이미지'), p('query', 'string')], ports_out: LLM_OUT, config: { model: 'claude-sonnet-4', prompt: '' } }),
  b({ id: 'llm.agent', group: 'llm', type: 'llm', label: '에이전트 호출', description: '다른 에이전트에게 일을 맡깁니다', icon: 'Bot', ports_in: LLM_IN, ports_out: LLM_OUT, config: { agent_id: null, prompt: '{{in.output.query}}' } }),

  // 도구·MCP (8)
  b({ id: 'tool.web_search', group: 'tool', type: 'tool', label: '웹 검색', description: '검색 엔진으로 최신 정보를 찾습니다', icon: 'Globe', ports_in: [p('query', 'string', true, '검색어')], ports_out: [p('results', 'array')], config: { tool: 'web_search', top_k: 5 } }),
  b({ id: 'tool.http', group: 'tool', type: 'http', label: 'HTTP 요청', description: '외부 API를 호출합니다', icon: 'ArrowLeftRight', ports_in: [p('body', 'any')], ports_out: [p('response', 'object')], config: { method: 'GET', url: 'https://', headers: [] } }),
  b({ id: 'tool.mail_send', group: 'tool', type: 'tool', label: '메일 발송', description: '팀 메일 계정으로 보냅니다', icon: 'Send', ports_in: [p('to', 'string', true, '받는 사람'), p('body', 'string', true, '본문')], ports_out: [p('message_id', 'string')], config: { tool: 'mail_send', credential: 'smtp' } }),
  b({ id: 'tool.slack_post', group: 'tool', type: 'tool', label: 'Slack 메시지', description: '채널이나 DM으로 메시지를 보냅니다', icon: 'MessageSquare', ports_in: [p('text', 'string', true, '메시지')], ports_out: [p('ts', 'string')], config: { mcp_server: 'Slack', tool: 'post_message', channel: '#general' } }),
  b({ id: 'tool.notion_page', group: 'tool', type: 'tool', label: 'Notion 페이지 만들기', description: '데이터베이스에 페이지를 추가합니다', icon: 'FileText', ports_in: [p('title', 'string', true, '제목'), p('content', 'string')], ports_out: [p('page_url', 'string')], config: { mcp_server: 'Notion', tool: 'create_page' } }),
  b({ id: 'tool.github_issues', group: 'tool', type: 'tool', label: 'GitHub 이슈 검색', description: '저장소 이슈와 PR을 찾습니다', icon: 'GitPullRequest', ports_in: [p('query', 'string', true, '검색어')], ports_out: [p('items', 'array')], config: { mcp_server: 'GitHub', tool: 'search_issues' } }),
  b({ id: 'tool.drive_read', group: 'tool', type: 'tool', label: 'Google Drive 파일 읽기', description: '드라이브 문서를 텍스트로 읽습니다', icon: 'HardDrive', ports_in: [p('file_id', 'string', true, '파일 ID')], ports_out: [p('text', 'string')], config: { mcp_server: 'Google Drive', tool: 'read_file' } }),
  b({ id: 'tool.mcp', group: 'tool', type: 'tool', label: 'MCP 도구', description: '연결한 MCP 서버의 도구를 고릅니다', icon: 'Plug', ports_in: [p('args', 'object')], ports_out: [p('result', 'any')], config: { mcp_server: null, tool: null } }),

  // 로직 (6)
  b({ id: 'logic.condition', group: 'logic', type: 'condition', label: '조건 분기', description: '조건에 따라 다른 길로 보냅니다', icon: 'GitBranch', ports_in: [p('value', 'any', true, '판단 값')], ports_out: [p('true', 'any', false, '예'), p('false', 'any', false, '아니오')], config: { rules: [{ left: 'score', op: '>=', right: '0.7' }] } }),
  b({ id: 'logic.loop', group: 'logic', type: 'loop', label: '반복', description: '목록의 항목마다 반복합니다', icon: 'Repeat', ports_in: [p('items', 'array', true, '목록')], ports_out: [p('item', 'any'), p('done', 'array')], config: { max_iter: 20 } }),
  b({ id: 'logic.parallel', group: 'logic', type: 'parallel', label: '병렬', description: '여러 갈래를 동시에 실행합니다', icon: 'Split', ports_in: [p('input', 'any')], ports_out: [p('a', 'any'), p('b', 'any')] }),
  b({ id: 'logic.merge', group: 'logic', type: 'code', label: '병합', description: '여러 결과를 하나로 합칩니다', icon: 'Merge', ports_in: [p('a', 'any'), p('b', 'any')], ports_out: [p('merged', 'object')], config: { language: 'python', code: 'return {**a, **b}' } }),
  b({ id: 'logic.delay', group: 'logic', type: 'code', label: '대기', description: '정해진 시간만큼 기다립니다', icon: 'Timer', ports_in: [p('input', 'any')], ports_out: [p('output', 'any')], config: { seconds: 60 } }),
  b({ id: 'logic.try', group: 'logic', type: 'code', label: '오류 처리', description: '실패해도 다음 단계로 넘어갑니다', icon: 'ShieldAlert', ports_in: [p('input', 'any')], ports_out: [p('ok', 'any'), p('error', 'object')], config: { on_error: 'continue' } }),

  // 데이터 (6)
  b({ id: 'data.code', group: 'data', type: 'code', label: '코드 실행', description: '샌드박스에서 Python을 실행합니다', icon: 'Code', ports_in: [p('data', 'any')], ports_out: [p('result', 'any')], config: { language: 'python', code: 'def run(data):\n    return data' } }),
  b({ id: 'data.json', group: 'data', type: 'code', label: 'JSON 변환', description: 'JSONPath로 값을 뽑거나 모양을 바꿉니다', icon: 'FileJson', ports_in: [p('data', 'any', true, '데이터')], ports_out: [p('result', 'any')], config: { expression: '$.items[*].title' } }),
  b({ id: 'data.template', group: 'data', type: 'code', label: '텍스트 템플릿', description: '값을 끼워 넣어 글을 만듭니다', icon: 'TextCursorInput', ports_in: [p('data', 'any')], ports_out: [p('text', 'string')], config: { template: '' } }),
  b({ id: 'data.csv', group: 'data', type: 'code', label: 'CSV 파싱', description: 'CSV를 행 목록으로 바꿉니다', icon: 'Sheet', ports_in: [p('text', 'string', true, 'CSV')], ports_out: [p('rows', 'array')], config: { delimiter: ',' } }),
  b({ id: 'data.filter', group: 'data', type: 'code', label: '필터', description: '조건에 맞는 항목만 남깁니다', icon: 'Filter', ports_in: [p('items', 'array', true, '목록')], ports_out: [p('items', 'array')], config: { condition: '' } }),
  b({ id: 'data.aggregate', group: 'data', type: 'code', label: '정렬 · 집계', description: '정렬하거나 합계를 냅니다', icon: 'ArrowDownWideNarrow', ports_in: [p('items', 'array', true, '목록')], ports_out: [p('result', 'any')], config: { sort_by: '', limit: 10 } }),

  // 지식 (5)
  b({ id: 'kb.search', group: 'knowledge', type: 'kb_search', label: 'RAG 검색', description: '지식베이스에서 근거를 찾습니다', icon: 'BookOpenText', ports_in: [p('query', 'string', true, '질문')], ports_out: [p('chunks', 'array'), p('text', 'string')], config: { kb_id: null, top_k: 4 } }),
  b({ id: 'kb.memory_save', group: 'knowledge', type: 'tool', label: '기억하기', description: '장기 기억에 저장합니다', icon: 'BookmarkPlus', ports_in: [p('content', 'string', true, '내용')], ports_out: [p('memory_id', 'string')], config: { tool: 'memory_save', kind: 'long' } }),
  b({ id: 'kb.memory_recall', group: 'knowledge', type: 'kb_search', label: '기억 불러오기', description: '관련 기억을 찾아 옵니다', icon: 'History', ports_in: [p('query', 'string', true, '질문')], ports_out: [p('memories', 'array')], config: { source: 'memory', top_k: 5 } }),
  b({ id: 'kb.load_doc', group: 'knowledge', type: 'tool', label: '문서 로드', description: '파일을 읽어 텍스트로 바꿉니다', icon: 'FileUp', ports_in: [p('url', 'string', true, '파일 URL')], ports_out: [p('text', 'string')], config: { tool: 'load_document' } }),
  b({ id: 'kb.embed', group: 'knowledge', type: 'tool', label: '임베딩 생성', description: '텍스트를 벡터로 바꿉니다', icon: 'Binary', ports_in: [p('text', 'string', true, '텍스트')], ports_out: [p('vector', 'array')], config: { tool: 'embed', model: 'text-embedding-3-small' } }),

  // 3D (5)
  b({ id: '3d.image_to_3d', group: 'three_d', type: 'three_d', label: '2D → 3D 변환', description: '스케치나 사진을 3D 메시로 만듭니다', icon: 'Box', async: true, ports_in: [p('image', 'image', true, '입력 이미지'), p('description', 'string')], ports_out: [p('asset', 'object'), p('preview', 'image')], config: { mode: 'image_to_3d', resolution: 'medium', volume: 60, density: 40, style: 70, symmetry: true, formats: ['glb'] } }),
  b({ id: '3d.text_to_scene', group: 'three_d', type: 'three_d', label: '텍스트 → 3D 장면', description: '설명으로 장면을 구성합니다', icon: 'Shapes', async: true, ports_in: [p('description', 'string', true, '설명')], ports_out: [p('asset', 'object'), p('preview', 'image')], config: { mode: 'text_to_scene', resolution: 'low', formats: ['glb'] } }),
  b({ id: '3d.edit', group: 'three_d', type: 'three_d', label: '3D 편집', description: '기존 모델을 지시대로 고칩니다', icon: 'PenTool', async: true, ports_in: [p('asset', 'object', true, '모델'), p('instruction', 'string', true, '지시')], ports_out: [p('asset', 'object'), p('preview', 'image')], config: { mode: 'edit' } }),
  b({ id: '3d.render', group: 'three_d', type: 'three_d', label: '렌더링', description: '모델을 이미지로 렌더링합니다', icon: 'Camera', async: true, ports_in: [p('asset', 'object', true, '모델')], ports_out: [p('preview', 'image')], config: { mode: 'render', resolution: 'medium', samples: 32 } }),
  b({ id: '3d.convert', group: 'three_d', type: 'three_d', label: '포맷 변환', description: 'glTF·OBJ·FBX로 내보냅니다', icon: 'FileBox', ports_in: [p('asset', 'object', true, '모델')], ports_out: [p('asset', 'object')], config: { mode: 'convert', formats: ['glb', 'obj'] } }),

  // 사람·승인 (4)
  b({ id: 'human.approval', group: 'human', type: 'approval', label: '승인 대기', description: '사람이 확인한 뒤 계속합니다', icon: 'ShieldCheck', ports_in: [p('payload', 'any', true, '확인할 내용')], ports_out: [p('approved', 'any')], config: { approvers: [], summary: '{{prev.output.text}}' } }),
  b({ id: 'human.input', group: 'human', type: 'approval', label: '사람 입력 요청', description: '사람에게 값을 받아 이어 갑니다', icon: 'UserPen', ports_in: [p('question', 'string', true, '질문')], ports_out: [p('answer', 'string')], config: { approvers: [], summary: '' } }),
  b({ id: 'human.notify', group: 'human', type: 'tool', label: '알림 보내기', description: '담당자에게 알림을 보냅니다', icon: 'Bell', ports_in: [p('message', 'string', true, '메시지')], ports_out: [p('sent', 'boolean')], config: { tool: 'notify', channel: 'email' } }),
  b({ id: 'human.assign', group: 'human', type: 'tool', label: '검토 작업 할당', description: '사람에게 검토 작업을 맡깁니다', icon: 'ClipboardCheck', ports_in: [p('task', 'string', true, '작업')], ports_out: [p('task_id', 'string')], config: { tool: 'assign_task', assignee: null } }),
];

export const blockById = (id: string) => BLOCKS.find((x) => x.id === id);

/** 입력 노드의 출력 포트는 정의한 필드에서 나온다 */
export function inputPortsFromFields(fields: { name: string; type: string; required?: boolean }[]): Port[] {
  return fields.map((f) => ({ name: f.name, type: (f.type === 'integer' ? 'number' : f.type) as Port['type'], label: f.name }));
}

/** 블록으로 노드 정의 만들기(시드 데이터·템플릿용) */
export function makeNode(
  id: string,
  blockId: string,
  name: string,
  x: number,
  y: number,
  config: Record<string, unknown> = {},
): NodeDef {
  const block = blockById(blockId);
  if (!block) throw new Error(`블록 없음: ${blockId}`);
  const merged = { ...block.config, ...config };
  const ports_out = block.type === 'input' ? inputPortsFromFields((merged.fields as never[]) ?? []) : block.ports_out;
  return {
    id,
    type: block.type,
    block: block.id,
    name,
    config: merged,
    ports_in: block.ports_in,
    ports_out,
    retry: block.type === 'llm' || block.type === 'tool' || block.type === 'http' ? { max_attempts: 3 } : undefined,
    timeout_s: block.type === 'three_d' ? 300 : 60,
    position: { x, y },
  };
}
