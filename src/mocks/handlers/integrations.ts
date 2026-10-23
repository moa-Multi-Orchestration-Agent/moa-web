import { http } from 'msw';
import { db, type DbMcpServer, type DbMcpTool } from '../db';
import { API, body, guard, isResponse, json, notFound, problem } from '../lib/http';
import { nowIso, uuid } from '../lib/util';
import { credentialView, mcpServerView, mcpToolView } from '../views';

/** 새 서버를 "동기화"하면 이름에 맞는 도구 목록을 만든다(목) */
function toolsFor(server: DbMcpServer): Omit<DbMcpTool, 'id' | 'server_id' | 'synced_at'>[] {
  const n = server.name.toLowerCase();
  const t = (name: string, title: string, description: string, destructive = false, readOnly = false) => ({
    name,
    description,
    input_schema: { type: 'object', properties: { query: { type: 'string', description: '입력' } }, required: ['query'] },
    output_schema: null,
    annotations: { title, destructiveHint: destructive, readOnlyHint: readOnly },
    is_active: true,
  });
  if (n.includes('drive')) return [t('search_files', 'Drive 파일 검색', '파일을 검색합니다', false, true), t('read_file', 'Drive 파일 읽기', '파일 내용을 읽습니다', false, true), t('delete_file', 'Drive 파일 삭제', '파일을 지웁니다', true)];
  if (n.includes('file')) return [t('read_text', '파일 읽기', '텍스트 파일을 읽습니다', false, true), t('write_text', '파일 쓰기', '파일을 씁니다', true)];
  return [t('search', `${server.name} 검색`, '항목을 검색합니다', false, true), t('create', `${server.name} 항목 만들기`, '새 항목을 만듭니다'), t('delete', `${server.name} 항목 삭제`, '항목을 지웁니다', true)];
}

export const integrationHandlers = [
  http.get(`${API}/mcp/servers`, ({ request }) => {
    const ctx = guard(request);
    if (isResponse(ctx)) return ctx;
    return json({ items: db.mcp_servers.filter((s) => s.workspace_id === ctx.wsId).map(mcpServerView), next_cursor: null });
  }),
  http.post(`${API}/mcp/servers`, async ({ request }) => {
    const ctx = guard(request, 'admin');
    if (isResponse(ctx)) return ctx;
    const b = await body<Partial<DbMcpServer>>(request);
    if (!b.name?.trim()) return problem('MOA-VALIDATION', '이름을 입력하세요.');
    if (b.transport === 'stdio' ? !b.command : !b.url) return problem('MOA-VALIDATION', b.transport === 'stdio' ? 'stdio는 실행 명령이 필요합니다.' : 'URL이 필요합니다.');
    if (db.mcp_servers.some((s) => s.workspace_id === ctx.wsId && s.name === b.name)) return problem('MOA-VALIDATION', '같은 이름의 서버가 있습니다.', {}, 409);
    if (b.url && /fail|unreachable/.test(b.url)) return problem('MOA-MCP-001', `${b.url}에 연결하지 못했습니다. 주소와 인증을 확인하세요.`);
    const s: DbMcpServer = { id: uuid(), workspace_id: ctx.wsId, name: b.name.trim(), transport: b.transport ?? 'http', command: b.command ?? null, url: b.url ?? null, credential_id: b.credential_id ?? null, allow_tools: b.allow_tools ?? null, is_active: true, last_synced_at: nowIso(), created_at: nowIso(), status: 'connected', icon: b.name.toLowerCase() };
    db.mcp_servers.push(s);
    for (const t of toolsFor(s)) {
      if (s.allow_tools && !s.allow_tools.includes(t.name)) continue;
      db.mcp_tools.push({ ...t, id: uuid(), server_id: s.id, synced_at: nowIso() });
    }
    return json(mcpServerView(s), 201);
  }),
  http.post(`${API}/mcp/servers/:id/sync`, ({ request, params }) => {
    const ctx = guard(request, 'admin');
    if (isResponse(ctx)) return ctx;
    const s = db.mcp_servers.find((x) => x.id === params.id && x.workspace_id === ctx.wsId);
    if (!s) return notFound('MCP 서버');
    s.last_synced_at = nowIso();
    s.status = 'connected';
    for (const t of db.mcp_tools.filter((x) => x.server_id === s.id)) t.synced_at = nowIso();
    return json({ server: mcpServerView(s), tools: db.mcp_tools.filter((t) => t.server_id === s.id).map(mcpToolView) });
  }),
  http.delete(`${API}/mcp/servers/:id`, ({ request, params }) => {
    const ctx = guard(request, 'admin');
    if (isResponse(ctx)) return ctx;
    const idx = db.mcp_servers.findIndex((x) => x.id === params.id && x.workspace_id === ctx.wsId);
    if (idx < 0) return notFound('MCP 서버');
    const [s] = db.mcp_servers.splice(idx, 1);
    db.mcp_tools = db.mcp_tools.filter((t) => t.server_id !== s!.id);
    return new Response(null, { status: 204 });
  }),
  http.get(`${API}/mcp/tools`, ({ request }) => {
    const ctx = guard(request);
    if (isResponse(ctx)) return ctx;
    const serverId = new URL(request.url).searchParams.get('server_id');
    const servers = new Set(db.mcp_servers.filter((s) => s.workspace_id === ctx.wsId && (!serverId || s.id === serverId)).map((s) => s.id));
    return json({ items: db.mcp_tools.filter((t) => servers.has(t.server_id) && t.is_active).map(mcpToolView), next_cursor: null });
  }),
  http.get(`${API}/credentials`, ({ request }) => {
    const ctx = guard(request);
    if (isResponse(ctx)) return ctx;
    return json({ items: db.credentials.filter((c) => c.workspace_id === ctx.wsId).map(credentialView), next_cursor: null });
  }),
  http.post(`${API}/credentials`, async ({ request }) => {
    const ctx = guard(request, 'admin');
    if (isResponse(ctx)) return ctx;
    const b = await body<{ provider?: string; label?: string; secret?: string; purposes?: string[] }>(request);
    if (!b.provider || !b.label || !b.secret) return problem('MOA-VALIDATION', '제공자·이름·값을 모두 입력하세요.');
    if (db.credentials.some((c) => c.workspace_id === ctx.wsId && c.provider === b.provider && c.label === b.label)) return problem('MOA-VALIDATION', '같은 이름의 자격증명이 있습니다.', {}, 409);
    const c = { id: uuid(), workspace_id: ctx.wsId, provider: b.provider, label: b.label, key_version: 1, purposes: b.purposes ?? [], created_by: ctx.userId, created_at: nowIso(), secret: b.secret, expires_at: null, used_by: [] };
    db.credentials.push(c);
    // 응답에 평문 없음(2.6.2)
    return json(credentialView(c), 201);
  }),
  http.delete(`${API}/credentials/:id`, ({ request, params }) => {
    const ctx = guard(request, 'admin');
    if (isResponse(ctx)) return ctx;
    const idx = db.credentials.findIndex((c) => c.id === params.id && c.workspace_id === ctx.wsId);
    if (idx < 0) return notFound('자격증명');
    db.credentials.splice(idx, 1);
    return new Response(null, { status: 204 });
  }),
  http.get(`${API}/knowledge-bases`, ({ request }) => {
    const ctx = guard(request);
    if (isResponse(ctx)) return ctx;
    return json({ items: db.knowledge_bases.filter((k) => k.workspace_id === ctx.wsId), next_cursor: null });
  }),
];
