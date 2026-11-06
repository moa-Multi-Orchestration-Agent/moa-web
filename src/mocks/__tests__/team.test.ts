import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db';
import { WS1, WS3 } from '../fixtures';
import { api, fail, fresh } from './helpers';

beforeEach(() => fresh());

interface Ws { id: string; name: string; role: string }
interface Noti { id: string; kind: string; action_state: string | null; workspace_id: string | null }

describe('팀 초대 → 알림에서 수락·거절', () => {
  it('처리 전 초대 팀은 목록에 없고, 수락하면 들어온다', async () => {
    const before = (await api.get<{ items: Ws[] }>('/workspaces')).items.map((w) => w.id);
    expect(before).not.toContain(WS3);
    const notes = await api.get<{ items: Noti[]; unread_count: number }>('/notifications');
    const inv = notes.items.find((n) => n.kind === 'invite')!;
    expect(inv.action_state).toBe('pending');
    expect(notes.unread_count).toBeGreaterThan(0);
    // 처리 전 초대 알림은 지울 수 없다
    expect((await fail(api.delete(`/notifications/${inv.id}`))).status).toBe(409);
    const r = await api.post<{ accepted: boolean; workspace: Ws }>(`/invitations/${WS3}/accept`);
    expect(r.workspace.role).toBe('maker');
    expect((await api.get<{ items: Ws[] }>('/workspaces')).items.map((w) => w.id)).toContain(WS3);
    expect(db.notifications.find((n) => n.id === inv.id)!.action_state).toBe('accepted');
    // 초대한 사람에게 결과 알림
    expect(db.notifications.some((n) => n.kind === 'invite_result' && n.user_id !== db.session.userId)).toBe(true);
  });

  it('거절하면 초대가 사라지고 다시 수락할 수 없다', async () => {
    await api.post(`/invitations/${WS3}/decline`);
    expect(db.memberships.some((m) => m.workspace_id === WS3 && m.user_id === db.session.userId)).toBe(false);
    expect((await fail(api.post(`/invitations/${WS3}/accept`))).status).toBe(404);
  });

  it('초대를 보내면 받은 사람 알림함에 쌓이고, 취소하면 취소됨으로 바뀐다', async () => {
    const m = await api.post<{ user_id: string }>(`/workspaces/${WS1}/invites`, { email: 'new@example.com', role: 'viewer' });
    const n = db.notifications.find((x) => x.user_id === m.user_id && x.kind === 'invite')!;
    expect(n.action_state).toBe('pending');
    await api.delete(`/workspaces/${WS1}/members/${m.user_id}`);
    expect(n.action_state).toBe('canceled');
  });
});

describe('팀 만들기·삭제', () => {
  it('만든 사람이 소유자이고, 이름을 맞게 입력해야 삭제된다', async () => {
    const ws = await api.post<Ws>('/workspaces', { name: '새 팀' });
    expect(ws.role).toBe('owner');
    const { setWorkspaceId } = await import('@/shared/lib/api-client');
    setWorkspaceId(ws.id);
    expect((await fail(api.delete(`/workspaces/${ws.id}`, { body: { confirm_name: '틀림' } }))).status).toBe(422);
    await api.delete(`/workspaces/${ws.id}`, { body: { confirm_name: '새 팀' } });
    setWorkspaceId(WS1);
    expect((await api.get<{ items: Ws[] }>('/workspaces')).items.map((w) => w.id)).not.toContain(ws.id);
  });
});

describe('모델 키', () => {
  it('시드 키는 보기용이라 데모, 실제 키를 넣으면 등록한 키 사용', async () => {
    type M = { items: { id: string; source: string; default_credential_id: string | null }[] };
    expect((await api.get<M>('/models')).items.find((m) => m.id === 'claude-sonnet-4')!.source).toBe('demo');
    const c = await api.post<{ id: string }>('/credentials', { provider: 'openai', label: '팀 키', secret: 'sk-live-aaaaaaaaaaaa', purposes: ['llm'] });
    const gpt = (await api.get<M>('/models')).items.find((m) => m.id === 'gpt-4o')!;
    expect(gpt.source).toBe('workspace');
    expect(gpt.default_credential_id).toBe(c.id);
  });
});

describe('워크플로 파일', () => {
  it('내보내면 지식베이스 참조가 빠지고, 다시 가져올 수 있다', async () => {
    const wf = db.workflows.find((w) => w.name === '사내 문서 Q&A')!;
    const exp = await api.get<{ kind: string; workflow: { draft: { nodes: { config: Record<string, unknown> }[] } } }>(`/workflows/${wf.id}/export`);
    expect(exp.kind).toBe('moa.workflow');
    expect(exp.workflow.draft.nodes.every((n) => !n.config.kb_id)).toBe(true);
    const imported = await api.post<{ id: string; import_notes: string[] }>('/workflows/import', exp);
    expect(db.workflows.some((w) => w.id === imported.id)).toBe(true);
  });
});
