'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Lock, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { useAgent } from '@/entities/agent';
import { useAgentSessions, useContextSession } from '@/entities/context';
import { useEndpoints } from '@/entities/endpoint';
import { useCurrentWorkspace } from '@/entities/workspace';
import { AgentDeployTab, AgentLogsTab } from '@/features/agent-builder/side-tabs';
import { ALIAS_RE, useAgentDraft, useSaveAgent } from '@/features/agent-builder/draft';
import { BasicCard, MemoryCard, ModelCard, PromptCard } from '@/features/agent-builder/config-cards';
import { BuilderHeader, type BuilderTab } from '@/features/agent-builder/builder-header';
import { ChatPanel } from '@/features/agent-builder/chat-panel';
import { SkillsCard, WorkflowsCard } from '@/features/agent-builder/skills-workflows';
import { useAgentChat } from '@/features/agent-builder/use-agent-chat';
import { SnapshotControls } from '@/features/editor/context-panel';
import { LazyContextPanel as ContextPanel } from '@/features/editor/context-panel/lazy';
import { useLeaveGuard } from '@/shared/hooks/use-leave-guard';
import { useSearchState } from '@/shared/hooks/use-search-state';
import { isApiError } from '@/shared/lib/api-client';
import { copy } from '@/shared/lib/copy';
import { Button } from '@/shared/ui/button';
import { Skeleton } from '@/shared/ui/skeleton';
import { EmptyState, ErrorState } from '@/shared/ui/states';

export function AgentPage({ agentId }: { agentId: string | null }) {
  const [s, set] = useSearchState({ tab: 'config', missing: '' });
  const tab = (agentId ? s.tab : 'config') as BuilderTab;
  const router = useRouter();
  const detail = useAgent(agentId);
  const { workspace, can } = useCurrentWorkspace();
  const { draft, setForm, setSkills, setWorkflows, dirty } = useAgentDraft(detail.data);
  const save = useSaveAgent();
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState<string | undefined>();
  const sessions = useAgentSessions(agentId);
  const [sessionId, setSessionId] = useState<string | null>(null);
  useEffect(() => {
    if (!sessionId && sessions.data?.[0]) setSessionId(sessions.data[0].id);
  }, [sessions.data, sessionId]);
  const chat = useAgentChat(agentId, sessionId, setSessionId);
  const session = useContextSession(sessionId);
  const endpoints = useEndpoints();
  const leave = useLeaveGuard(dirty);

  const apiOnly = !!detail.data?.apiOnly;
  const canEdit = can('edit') && !apiOnly;
  const readOnlyReason = apiOnly ? copy.builder.apiOnly : copy.common.viewerReason;
  const myEndpoint = endpoints.data?.find((e) => e.agentId === agentId);

  const doSave = useCallback(async () => {
    if (!draft.form.name.trim()) {
      setNameError('이름을 입력하세요.');
      set({ tab: 'config' });
      return;
    }
    const aliases = draft.workflows.map((w) => w.alias);
    if (draft.workflows.some((w) => !ALIAS_RE.test(w.alias)) || new Set(aliases).size !== aliases.length) {
      toast.error('워크플로 별칭을 확인하세요.');
      return;
    }
    setNameError(undefined);
    setSaving(true);
    try {
      const id = await save(agentId, draft, detail.data);
      toast.success(agentId ? copy.builder.savedToast : copy.builder.created);
      if (!agentId) router.replace(`/agents/${id}`);
    } catch (e) {
      toast.error(isApiError(e) ? e.detail : (e as Error).message);
    } finally {
      setSaving(false);
    }
  }, [agentId, draft, detail.data, save, router, set]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (canEdit && (dirty || !agentId)) void doSave();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [canEdit, dirty, agentId, doSave]);

  if (agentId && detail.isPending) {
    return (
      <div className="flex h-full flex-col" aria-busy="true" aria-label={copy.common.loading}>
        <Skeleton className="h-[58px] w-full rounded-none" />
        <div className="grid flex-1 grid-cols-[1fr_1fr_420px] gap-4 p-6">
          <Skeleton className="h-full" />
          <Skeleton className="h-full" />
          <Skeleton className="h-full" />
        </div>
      </div>
    );
  }
  if (agentId && detail.isError) {
    const notFound = isApiError(detail.error) && detail.error.status === 404;
    return (
      <div className="flex h-full items-center justify-center p-6">
        {notFound ? (
          <EmptyState title="에이전트를 찾을 수 없어요" description="삭제되었거나 다른 워크스페이스의 에이전트입니다." action={<Button onClick={() => router.push('/studio')}>스튜디오로</Button>} />
        ) : (
          <ErrorState error={detail.error} onRetry={() => void detail.refetch()} />
        )}
      </div>
    );
  }

  const pct = session.data ? Math.round((session.data.used_tokens / session.data.budget_tokens) * 100) : 0;
  const newSession = () => {
    chat.reset();
    setSessionId(null);
    toast.success(copy.chat.sessionReset);
  };
  const lastUser = [...chat.messages].reverse().find((m) => m.role === 'user');
  const chatDisabled = !agentId || !can('edit');
  const chatDisabledReason = !agentId ? '먼저 저장하면 테스트할 수 있어요.' : copy.common.viewerReason;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <BuilderHeader
        agentId={agentId}
        name={draft.form.name}
        icon={draft.form.icon ?? '🤖'}
        tab={tab}
        onTab={(t) => set({ tab: t })}
        dirty={dirty}
        saving={saving}
        onSave={() => void doSave()}
        canEdit={canEdit}
        canDeploy={can('deploy') && !apiOnly}
        canPublish={can('market') && !apiOnly}
        primaryWorkflowId={detail.data?.primaryWorkflowId ?? draft.workflows[0]?.workflow_id ?? null}
        deployHref={myEndpoint ? `/deploy/${myEndpoint.id}` : `/deploy?new=1&agent=${agentId}`}
        readOnlyReason={readOnlyReason}
      />
      {apiOnly ? (
        <p role="note" className="bg-primary-soft text-primary flex items-center gap-2 px-6 py-2.5 text-sm">
          <Lock className="size-4" aria-hidden /> {copy.builder.apiOnly}
        </p>
      ) : !can('edit') ? (
        <p role="note" className="bg-surface-strong flex items-center gap-2 px-6 py-2.5 text-sm">
          <Lock className="size-4" aria-hidden /> {copy.common.viewerReason} ({workspace?.name})
        </p>
      ) : s.missing ? (
        <p role="alert" className="bg-warning-soft text-warning flex items-center gap-2 px-6 py-2.5 text-sm">
          <AlertTriangle className="size-4" aria-hidden /> {copy.builder.missingBanner}{' '}
          <a href="/integrations" className="font-semibold underline">
            연동으로 →
          </a>
        </p>
      ) : null}
      {tab === 'config' ? (
        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(0,1fr)_420px] overflow-hidden">
          <div className="space-y-4 overflow-y-auto p-5">
            <BasicCard form={draft.form} setForm={setForm} disabled={!canEdit} errors={{ name: nameError }} />
            <ModelCard form={draft.form} setForm={setForm} disabled={!canEdit} />
            <PromptCard form={draft.form} setForm={setForm} disabled={!canEdit} />
            <MemoryCard form={draft.form} setForm={setForm} disabled={!canEdit} threshold={workspace?.settings.compress_threshold ?? 0.7} />
          </div>
          <div className="space-y-4 overflow-y-auto border-l p-5">
            <SkillsCard skills={draft.skills} workflows={draft.workflows} setSkills={setSkills} setWorkflows={setWorkflows} disabled={!canEdit} />
            <WorkflowsCard workflows={draft.workflows} setWorkflows={setWorkflows} disabled={!canEdit} />
          </div>
          <aside className="bg-background flex min-h-0 flex-col border-l" aria-label={copy.chat.title}>
            <div className="flex items-center gap-2 border-b px-4 py-3">
              <h2 className="font-bold">{copy.chat.title}</h2>
              <Button size="sm" variant="outline" className="ml-auto" onClick={() => set({ tab: 'test' })} disabled={!agentId}>
                {copy.chat.contextBtn(pct)}
              </Button>
              <Button size="sm" variant="ghost" onClick={newSession} disabled={!agentId}>
                <RotateCcw aria-hidden /> {copy.chat.newSession}
              </Button>
            </div>
            <ChatPanel className="flex-1" messages={chat.messages} onSend={(t) => void chat.send(t)} busy={chat.busy} connection={chat.connection} disabled={chatDisabled} disabledReason={chatDisabledReason} />
          </aside>
        </div>
      ) : tab === 'test' && agentId ? (
        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] overflow-hidden">
          <section className="flex min-h-0 flex-col" aria-label={copy.chat.testTitle}>
            <div className="bg-background flex items-center gap-2 border-b px-4 py-3">
              <h2 className="font-bold">{copy.chat.testTitle}</h2>
              <span className="text-muted text-xs">{sessionId ? copy.chat.session(sessionId) : '새 세션'}</span>
              <div className="ml-auto flex gap-2">
                {sessionId ? <SnapshotControls sessionId={sessionId} readOnly={!can('edit')} /> : null}
                <Button size="sm" variant="ghost" onClick={newSession}>
                  <RotateCcw aria-hidden /> {copy.chat.newSession}
                </Button>
              </div>
            </div>
            <ChatPanel className="flex-1" messages={chat.messages} onSend={(t) => void chat.send(t)} busy={chat.busy} connection={chat.connection} disabled={chatDisabled} disabledReason={chatDisabledReason} />
          </section>
          <ContextPanel className="bg-background border-l" showSnapshots={false} sessionId={sessionId} readOnly={!can('edit')} onRegenerate={lastUser ? () => void chat.send(lastUser.text) : undefined} regenerating={chat.busy} />
        </div>
      ) : tab === 'deploy' && agentId ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <AgentDeployTab agentId={agentId} canDeploy={can('deploy') && !apiOnly} reason={readOnlyReason} />
        </div>
      ) : tab === 'logs' && agentId ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <AgentLogsTab agentId={agentId} />
        </div>
      ) : null}
      {leave.dialog}
    </div>
  );
}
