import { http } from 'msw';
import { db } from '../db';
import { API, body, guard, ifMatch, isResponse, json, notFound, problem } from '../lib/http';
import { countTokens, nowIso, uuid } from '../lib/util';
import { sessionView } from '../views';

const sessionOf = (wsId: string, id: string) => db.context_sessions.find((s) => s.id === id && s.workspace_id === wsId);

export const contextHandlers = [
  http.get(`${API}/context/sessions/:id`, ({ request, params }) => {
    const ctx = guard(request);
    if (isResponse(ctx)) return ctx;
    const s = sessionOf(ctx.wsId, String(params.id));
    return s ? json(sessionView(s)) : notFound('컨텍스트 세션');
  }),
  http.get(`${API}/context/sessions/:id/blocks`, ({ request, params }) => {
    const ctx = guard(request);
    if (isResponse(ctx)) return ctx;
    const s = sessionOf(ctx.wsId, String(params.id));
    if (!s) return notFound('컨텍스트 세션');
    const includeDisabled = new URL(request.url).searchParams.get('include_disabled') !== 'false';
    const items = db.context_blocks.filter((b) => b.session_id === s.id && (includeDisabled || b.enabled)).sort((a, b) => a.seq - b.seq);
    return json({ items, next_cursor: null });
  }),
  // 고정·끄기·우선순위 변경 (If-Match = block.version, 불일치 시 409 MOA-CTX-003)
  http.patch(`${API}/context/blocks/:id`, async ({ request, params }) => {
    const ctx = guard(request, 'maker');
    if (isResponse(ctx)) return ctx;
    const blk = db.context_blocks.find((b) => b.id === params.id);
    const s = blk ? sessionOf(ctx.wsId, blk.session_id) : null;
    if (!blk || !s) return problem('MOA-CTX-001');
    const expected = ifMatch(request);
    if (expected === null) return problem('MOA-VALIDATION', 'If-Match 헤더가 필요합니다.', {}, 428);
    if (expected !== blk.version) return problem('MOA-CTX-003', `블록 버전이 맞지 않습니다. (내 버전 ${expected}, 서버 버전 ${blk.version})`, { current: blk });
    const b = await body<{ pinned?: boolean; enabled?: boolean; priority?: number; content?: string }>(request);
    if (blk.pinned && b.enabled === false && b.pinned !== false) return problem('MOA-CTX-002', '고정된 블록은 끌 수 없습니다. 먼저 고정을 푸세요.');
    if (b.pinned === true && blk.compressed_into) return problem('MOA-CTX-002', '요약에 포함된 블록은 고정할 수 없습니다. 원문을 먼저 켜세요.');
    if (b.priority !== undefined && (b.priority < 0 || b.priority > 100)) return problem('MOA-VALIDATION', '우선순위는 0~100입니다.');
    if (b.pinned !== undefined) blk.pinned = b.pinned;
    if (b.enabled !== undefined) {
      blk.enabled = b.enabled;
      if (b.enabled && blk.compressed_into) blk.compressed_into = null; // 원문 펼치기
    }
    if (b.priority !== undefined) blk.priority = b.priority;
    if (b.content !== undefined) {
      blk.content = b.content;
      blk.token_count = countTokens(b.content) * 2;
    }
    blk.version += 1;
    blk.updated_at = nowIso();
    return json(blk);
  }),
  http.get(`${API}/context/sessions/:id/snapshots`, ({ request, params }) => {
    const ctx = guard(request);
    if (isResponse(ctx)) return ctx;
    const s = sessionOf(ctx.wsId, String(params.id));
    if (!s) return notFound('컨텍스트 세션');
    const items = db.context_snapshots.filter((x) => x.session_id === s.id).sort((a, b) => b.created_at.localeCompare(a.created_at)).map(({ body: _b, ...x }) => x);
    return json({ items, next_cursor: null });
  }),
  http.post(`${API}/context/sessions/:id/snapshots`, async ({ request, params }) => {
    const ctx = guard(request, 'maker');
    if (isResponse(ctx)) return ctx;
    const s = sessionOf(ctx.wsId, String(params.id));
    if (!s) return notFound('컨텍스트 세션');
    const b = await body<{ label?: string }>(request);
    const blocks = db.context_blocks.filter((x) => x.session_id === s.id).map((x) => structuredClone(x));
    const snap = { id: uuid(), session_id: s.id, label: b.label?.trim() || `스냅샷 ${new Date().toLocaleTimeString('ko-KR')}`, block_count: blocks.length, body: blocks, s3_key: null, created_at: nowIso() };
    db.context_snapshots.push(snap);
    const { body: _b, ...out } = snap;
    return json(out, 201);
  }),
  // 복원: 현재 블록은 끄기만 하고 스냅샷 블록을 새 seq로 다시 넣는다(design.md 2.1.1 restore)
  http.post(`${API}/context/snapshots/:id/restore`, ({ request, params }) => {
    const ctx = guard(request, 'maker');
    if (isResponse(ctx)) return ctx;
    const snap = db.context_snapshots.find((x) => x.id === params.id);
    const s = snap ? sessionOf(ctx.wsId, snap.session_id) : null;
    if (!snap || !s) return notFound('스냅샷');
    for (const b of db.context_blocks.filter((x) => x.session_id === s.id)) Object.assign(b, { enabled: false, version: b.version + 1, updated_at: nowIso() });
    const idMap = new Map<string, string>();
    for (const b of snap.body) idMap.set(b.id, uuid());
    for (const b of snap.body) {
      s.last_seq += 1;
      db.context_blocks.push({ ...structuredClone(b), id: idMap.get(b.id)!, seq: s.last_seq, compressed_into: b.compressed_into ? (idMap.get(b.compressed_into) ?? null) : null, version: 1, created_at: nowIso(), updated_at: nowIso() });
    }
    return json(sessionView(s));
  }),
];
