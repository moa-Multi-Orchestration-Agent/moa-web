'use client';

import { useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useCredentials } from '@/entities/credential';
import { mcpServerFormSchema, TRANSPORT_LABEL, useCreateMcpServer, useDeleteMcpServer, useMcpServers, useMcpTools, useSyncMcpServer, type McpServer, type McpServerForm } from '@/entities/mcp';
import { useCurrentWorkspace } from '@/entities/workspace';
import { isApiError } from '@/shared/lib/api-client';
import { copy } from '@/shared/lib/copy';
import { relativeTime } from '@/shared/lib/format';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { ConfirmDialog } from '@/shared/ui/confirm-dialog';
import { Guarded } from '@/shared/ui/guarded';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { SectionCard } from '@/shared/ui/page-header';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { CardGridSkeleton, EmptyState, ErrorState } from '@/shared/ui/states';
import { OAuthConsentDialog } from './oauth-consent';

function ServerCard({ s }: { s: McpServer }) {
  const [open, setOpen] = useState(false);
  const [del, setDel] = useState(false);
  const tools = useMcpTools(open ? s.id : undefined);
  const sync = useSyncMcpServer();
  const remove = useDeleteMcpServer();
  const { can } = useCurrentWorkspace();
  const st = s.status === 'connected' ? { t: '연결됨', v: 'green' as const, i: CheckCircle2 } : s.status === 'syncing' ? { t: '동기화 중', v: 'blue' as const, i: Loader2 } : { t: '연결 오류', v: 'red' as const, i: AlertTriangle };
  return (
    <article className="bg-card rounded-lg border p-4" aria-label={`${s.name} MCP 서버`}>
      <div className="flex items-start gap-3">
        <span aria-hidden className="bg-surface flex size-10 items-center justify-center rounded-md border font-bold">{s.name.slice(0, 1)}</span>
        <div className="min-w-0 flex-1">
          <p className="font-bold">{s.name}</p>
          <p className="text-muted text-xs">{TRANSPORT_LABEL[s.transport]} · {s.url ?? s.command}{s.auth === 'oauth' ? ' · OAuth' : s.auth === 'token' ? ' · 정적 토큰' : ''}</p>
        </div>
        <Badge variant={st.v}><st.i className={st.v === 'blue' ? 'animate-spin' : undefined} aria-hidden /> {st.t}</Badge>
      </div>
      <p className="text-muted mt-3 text-sm">도구 {s.toolCount}개 → 스킬 · 노드로 추가됨 · {s.lastSyncedAt ? `${relativeTime(s.lastSyncedAt)} 동기화` : '동기화 전'}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="ghost" onClick={() => setOpen((o) => !o)} aria-expanded={open}><ChevronDown className={open ? 'rotate-180' : ''} aria-hidden /> 도구 보기</Button>
        <Guarded allowed={can('manageKeys')} reason={copy.common.adminOnly}>
          <Button size="sm" variant="outline" onClick={() => sync.mutate(s.id, { onSuccess: () => toast.success(`${s.name} 도구를 동기화했습니다.`), onError: (e) => toast.error(e.message) })} disabled={sync.isPending}><RefreshCw aria-hidden /> 도구 동기화</Button>
        </Guarded>
        <Guarded allowed={can('manageKeys')} reason={copy.common.adminOnly}>
          <Button size="icon-sm" variant="ghost" onClick={() => setDel(true)} aria-label={`${s.name} 서버 삭제`}><Trash2 aria-hidden /></Button>
        </Guarded>
      </div>
      {open ? (
        <ul className="mt-3 divide-y rounded-md border text-sm">
          {tools.isPending ? <li className="text-muted p-3">불러오는 중…</li> : (tools.data ?? []).map((t) => (
            <li key={t.id} className="flex items-start gap-2 px-3 py-2">
              <span className="min-w-0 flex-1"><code className="font-mono text-xs">{t.name}</code> → “{t.annotations.title ?? t.name}”<span className="text-muted block text-xs">{t.description}</span></span>
              {t.annotations.destructiveHint ? <Badge variant="orange"><AlertTriangle aria-hidden /> 쓰기 · 승인 권장</Badge> : t.annotations.readOnlyHint ? <Badge variant="gray">읽기 전용</Badge> : null}
            </li>
          ))}
        </ul>
      ) : null}
      <ConfirmDialog open={del} onOpenChange={setDel} title={`${s.name} 서버를 삭제할까요?`} description="이 서버의 도구를 쓰는 스킬·노드가 실행할 때 실패합니다." pending={remove.isPending} onConfirm={() => remove.mutate(s.id, { onSuccess: () => toast.success('삭제했습니다.'), onSettled: () => setDel(false) })} />
    </article>
  );
}

type AuthKind = 'none' | 'token' | 'oauth';
const AUTH_LABEL: Record<AuthKind, string> = { none: '없음', token: '정적 토큰', oauth: 'OAuth 로그인' };

function AddServerPanel() {
  const create = useCreateMcpServer();
  const creds = useCredentials();
  const { can } = useCurrentWorkspace();
  const [form, setForm] = useState<McpServerForm>({ name: '', transport: 'http', command: '', url: 'https://', credential_id: null });
  const [errs, setErrs] = useState<Partial<Record<keyof McpServerForm | 'auth', string>>>({});
  const [auth, setAuth] = useState<AuthKind>('none');
  const [consent, setConsent] = useState<McpServerForm | null>(null);
  const send = (data: McpServerForm, oauthCode?: string) =>
    create.mutate({ ...data, credential_id: auth === 'token' ? data.credential_id : null, auth, oauth_code: oauthCode }, {
      onSuccess: (s) => { toast.success(`${s.name}을(를) 연결하고 도구 ${s.tool_count}개를 가져왔습니다.`); setForm({ name: '', transport: 'http', command: '', url: 'https://', credential_id: null }); setAuth('none'); },
      onError: (e) => (isApiError(e) && e.code === 'MOA-MCP-001' ? setErrs({ [auth === 'oauth' ? 'auth' : 'url']: `${e.detail} (MOA-MCP-001)` }) : toast.error(e.message)),
    });
  const submit = () => {
    const r = mcpServerFormSchema.safeParse(form);
    if (!r.success) return setErrs(Object.fromEntries(r.error.issues.map((i) => [i.path[0], i.message])));
    if (auth === 'token' && !r.data.credential_id) return setErrs({ auth: '정적 토큰으로 쓸 자격증명을 고르세요.' });
    setErrs({});
    // OAuth는 제공자 동의를 먼저 받는다(설계서 미결 7 — 목에서만 흐름을 흉내)
    if (auth === 'oauth') return setConsent(r.data);
    send(r.data);
  };
  const disabled = !can('manageKeys');
  return (
    <SectionCard title="MCP 서버 추가">
      <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="space-y-3">
        <div className="space-y-1.5"><Label htmlFor="mcp-name">이름</Label><Input id="mcp-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="예: Google Drive" disabled={disabled} aria-invalid={!!errs.name} />{errs.name ? <p className="text-danger text-xs">{errs.name}</p> : null}</div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label htmlFor="mcp-transport">전송 방식</Label>
            <Select value={form.transport} onValueChange={(v) => setForm((f) => ({ ...f, transport: v as McpServerForm['transport'] }))} disabled={disabled}><SelectTrigger id="mcp-transport" className="w-full"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(TRANSPORT_LABEL).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="space-y-1.5"><Label htmlFor="mcp-auth">인증</Label>
            <Select value={auth} onValueChange={(v) => { setAuth(v as AuthKind); setErrs((e) => ({ ...e, auth: undefined })); }} disabled={disabled}><SelectTrigger id="mcp-auth" className="w-full" aria-invalid={!!errs.auth}><SelectValue /></SelectTrigger><SelectContent>{Object.entries(AUTH_LABEL).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent></Select>
          </div>
        </div>
        {auth === 'token' ? (
          <div className="space-y-1.5"><Label htmlFor="mcp-cred">토큰 자격증명</Label>
            <Select value={form.credential_id ?? undefined} onValueChange={(v) => setForm((f) => ({ ...f, credential_id: v }))} disabled={disabled}><SelectTrigger id="mcp-cred" className="w-full" aria-invalid={!!errs.auth}><SelectValue placeholder="자격증명 고르기" /></SelectTrigger><SelectContent>{(creds.data ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}</SelectContent></Select>
          </div>
        ) : null}
        {errs.auth ? <p className="text-danger text-xs" role="alert">{errs.auth}</p> : null}
        {form.transport === 'stdio' ? (
          <div className="space-y-1.5"><Label htmlFor="mcp-cmd">실행 명령</Label><Input id="mcp-cmd" value={form.command} onChange={(e) => setForm((f) => ({ ...f, command: e.target.value }))} placeholder="npx -y @modelcontextprotocol/server-filesystem /data" className="font-mono text-xs" disabled={disabled} aria-invalid={!!errs.command} />{errs.command ? <p className="text-danger text-xs">{errs.command}</p> : null}</div>
        ) : (
          <div className="space-y-1.5"><Label htmlFor="mcp-url">서버 URL</Label><Input id="mcp-url" value={form.url} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))} placeholder="https://mcp.서비스.com/mcp" className="font-mono text-xs" disabled={disabled} aria-invalid={!!errs.url} />{errs.url ? <p className="text-danger text-xs">{errs.url}</p> : <p className="text-muted text-xs">주소에 fail을 넣으면 연결 실패(MOA-MCP-001)를 볼 수 있어요.</p>}</div>
        )}
        <p className="text-muted text-xs">연결하면 도구 목록을 가져와 에이전트 스킬과 워크플로 노드에 함께 추가합니다. OAuth 로그인은 목에서 동의 화면만 흉내 냅니다(설계서 미결 7).</p>
        <Guarded allowed={!disabled} reason={copy.common.adminOnly}><Button type="submit" disabled={create.isPending}>{create.isPending ? <Loader2 className="animate-spin" aria-hidden /> : null}연결하고 추가</Button></Guarded>
      </form>
      <OAuthConsentDialog
        open={!!consent}
        provider={consent?.name ?? ''}
        onAllow={(code) => { if (consent) send(consent, code); setConsent(null); }}
        onDeny={() => { setConsent(null); setErrs({ auth: 'OAuth 권한을 허용하지 않아 연결하지 않았습니다.' }); }}
      />
    </SectionCard>
  );
}

export function McpTab() {
  const q = useMcpServers();
  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
      <div className="min-w-0">
        {q.isPending ? <CardGridSkeleton count={4} className="xl:grid-cols-2" /> : q.isError ? <ErrorState error={q.error} onRetry={() => void q.refetch()} /> : !q.data!.length ? <EmptyState title="연결한 MCP 서버가 없어요" description="오른쪽에서 서버를 추가하면 도구가 스킬과 노드로 바로 추가됩니다." /> : (
          <div className="grid gap-4 md:grid-cols-2">{q.data!.map((s) => <ServerCard key={s.id} s={s} />)}</div>
        )}
      </div>
      <AddServerPanel />
    </div>
  );
}
