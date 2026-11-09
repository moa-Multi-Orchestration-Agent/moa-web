import { http } from 'msw';
import { MODELS } from '@/entities/agent/model';
import type { WorkflowDefinition } from '@/entities/workflow/model';
import { db, type DbWorkflow } from '../db';
import { API, body, guard, isResponse, json, notFound, problem } from '../lib/http';
import { nowIso, uuid } from '../lib/util';
import { workflowDetailView } from '../views';
import { kbView } from './extras';

const KEYED = ['anthropic', 'openai', 'google', 'openai_compatible'];
const FAMILY_NAMES: Record<string, string> = { anthropic: 'Anthropic', openai: 'OpenAI', google: 'Google Gemini', openai_compatible: '외부 AI (OpenAI 호환)', ollama: 'Ollama' };
const API_MODEL: Record<string, string> = { 'claude-sonnet-4': 'claude-sonnet-5-5', 'claude-haiku-4': 'claude-haiku-5-5', 'claude-opus-4': 'claude-opus-5-5' };
/** 다른 워크스페이스에서는 의미가 없는 참조. 내보내기·가져오기 때 지운다(백엔드와 같은 규칙). */
const WS_REFS = ['credential_id', 'kb_id', 'kb_name', 'agent_id', 'approvers', 'assignee'];

function stripRefs(draft: { nodes: unknown[]; edges: unknown[] }) {
  const d = structuredClone(draft) as { nodes: { id: string; name?: string; config?: Record<string, unknown> }[]; edges: unknown[] };
  const notes: string[] = [];
  for (const n of d.nodes) {
    const cfg = n.config;
    if (!cfg) continue;
    const cleared = WS_REFS.filter((k) => cfg[k] !== undefined && cfg[k] !== null && cfg[k] !== '' && !(Array.isArray(cfg[k]) && (cfg[k] as unknown[]).length === 0));
    for (const k of cleared) cfg[k] = k === 'approvers' ? [] : null;
    if (cleared.length) notes.push(`${n.name ?? n.id}: ${cleared.join(', ')} 다시 선택 필요`);
  }
  return { draft: d, notes };
}

function modelsOf(wsId: string) {
  const ws = db.workspaces.find((w) => w.id === wsId);
  const defaults = ((ws?.settings as { model_credentials?: Record<string, string> } | undefined)?.model_credentials ?? {}) as Record<string, string>;
  const creds = db.credentials.filter((c) => c.workspace_id === wsId && c.purposes.includes('llm'));
  const familyInfo = (family: string) => {
    const keys = creds.filter((c) => c.provider === family).map((c) => ({ id: c.id, label: c.label, masked: c.secret ? `${c.secret.slice(0, 4)}••••${c.secret.slice(-4)}` : '키 없음', is_demo: !!c.is_demo, base_url: c.base_url ?? null, models: c.models ?? [] }));
    const source = keys.some((k) => !k.is_demo) ? 'workspace' : family === 'openai_compatible' ? 'missing' : 'demo';
    const def = keys.find((k) => k.id === defaults[family])?.id ?? keys[0]?.id ?? null;
    return { source, keyable: KEYED.includes(family), credentials: keys, default_credential_id: def };
  };
  const items: Record<string, unknown>[] = MODELS.map((m) => ({ id: m.id, label: m.label, family: m.family, context_window: m.context, price_in: m.price_in, price_out: m.price_out, max_output: m.family === 'ollama' ? 2048 : 4096, api_model: API_MODEL[m.id] ?? m.id, ...familyInfo(m.family) }));
  // 외부 AI 키에 등록한 모델(백엔드와 같은 규칙)
  const ext = familyInfo('openai_compatible');
  for (const k of ext.credentials) {
    for (const mid of k.models) {
      const id = `openai_compatible:${mid}`;
      if (items.some((x) => x.id === id)) continue;
      items.push({ id, label: mid, family: 'openai_compatible', context_window: 128_000, price_in: 0, price_out: 0, max_output: 4096, api_model: mid, ...ext, default_credential_id: k.id, credential_label: k.label });
    }
  }
  const families = [...KEYED, 'ollama'].map((f) => ({ id: f, label: FAMILY_NAMES[f]!, ...familyInfo(f) }));
  return { items, families, defaults };
}

/** 모델 키 상태, 지식베이스 관리, 워크플로 파일 내보내기·가져오기 */
export const modelHandlers = [
  http.get(`${API}/models`, ({ request }) => {
    const ctx = guard(request);
    if (isResponse(ctx)) return ctx;
    return json(modelsOf(ctx.wsId));
  }),
  http.put(`${API}/models/defaults`, async ({ request }) => {
    const ctx = guard(request, 'admin');
    if (isResponse(ctx)) return ctx;
    const b = await body<Record<string, string | null>>(request);
    const ws = db.workspaces.find((w) => w.id === ctx.wsId)!;
    const settings = ws.settings as typeof ws.settings & { model_credentials?: Record<string, string> };
    const cur = { ...(settings.model_credentials ?? {}) };
    for (const [family, cid] of Object.entries(b)) {
      if (!KEYED.includes(family)) return problem('MOA-VALIDATION', `알 수 없는 모델 계열입니다: ${family}`);
      if (!cid) { delete cur[family]; continue; }
      const c = db.credentials.find((x) => x.id === cid && x.workspace_id === ctx.wsId && x.provider === family);
      if (!c) return problem('MOA-VALIDATION', `${family} 계열에 쓸 수 없는 키입니다.`);
      cur[family] = cid;
    }
    settings.model_credentials = cur;
    return json(modelsOf(ctx.wsId));
  }),
  http.post(`${API}/credentials/:id/test`, ({ request, params }) => {
    const ctx = guard(request, 'admin');
    if (isResponse(ctx)) return ctx;
    const c = db.credentials.find((x) => x.id === params.id && x.workspace_id === ctx.wsId);
    if (!c) return notFound('자격증명');
    if (c.is_demo) return json({ ok: false, checked: false, message: '시드에 들어 있는 보기용 키입니다. 실제 키를 새로 등록하세요.' });
    if (!KEYED.includes(c.provider)) return json({ ok: true, checked: false, message: '이 종류는 연결 확인을 지원하지 않습니다. 실행할 때 확인됩니다.' });
    // 목: 'bad'가 들어간 키는 거부된 것으로 본다
    const models = c.provider === 'openai_compatible' ? ['meta-llama/llama-3.1-70b-instruct', 'qwen/qwen-2.5-72b-instruct'] : c.provider === 'openai' ? ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1'] : [];
    return json(/bad/i.test(c.secret) ? { ok: false, checked: true, message: '키가 올바르지 않거나 권한이 없습니다.' } : { ok: true, checked: true, message: '연결됐습니다. 이 키로 모델을 호출할 수 있어요.', models });
  }),

  http.post(`${API}/knowledge-bases`, async ({ request }) => {
    const ctx = guard(request, 'maker');
    if (isResponse(ctx)) return ctx;
    const b = await body<{ name?: string; embed_model?: string; chunk_size?: number; chunk_overlap?: number }>(request);
    const name = (b.name ?? '').trim();
    if (!name) return problem('MOA-VALIDATION', '지식베이스 이름을 입력하세요.', { errors: [{ loc: ['body', 'name'], msg: 'required' }] });
    if (db.knowledge_bases.some((k) => k.workspace_id === ctx.wsId && k.name === name)) return problem('MOA-VALIDATION', '같은 이름의 지식베이스가 있습니다.', {}, 409);
    const size = b.chunk_size ?? 800;
    const overlap = b.chunk_overlap ?? 120;
    if (size < 100 || size > 4000) return problem('MOA-VALIDATION', '조각 크기는 100~4000자입니다.');
    if (overlap < 0 || overlap >= size / 2) return problem('MOA-VALIDATION', '겹침은 0 이상, 조각 크기의 절반 미만입니다.');
    const k = { id: uuid(), workspace_id: ctx.wsId, name, embed_model: b.embed_model ?? 'text-embedding-3-small', chunk_size: size, chunk_overlap: overlap, created_at: nowIso(), doc_count: 0, ready_count: 0 };
    db.knowledge_bases.push(k);
    return json(kbView(k), 201);
  }),
  http.patch(`${API}/knowledge-bases/:id`, async ({ request, params }) => {
    const ctx = guard(request, 'maker');
    if (isResponse(ctx)) return ctx;
    const k = db.knowledge_bases.find((x) => x.id === params.id && x.workspace_id === ctx.wsId);
    if (!k) return notFound('지식베이스');
    const b = await body<{ name?: string; chunk_size?: number; chunk_overlap?: number }>(request);
    if (b.name !== undefined) {
      if (!b.name.trim()) return problem('MOA-VALIDATION', '지식베이스 이름을 입력하세요.');
      k.name = b.name.trim();
    }
    if (b.chunk_size !== undefined) k.chunk_size = b.chunk_size;
    if (b.chunk_overlap !== undefined) k.chunk_overlap = b.chunk_overlap;
    return json(kbView(k));
  }),
  http.delete(`${API}/knowledge-bases/:id`, ({ request, params }) => {
    const ctx = guard(request, 'admin');
    if (isResponse(ctx)) return ctx;
    const k = db.knowledge_bases.find((x) => x.id === params.id && x.workspace_id === ctx.wsId);
    if (!k) return notFound('지식베이스');
    db.kb_documents = db.kb_documents.filter((d) => d.kb_id !== k.id);
    db.knowledge_bases = db.knowledge_bases.filter((x) => x !== k);
    return new Response(null, { status: 204 });
  }),
  http.put(`${API}/knowledge-bases/:id/documents/:docId/upload`, async ({ request, params }) => {
    const ctx = guard(request, 'maker');
    if (isResponse(ctx)) return ctx;
    const d = db.kb_documents.find((x) => x.id === params.docId && x.kb_id === params.id);
    if (!d) return notFound('문서');
    const buf = await request.arrayBuffer();
    d.bytes = buf.byteLength || d.bytes;
    return json({ ok: true, bytes: d.bytes });
  }),
  http.post(`${API}/knowledge-bases/:id/search`, async ({ request, params }) => {
    const ctx = guard(request);
    if (isResponse(ctx)) return ctx;
    const k = db.knowledge_bases.find((x) => x.id === params.id && x.workspace_id === ctx.wsId);
    if (!k) return notFound('지식베이스');
    const b = await body<{ query?: string; top_k?: number }>(request);
    const q = (b.query ?? '').trim();
    if (!q) return problem('MOA-VALIDATION', '검색할 문장을 입력하세요.');
    const docs = db.kb_documents.filter((d) => d.kb_id === k.id && d.status === 'ready');
    const items = docs.slice(0, Math.max(1, Math.min(b.top_k ?? 4, 20))).map((d, i) => ({ doc: d.filename, score: Math.round((0.86 - i * 0.07) * 1000) / 1000, text: `${d.filename}에서 "${q}"와(과) 가장 가까운 문단입니다. (목 데이터: 실제 백엔드에서는 색인한 본문 조각이 나옵니다)` }));
    return json({ items, query: q });
  }),

  http.post(`${API}/workflows/import`, async ({ request }) => {
    const ctx = guard(request, 'maker');
    if (isResponse(ctx)) return ctx;
    const b = await body<{ kind?: string; version?: number; workflow?: { name?: string; description?: string | null; draft?: { nodes?: unknown[]; edges?: unknown[] } } }>(request);
    if (b.kind !== 'moa.workflow') return problem('MOA-VALIDATION', 'MOA 워크플로 파일이 아닙니다(kind: moa.workflow).');
    if ((b.version ?? 0) > 1) return problem('MOA-VALIDATION', '더 새 버전의 MOA에서 만든 파일입니다. MOA를 업데이트한 뒤 가져오세요.');
    const draft = b.workflow?.draft;
    if (!draft || !Array.isArray(draft.nodes) || !Array.isArray(draft.edges)) return problem('MOA-VALIDATION', '파일에 nodes·edges가 없습니다.');
    if (draft.nodes.length > 300) return problem('MOA-VALIDATION', '노드가 너무 많습니다(최대 300개).', {}, 413);
    const { draft: clean, notes } = stripRefs({ nodes: draft.nodes, edges: draft.edges });
    const now = nowIso();
    const w: DbWorkflow = { id: uuid(), workspace_id: ctx.wsId, name: (b.workflow?.name || '가져온 워크플로').slice(0, 80), description: b.workflow?.description ?? null, draft: clean as unknown as WorkflowDefinition, draft_version: 1, origin_version_id: null, created_by: ctx.userId, created_at: now, updated_at: now, deleted_at: null };
    db.workflows.push(w);
    return json({ ...workflowDetailView(w), import_notes: notes }, 201);
  }),
  http.get(`${API}/workflows/:id/export`, ({ request, params }) => {
    const ctx = guard(request);
    if (isResponse(ctx)) return ctx;
    const w = db.workflows.find((x) => x.id === params.id && x.workspace_id === ctx.wsId && !x.deleted_at);
    if (!w) return notFound('워크플로');
    const { draft, notes } = stripRefs(w.draft as unknown as { nodes: unknown[]; edges: unknown[] });
    return json({ kind: 'moa.workflow', version: 1, exported_at: nowIso(), workflow: { name: w.name, description: w.description, draft }, notes });
  }),
];
