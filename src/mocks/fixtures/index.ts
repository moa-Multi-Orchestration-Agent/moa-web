/** 시드 데이터 조립. 시각은 호출 시점 기준 상대값이라 "10분 전" 같은 표시가 자연스럽다. */
import { inputSchemaOf } from '@/entities/workflow/graph';
import type { RunStatus } from '@/entities/run/model';
import type {
  Db,
  DbAgent,
  DbAgentSkill,
  DbAgentWorkflow,
  DbApiKey,
  DbBudget,
  DbContextBlock,
  DbEndpoint,
  DbLicense,
  DbMcpServer,
  DbMcpTool,
  DbPurchase,
  DbWebhookDelivery,
  DbWorkflow,
  DbWorkflowVersion,
} from '../db';
import { DAY, HOUR, MIN, ago, countTokens, fid, iso, sha256ish } from '../lib/util';
import { seedMarket } from './market';
import { seedRuns, syntheticLedger, type RunSeedSpec } from './runs';
import { SEED_TEMPLATES } from './templates';
import { SEED_WORKFLOWS } from './workflows';

export const WS1 = fid('w', 1);
export const WS2 = fid('w', 2);
export const DEMO_USER = fid('u', 1);
export const DEMO_EMAIL = 'demo@moa.dev';

export function seed(): Db {
  const now = Date.now();
  const at = (ms: number) => ago(ms, now);

  const users = [
    { id: DEMO_USER, email: DEMO_EMAIL, display_name: '김모아', password: null, oauth_provider: null, created_at: at(120 * DAY), updated_at: at(DAY) },
    { id: fid('u', 2), email: 'seojun@moa.dev', display_name: '이서준', password: null, oauth_provider: 'google', created_at: at(100 * DAY), updated_at: at(DAY) },
    { id: fid('u', 3), email: 'jimin@moa.dev', display_name: '박지민', password: null, oauth_provider: null, created_at: at(90 * DAY), updated_at: at(DAY) },
    { id: fid('u', 4), email: 'yuna@partner.io', display_name: '최유나', password: null, oauth_provider: 'github', created_at: at(30 * DAY), updated_at: at(DAY) },
    { id: fid('u', 5), email: 'haneul@partner.io', display_name: '정하늘', password: null, oauth_provider: null, created_at: at(200 * DAY), updated_at: at(DAY) },
  ];
  const workspaces = [
    { id: WS1, slug: 'team-moa', name: 'MOA 팀', plan: 'team', settings: { compress_threshold: 0.7, compress_target: 0.5 }, created_at: at(120 * DAY), updated_at: at(3 * DAY) },
    { id: WS2, slug: 'partner-studio', name: '파트너 스튜디오', plan: 'free', settings: { compress_threshold: 0.7 }, created_at: at(200 * DAY), updated_at: at(20 * DAY) },
  ];
  const memberships = [
    { workspace_id: WS1, user_id: DEMO_USER, role: 'owner' as const, created_at: at(120 * DAY), last_seen_at: at(0) },
    { workspace_id: WS1, user_id: fid('u', 2), role: 'admin' as const, created_at: at(100 * DAY), last_seen_at: at(HOUR) },
    { workspace_id: WS1, user_id: fid('u', 3), role: 'maker' as const, created_at: at(90 * DAY), last_seen_at: at(DAY) },
    { workspace_id: WS1, user_id: fid('u', 4), role: 'viewer' as const, created_at: at(30 * DAY), last_seen_at: at(3 * DAY) },
    { workspace_id: WS2, user_id: fid('u', 5), role: 'owner' as const, created_at: at(200 * DAY), last_seen_at: at(2 * HOUR) },
    { workspace_id: WS2, user_id: DEMO_USER, role: 'viewer' as const, created_at: at(40 * DAY), last_seen_at: at(5 * DAY) },
  ];

  // ===== 연동 =====
  const credentials = [
    { id: fid('cr', 1), workspace_id: WS1, provider: 'smtp', label: '팀 메일 계정', key_version: 1, purposes: ['mail'], created_by: DEMO_USER, created_at: at(80 * DAY), secret: 'smtp://team%40moa.dev:pa55w0rd-mail@smtp.moa.dev', expires_at: null, used_by: ['AI 뉴스 요약 발송', '고객 문의 응대 에이전트'] },
    { id: fid('cr', 2), workspace_id: WS1, provider: 'anthropic', label: 'Anthropic API 키', key_version: 1, purposes: ['llm'], created_by: DEMO_USER, created_at: at(110 * DAY), secret: 'sk-ant-api03-demo-3f2a9c1d', expires_at: null, used_by: ['전체 에이전트'] },
    { id: fid('cr', 3), workspace_id: WS1, provider: 'three_d', label: '3D 생성 엔진 키', key_version: 1, purposes: ['three_d'], created_by: fid('u', 2), created_at: at(60 * DAY), secret: 'td_live_77aa31bc90', expires_at: iso(now + 7 * DAY), used_by: ['컨셉 3D 시각화 파이프라인'] },
  ];
  const mcp_servers: DbMcpServer[] = [
    { id: fid('ms', 1), workspace_id: WS1, name: 'GitHub', transport: 'http', command: null, url: 'https://mcp.github.com/mcp', credential_id: null, allow_tools: null, is_active: true, last_synced_at: at(2 * HOUR), created_at: at(70 * DAY), status: 'connected', icon: 'github' },
    { id: fid('ms', 2), workspace_id: WS1, name: 'Slack', transport: 'sse', command: null, url: 'https://mcp.slack.com/sse', credential_id: null, allow_tools: null, is_active: true, last_synced_at: at(5 * HOUR), created_at: at(65 * DAY), status: 'connected', icon: 'slack' },
    { id: fid('ms', 3), workspace_id: WS1, name: 'Notion', transport: 'http', command: null, url: 'https://mcp.notion.com/mcp', credential_id: null, allow_tools: ['search_pages', 'create_page', 'update_block'], is_active: true, last_synced_at: at(DAY), created_at: at(40 * DAY), status: 'connected', icon: 'notion' },
  ];
  const tool = (n: number, server: number, name: string, description: string, props: Record<string, { type: string; description: string }>, required: string[], annotations: DbMcpTool['annotations']): DbMcpTool => ({
    id: fid('mt', n),
    server_id: fid('ms', server),
    name,
    description,
    input_schema: { type: 'object', properties: props, required },
    output_schema: null,
    annotations,
    is_active: true,
    synced_at: at(2 * HOUR),
  });
  const mcp_tools: DbMcpTool[] = [
    tool(1, 1, 'search_issues', '저장소 이슈와 PR을 검색합니다', { query: { type: 'string', description: '검색어' }, repo: { type: 'string', description: 'owner/repo' } }, ['query'], { title: 'GitHub 이슈 검색', readOnlyHint: true }),
    tool(2, 1, 'get_pull_request', 'PR 상세와 변경 파일을 가져옵니다', { repo: { type: 'string', description: 'owner/repo' }, number: { type: 'integer', description: 'PR 번호' } }, ['repo', 'number'], { title: 'PR 가져오기', readOnlyHint: true }),
    tool(3, 1, 'create_issue', '새 이슈를 만듭니다', { repo: { type: 'string', description: 'owner/repo' }, title: { type: 'string', description: '제목' }, body: { type: 'string', description: '본문' } }, ['repo', 'title'], { title: 'GitHub 이슈 만들기', destructiveHint: false }),
    tool(4, 1, 'add_labels', '이슈에 라벨을 붙입니다', { repo: { type: 'string', description: 'owner/repo' }, number: { type: 'integer', description: '번호' }, labels: { type: 'array', description: '라벨' } }, ['repo', 'number', 'labels'], { title: '라벨 붙이기', idempotentHint: true }),
    tool(5, 1, 'merge_pull_request', 'PR을 병합합니다', { repo: { type: 'string', description: 'owner/repo' }, number: { type: 'integer', description: 'PR 번호' } }, ['repo', 'number'], { title: 'PR 병합', destructiveHint: true }),
    tool(6, 2, 'post_message', '채널이나 DM으로 메시지를 보냅니다', { channel: { type: 'string', description: '채널' }, text: { type: 'string', description: '메시지' } }, ['channel', 'text'], { title: 'Slack 메시지 보내기', destructiveHint: true }),
    tool(7, 2, 'search_messages', '메시지를 검색합니다', { query: { type: 'string', description: '검색어' } }, ['query'], { title: 'Slack 검색', readOnlyHint: true }),
    tool(8, 2, 'list_channels', '채널 목록을 가져옵니다', {}, [], { title: '채널 목록', readOnlyHint: true }),
    tool(9, 2, 'add_reaction', '메시지에 이모지 반응을 답니다', { channel: { type: 'string', description: '채널' }, ts: { type: 'string', description: '메시지 ts' }, name: { type: 'string', description: '이모지' } }, ['channel', 'ts', 'name'], { title: '반응 달기' }),
    tool(10, 3, 'search_pages', 'Notion 페이지를 검색합니다', { query: { type: 'string', description: '검색어' } }, ['query'], { title: 'Notion 페이지 검색', readOnlyHint: true }),
    tool(11, 3, 'create_page', '데이터베이스에 페이지를 추가합니다', { database: { type: 'string', description: '데이터베이스' }, title: { type: 'string', description: '제목' }, content: { type: 'string', description: '본문' } }, ['database', 'title'], { title: 'Notion 페이지 만들기' }),
    tool(12, 3, 'update_block', '블록 내용을 고칩니다', { block_id: { type: 'string', description: '블록 ID' }, content: { type: 'string', description: '내용' } }, ['block_id', 'content'], { title: 'Notion 블록 수정', destructiveHint: true }),
  ];
  const knowledge_bases = [
    { id: 'kb-design', workspace_id: WS1, name: '디자인 가이드 v2', embed_model: 'text-embedding-3-small', chunk_size: 800, chunk_overlap: 120, created_at: at(50 * DAY), doc_count: 14, ready_count: 14 },
    { id: 'kb-policy', workspace_id: WS1, name: '사내 규정', embed_model: 'text-embedding-3-small', chunk_size: 800, chunk_overlap: 120, created_at: at(90 * DAY), doc_count: 32, ready_count: 31 },
    { id: 'kb-faq', workspace_id: WS1, name: '고객 FAQ', embed_model: 'text-embedding-3-small', chunk_size: 600, chunk_overlap: 80, created_at: at(20 * DAY), doc_count: 6, ready_count: 6 },
  ];

  // ===== 워크플로·버전 =====
  const workflows: DbWorkflow[] = [];
  const workflow_versions: DbWorkflowVersion[] = [];
  const versionCount: Record<string, number> = { concept3d: 2, news: 3, competitor: 1, triage: 2, minutes: 1, docsqa: 2, prreview: 1, reviews: 0 };
  const ages: Record<string, number> = { concept3d: 10 * MIN, news: 2 * HOUR, competitor: 3 * DAY, triage: DAY, minutes: 5 * DAY, docsqa: 6 * HOUR, prreview: 8 * DAY, reviews: 12 * DAY };
  const wfId: Record<string, string> = {};
  const latestVersionId: Record<string, string> = {};
  SEED_WORKFLOWS.forEach((w, i) => {
    const id = fid('f', i + 1);
    wfId[w.key] = id;
    const vc = versionCount[w.key] ?? 1;
    workflows.push({ id, workspace_id: WS1, name: w.name, description: w.description, draft: structuredClone(w.definition), draft_version: vc * 5 + 2, origin_version_id: null, created_by: DEMO_USER, created_at: at(60 * DAY - i * DAY), updated_at: at(ages[w.key] ?? DAY), deleted_at: null });
    for (let v = 1; v <= vc; v++) {
      const vid = fid('v', (i + 1) * 10 + v);
      workflow_versions.push({ id: vid, workflow_id: id, version: v, definition: structuredClone(w.definition), def_hash: sha256ish(JSON.stringify(w.definition) + v), note: v === 1 ? '첫 버전' : v === vc ? '프롬프트 다듬기' : '노드 정리', created_by: DEMO_USER, created_at: at((vc - v + 1) * 4 * DAY), });
      latestVersionId[w.key] = vid;
    }
  });
  // 파트너 스튜디오(뷰어 권한) 워크플로 1개
  const partnerWf = SEED_WORKFLOWS.find((w) => w.key === 'docsqa')!;
  workflows.push({ id: fid('f', 21), workspace_id: WS2, name: '파트너 FAQ 응답', description: '파트너사 문의를 FAQ로 답합니다', draft: structuredClone(partnerWf.definition), draft_version: 4, origin_version_id: null, created_by: fid('u', 5), created_at: at(40 * DAY), updated_at: at(2 * DAY), deleted_at: null });
  workflow_versions.push({ id: fid('v', 211), workflow_id: fid('f', 21), version: 1, definition: structuredClone(partnerWf.definition), def_hash: sha256ish('p1'), note: '첫 버전', created_by: fid('u', 5), created_at: at(30 * DAY) });

  // ===== 에이전트 =====
  const A = (n: number) => fid('a', n);
  const agentBase = { workspace_id: WS1, created_by: DEMO_USER, deleted_at: null, origin_license_id: null, api_only: false };
  const agents: DbAgent[] = [
    { ...agentBase, id: A(1), name: '디자인 리서치 에이전트', description: '스케치를 받아 조사 · 컨셉 정리 · 3D 시각화까지 돕습니다', model: 'claude-sonnet-4', fallback_models: ['claude-haiku-4'], system_prompt: '너는 제품 디자인팀의 리서치 담당이다. 사용자의 스케치와 설명을 받아 유사 제품을 조사하고, 디자인 가이드에 맞춰 컨셉을 정리한 뒤 필요하면 3D 시각화 워크플로를 실행한다.', temperature: 0.7, memory_enabled: true, memory_scopes: ['short', 'long'], primary_workflow_id: wfId.concept3d!, created_at: at(45 * DAY), updated_at: at(10 * MIN), icon: '🎨' },
    { ...agentBase, id: A(2), name: '사내 문서 Q&A 에이전트', description: '사내 규정 문서를 근거로 답합니다', model: 'claude-haiku-4', fallback_models: [], system_prompt: '너는 사내 규정 안내 담당이다. 반드시 규정 문서에 근거해 답하고 출처를 붙인다.', temperature: 0.2, memory_enabled: true, memory_scopes: ['short', 'long'], primary_workflow_id: wfId.docsqa!, created_at: at(80 * DAY), updated_at: at(3 * MIN), icon: '📚' },
    { ...agentBase, id: A(3), name: '고객 문의 응대 에이전트', description: '메일 문의를 분류하고 승인 후 답장합니다', model: 'claude-sonnet-4', fallback_models: ['gpt-4o'], system_prompt: '너는 친절한 고객지원 담당자다. 환불·결제 관련 답장은 반드시 승인을 받는다.', temperature: 0.5, memory_enabled: true, memory_scopes: ['short', 'episodic'], primary_workflow_id: wfId.triage!, created_at: at(70 * DAY), updated_at: at(DAY), icon: '💬' },
    { ...agentBase, id: A(4), name: '경쟁사 분석 에이전트', description: '마켓에서 구매한 API 전용 에이전트', model: 'claude-sonnet-4', fallback_models: [], system_prompt: '', temperature: 0.7, memory_enabled: false, memory_scopes: [], primary_workflow_id: null, created_at: at(2 * DAY), updated_at: at(2 * DAY), icon: '🔭', origin_license_id: fid('l', 1), api_only: true },
    { ...agentBase, id: A(5), name: '회의록 정리 에이전트', description: '회의록을 요약하고 할 일을 Notion에 등록합니다', model: 'claude-sonnet-4', fallback_models: [], system_prompt: '회의록을 요약하고 담당자별 할 일을 뽑아 Notion에 등록한다.', temperature: 0.4, memory_enabled: false, memory_scopes: [], primary_workflow_id: wfId.minutes!, created_at: at(30 * DAY), updated_at: at(5 * DAY), icon: '📝' },
    { ...agentBase, id: A(6), name: '뉴스 브리핑 에이전트', description: '관심 주제의 뉴스를 요약해 알려 줍니다', model: 'claude-haiku-4', fallback_models: ['gpt-4o-mini'], system_prompt: '관심 주제의 최신 뉴스를 찾아 5줄로 요약한다. 메일 발송 전에는 승인을 받는다.', temperature: 0.6, memory_enabled: true, memory_scopes: ['short'], primary_workflow_id: wfId.news!, created_at: at(25 * DAY), updated_at: at(2 * HOUR), icon: '📰' },
    { ...agentBase, workspace_id: WS2, created_by: fid('u', 5), id: A(21), name: '파트너 상담 에이전트', description: '파트너사 문의를 FAQ로 답합니다', model: 'claude-haiku-4', fallback_models: [], system_prompt: '파트너 FAQ에 근거해 답한다.', temperature: 0.3, memory_enabled: false, memory_scopes: [], primary_workflow_id: fid('f', 21), created_at: at(40 * DAY), updated_at: at(2 * DAY), icon: '🤝' },
  ];
  const agent_workflows: DbAgentWorkflow[] = [
    { agent_id: A(1), workflow_id: wfId.concept3d!, alias: 'concept_3d' },
    { agent_id: A(1), workflow_id: wfId.competitor!, alias: 'competitor_report' },
    { agent_id: A(2), workflow_id: wfId.docsqa!, alias: 'docs_qa' },
    { agent_id: A(3), workflow_id: wfId.triage!, alias: 'triage' },
    { agent_id: A(5), workflow_id: wfId.minutes!, alias: 'minutes_to_notion' },
    { agent_id: A(6), workflow_id: wfId.news!, alias: 'news_digest' },
    { agent_id: A(21), workflow_id: fid('f', 21), alias: 'partner_faq' },
  ];
  let sk = 0;
  const skill = (agent: string, opts: Partial<DbAgentSkill>): DbAgentSkill => ({ id: fid('sk', ++sk), agent_id: agent, mcp_tool_id: null, builtin_skill: null, require_approval: false, config: { enabled: true }, ...opts });
  const agent_skills: DbAgentSkill[] = [
    skill(A(1), { builtin_skill: 'web_search', config: { enabled: true, note: '유사 제품 · 시장 조사' } }),
    skill(A(1), { builtin_skill: 'kb_search', config: { enabled: true, kb_id: 'kb-design', note: '디자인 가이드 v2' } }),
    skill(A(1), { mcp_tool_id: fid('mt', 6), require_approval: true, config: { enabled: true, note: '#design 채널 공유' } }),
    skill(A(1), { builtin_skill: 'three_d', config: { enabled: true, note: '스케치 → glTF · 비동기' } }),
    skill(A(2), { builtin_skill: 'kb_search', config: { enabled: true, kb_id: 'kb-policy', note: '사내 규정' } }),
    skill(A(2), { builtin_skill: 'memory_save', config: { enabled: true } }),
    skill(A(3), { builtin_skill: 'mail_send', require_approval: true, config: { enabled: true, note: '메일 보내기(승인)' } }),
    skill(A(3), { builtin_skill: 'kb_search', config: { enabled: true, kb_id: 'kb-faq' } }),
    skill(A(5), { mcp_tool_id: fid('mt', 11), config: { enabled: true } }),
    skill(A(6), { builtin_skill: 'web_search', config: { enabled: true } }),
    skill(A(6), { builtin_skill: 'mail_send', require_approval: true, config: { enabled: true } }),
    skill(A(21), { builtin_skill: 'kb_search', config: { enabled: true } }),
  ];

  // ===== 배포 =====
  const ep = (n: number, ws: string, slug: string, agent: string, wfKey: string | null, versionId: string, mode: 'sync' | 'async', webhook: string | null, rpm: number, age: number): DbEndpoint => {
    const defn = wfKey ? SEED_WORKFLOWS.find((w) => w.key === wfKey)!.definition : partnerWf.definition;
    return { id: fid('e', n), workspace_id: ws, slug, agent_id: agent, workflow_version_id: versionId, mode, input_schema: inputSchemaOf(defn), webhook_url: webhook, webhook_secret: `whsec_${sha256ish(slug)}${sha256ish(slug + 'x')}`, rate_limit_rpm: rpm, is_active: true, created_at: at(age), updated_at: at(age / 2) };
  };
  const endpoints: DbEndpoint[] = [
    ep(1, WS1, 'design-research', A(1), 'concept3d', latestVersionId.concept3d!, 'sync', 'https://hooks.example.com/moa-callback', 60, 20 * DAY),
    ep(2, WS1, 'docs-qa', A(2), 'docsqa', latestVersionId.docsqa!, 'sync', null, 120, 40 * DAY),
    ep(3, WS1, 'cs-reply', A(3), 'triage', latestVersionId.triage!, 'async', 'https://hooks.example.com/cs', 30, 15 * DAY),
    ep(21, WS2, 'partner-faq', A(21), null, fid('v', 211), 'sync', null, 60, 30 * DAY),
  ];
  const api_keys: DbApiKey[] = [
    { id: fid('k', 1), workspace_id: WS1, name: '운영 서버', prefix: '3f2a9c1d', secret: 'Rk2u9QwZp4Lx7Vn1Ts8Ye3Hc5Ma6Bd0J', scopes: ['invoke'], last_used_at: at(12 * MIN), expires_at: null, revoked_at: null, created_by: DEMO_USER, created_at: at(33 * DAY) },
    { id: fid('k', 2), workspace_id: WS1, name: '테스트', prefix: '91cd02ab', secret: 'Tq7Wm2Xr5Ka9Lp3Nz6Bv1Hd8Fs4Gc0Ye', scopes: ['invoke'], last_used_at: at(3 * DAY), expires_at: iso(now + 60 * DAY), revoked_at: null, created_by: fid('u', 2), created_at: at(41 * DAY) },
  ];

  // ===== 실행 이력 30건 =====
  const defOf = (k: string) => SEED_WORKFLOWS.find((w) => w.key === k)!.definition;
  const statuses: RunStatus[] = ['succeeded', 'succeeded', 'failed', 'succeeded', 'waiting_approval', 'succeeded', 'canceled', 'succeeded', 'succeeded', 'failed'];
  const plan: { key: string; agent: string | null; trigger: RunSeedSpec['trigger']; endpoint?: string; input: Record<string, unknown>; model: string }[] = [
    { key: 'news', agent: A(6), trigger: 'schedule', input: { topic: 'AI 에이전트' }, model: 'claude-haiku-4' },
    { key: 'concept3d', agent: A(1), trigger: 'editor', input: { sketch: 'https://cdn.moa.dev/sketch/chair.png', description: '접이식 캠핑 의자, 알루미늄 프레임' }, model: 'claude-sonnet-4' },
    { key: 'docsqa', agent: A(2), trigger: 'api', endpoint: fid('e', 2), input: { question: '연차는 언제 생기나요?' }, model: 'claude-haiku-4' },
    { key: 'triage', agent: A(3), trigger: 'api', endpoint: fid('e', 3), input: { subject: '결제 오류', body: '카드 결제가 두 번 됐어요' }, model: 'claude-haiku-4' },
    { key: 'competitor', agent: A(1), trigger: 'slash', input: { companies: '알파AI, 베타랩스' }, model: 'claude-sonnet-4' },
    { key: 'minutes', agent: A(5), trigger: 'editor', input: { transcript: '주간 회의: 출시 일정 확정, QA 담당 지정' }, model: 'claude-sonnet-4' },
    { key: 'prreview', agent: null, trigger: 'editor', input: { pr_url: 'https://github.com/moa/web/pull/42' }, model: 'claude-sonnet-4' },
    { key: 'reviews', agent: null, trigger: 'editor', input: { product_url: 'https://shop.example.com/p/123' }, model: 'claude-sonnet-4' },
  ];
  const specs: RunSeedSpec[] = [];
  for (let i = 0; i < 30; i++) {
    const p = plan[i % plan.length]!;
    let status = statuses[i % statuses.length]!;
    // 승인 대기는 승인 노드가 있는 워크플로에서만, 최근 두 건(Figma "승인 대기 2건")
    const hasApproval = defOf(p.key).nodes.some((n) => n.type === 'approval');
    if (status === 'waiting_approval' && (!hasApproval || i > 15)) status = 'succeeded';
    if (i === 0) status = 'waiting_approval';
    if (i === 1) status = 'waiting_approval';
    const age = i === 0 ? 25 * MIN : i === 1 ? 40 * MIN : i * 22 * HOUR + (i % 5) * 37 * MIN;
    specs.push({ workflowId: wfId[p.key]!, versionId: latestVersionId[p.key] ?? `draft-${wfId[p.key]}`, definition: defOf(p.key), agentId: p.agent, endpointId: p.endpoint ?? null, apiKeyId: p.endpoint ? fid('k', 1) : null, trigger: p.trigger, status, ageMs: age, input: p.input, model: p.model });
  }
  const r1 = seedRuns(WS1, specs, now);
  const r2 = seedRuns(WS2, [{ workflowId: fid('f', 21), versionId: fid('v', 211), definition: partnerWf.definition, agentId: A(21), endpointId: fid('e', 21), trigger: 'api', status: 'succeeded', ageMs: 3 * HOUR, input: { question: '정산 주기가 어떻게 되나요?' }, model: 'claude-haiku-4' }], now, 100);

  // 에이전트 테스트 대화 세션(Figma 07)
  const testSession = { id: fid('cs', 900), workspace_id: WS1, agent_id: A(1), run_id: null, model_family: 'anthropic', last_seq: 8, used_tokens: 0, created_at: at(30 * MIN), budget_tokens: 8000 };
  const tb: [DbContextBlock['role'], string, number, boolean, boolean, string][] = [
    ['system', agents[0]!.system_prompt, 320, true, true, '에이전트 구성'],
    ['memory', '선호: 미니멀한 형태, 알루미늄 소재', 140, false, true, '장기 기억'],
    ['tool', 'RAG 검색 · 디자인 가이드 v2 발췌 4건', 1200, false, true, '스킬'],
    ['tool', '웹 검색 · 유사 제품 결과 5건', 2400, false, true, '스킬'],
    ['user', '접이식 캠핑 의자 컨셉 잡아줘', 60, false, true, '1번째 턴'],
    ['history', '컨셉 초안 (추천 색상 3종 포함)', 900, false, true, '1번째 턴'],
    ['user', '색상 제안은 빼고 다시 정리해줘', 20, false, true, '2번째 턴'],
    ['history', '캠핑 테이블 상판 소재 비교... (요청과 다름)', 700, false, false, '2번째 턴'],
  ];
  const testBlocks: DbContextBlock[] = tb.map(([role, content, tokens, pinned, enabled, src], i) => ({ id: fid('cb', 9000 + i), session_id: testSession.id, seq: i + 1, role, content, token_count: tokens, pinned, enabled, priority: pinned ? 100 : role === 'memory' ? 70 : 50, source_node: src, compressed_into: null, expires_at: null, version: 1, created_at: at(30 * MIN - i * MIN), updated_at: at(30 * MIN - i * MIN) }));
  testSession.used_tokens = testBlocks.filter((b) => b.enabled).reduce((s, b) => s + b.token_count, 0);
  void countTokens;

  // ===== 마켓 =====
  const market = seedMarket(now, WS1, { 인사이트랩: fid('w', 91), 커머스AI: fid('w', 92) });
  market.products.find((p) => p.id === fid('p', 7))!.agent_id = A(3);
  market.products.find((p) => p.id === fid('p', 7))!.endpoint_id = fid('e', 3);
  const p1 = market.products.find((p) => p.id === fid('p', 1))!;
  const p1v = market.versions.filter((v) => v.product_id === p1.id).at(-1)!;
  const purchases: DbPurchase[] = [
    { id: fid('pu', 1), product_id: p1.id, version_id: p1v.id, buyer_ws: WS1, buyer_user: DEMO_USER, license_type: 'api_sub', amount_krw: p1.price_api_month_krw ?? 0, fee_krw: Math.round((p1.price_api_month_krw ?? 0) * 0.2), status: 'paid', pg_tx_id: 'mock_tx_0001', created_at: at(2 * DAY), paid_at: at(2 * DAY) },
  ];
  const licenses: DbLicense[] = [
    { id: fid('l', 1), product_id: p1.id, version_id: p1v.id, buyer_ws: WS1, purchase_id: fid('pu', 1), type: 'api_sub', expires_at: iso(now + 28 * DAY), revoked_at: null, created_at: at(2 * DAY) },
  ];

  // ===== 예산·원장 =====
  const budgets: DbBudget[] = [
    { id: fid('b', 1), workspace_id: WS1, scope_type: 'workspace', scope_id: WS1, monthly_limit_usd: 500, per_run_limit_usd: 2, alert_ratio: 0.8 },
    { id: fid('b', 2), workspace_id: WS1, scope_type: 'agent', scope_id: A(1), monthly_limit_usd: 120, per_run_limit_usd: 1, alert_ratio: 0.8 },
    { id: fid('b', 3), workspace_id: WS1, scope_type: 'agent', scope_id: A(2), monthly_limit_usd: 40, per_run_limit_usd: 0.5, alert_ratio: 0.8 },
    { id: fid('b', 4), workspace_id: WS1, scope_type: 'agent', scope_id: A(6), monthly_limit_usd: 60, per_run_limit_usd: 0.5, alert_ratio: 0.8 },
    { id: fid('b', 21), workspace_id: WS2, scope_type: 'workspace', scope_id: WS2, monthly_limit_usd: 100, per_run_limit_usd: 1, alert_ratio: 0.8 },
  ];
  const ledger = [...r1.ledger, ...r2.ledger, ...syntheticLedger(WS1, agents.filter((a) => a.workspace_id === WS1 && !a.api_only).map((a) => ({ id: a.id, model: a.model })), now, 50_000)];

  const webhook_deliveries: DbWebhookDelivery[] = r1.runs
    .filter((r) => r.endpoint_id === fid('e', 3) || r.endpoint_id === fid('e', 1))
    .slice(0, 6)
    .map((r, i) => ({ id: fid('wd', i + 1), endpoint_id: r.endpoint_id!, run_id: r.id, status_code: i === 2 ? 500 : 200, ok: i !== 2, attempt: i === 2 ? 3 : 1, event: 'run.completed', created_at: r.finished_at ?? r.created_at, payload: { run_id: r.id, status: r.status } }));

  return {
    session: { userId: DEMO_USER, loggedOut: false },
    users,
    workspaces,
    memberships,
    credentials,
    mcp_servers,
    mcp_tools,
    workflows,
    workflow_versions,
    agents,
    agent_workflows,
    agent_skills,
    knowledge_bases,
    endpoints,
    api_keys,
    runs: [...r1.runs, ...r2.runs],
    run_steps: [...r1.steps, ...r2.steps],
    approvals: [...r1.approvals, ...r2.approvals],
    assets_3d: [...r1.assets, ...r2.assets],
    context_sessions: [...r1.sessions, ...r2.sessions, testSession],
    context_blocks: [...r1.blocks, ...r2.blocks, ...testBlocks],
    context_snapshots: [],
    compression_logs: [],
    market_products: market.products,
    market_versions: market.versions,
    purchases,
    licenses,
    reviews: market.reviews,
    budgets,
    usage_ledger: ledger,
    webhook_deliveries,
    templates: structuredClone(SEED_TEMPLATES),
  };
}
