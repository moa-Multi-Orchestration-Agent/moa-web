'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ReactFlowProvider, useReactFlow } from '@xyflow/react';
import { useRouter } from 'next/navigation';
import { useEndpoints } from '@/entities/endpoint';
import { inputFieldsOf, useNodeCatalog, useWorkflow, type Block } from '@/entities/workflow';
import { useCurrentWorkspace } from '@/entities/workspace';
import { useLeaveGuard } from '@/shared/hooks/use-leave-guard';
import { useSearchState } from '@/shared/hooks/use-search-state';
import { isApiError } from '@/shared/lib/api-client';
import { copy } from '@/shared/lib/copy';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';
import { Skeleton } from '@/shared/ui/skeleton';
import { EmptyState, ErrorState } from '@/shared/ui/states';
import { useAutosave } from './autosave';
import { Canvas } from './canvas';
import { ConflictDialog } from './conflict-dialog';
import { ContextPanel } from './context-panel';
import { nextNodeId, nodeFromBlock, toDefinition, type FlowNode } from './convert';
import { EditorHeader, type EditorTab } from './editor-header';
import { Inspector, IssueList } from './inspector';
import { NodePalette } from './palette';
import { RunConsole } from './run-console';
import { RunInputDialog } from './run-input-dialog';
import { WorkflowDeployTab, WorkflowRunsTab } from './side-tabs';
import { useEditorStore } from './store';
import { useEditorRun } from './use-editor-run';
import { SaveVersionDialog, VersionsSheet } from './versions';
import { registerBlockIcons } from './wf-node';

function EditorBody({ workflowId }: { workflowId: string }) {
  const router = useRouter();
  const [s, set] = useSearchState({ tab: 'design', right: 'inspector', version: '', run: '' });
  const tab = s.tab as EditorTab;
  const wf = useWorkflow(workflowId);
  const catalog = useNodeCatalog();
  const endpoints = useEndpoints();
  const { can } = useCurrentWorkspace();
  const canEdit = can('edit');
  const loadedId = useEditorStore((st) => st.workflowId);
  const dirty = useEditorStore((st) => st.dirty);
  const saveStatus = useEditorStore((st) => st.saveStatus);
  const [runOpen, setRunOpen] = useState(false);
  const [versionOpen, setVersionOpen] = useState(false);
  const [versionsSheet, setVersionsSheet] = useState(!!s.version);
  const rf = useReactFlow<FlowNode>();

  useEffect(() => {
    if (wf.data && loadedId !== workflowId) useEditorStore.getState().init({ id: wf.data.id, draft: wf.data.draft, draft_version: wf.data.draftVersion });
  }, [wf.data, loadedId, workflowId]);
  useEffect(() => {
    if (catalog.data) registerBlockIcons(Object.fromEntries(catalog.data.blocks.map((b) => [b.id, b.icon])));
  }, [catalog.data]);
  useEffect(() => () => useEditorStore.setState({ workflowId: null }), []);

  const ready = loadedId === workflowId;
  const { saveNow } = useAutosave(workflowId, ready && canEdit);
  const run = useEditorRun(workflowId);
  const leave = useLeaveGuard(dirty || saveStatus === 'saving');
  const fields = useMemo(() => (ready ? inputFieldsOf(toDefinition(useEditorStore.getState().nodes, [])) : []), [ready, runOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (s.run && ready && canEdit) {
      setRunOpen(true);
      set({ run: '' });
    }
  }, [s.run, ready, canEdit, set]);

  const focusNode = useCallback(
    (id: string) => {
      useEditorStore.getState().selectOnly(id);
      const n = useEditorStore.getState().nodes.find((x) => x.id === id);
      if (n) void rf.setCenter(n.position.x + 110, n.position.y + 50, { zoom: 1, duration: 300 });
      set({ right: 'inspector' });
    },
    [rf, set],
  );

  const addCentered = useCallback(
    (b: Block) => {
      if (!canEdit) return;
      const center = rf.screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 - 80 });
      useEditorStore.getState().addNode(nodeFromBlock(b, nextNodeId(useEditorStore.getState().nodes, b), center));
      set({ right: 'inspector' });
    },
    [rf, canEdit, set],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === 'Enter' && canEdit) {
        e.preventDefault();
        setRunOpen(true);
      } else if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (canEdit) saveNow();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [canEdit, saveNow]);

  if (wf.isPending || (wf.data && !ready)) {
    return (
      <div className="flex h-full flex-col" aria-busy="true" aria-label={copy.common.loading}>
        <Skeleton className="h-[58px] w-full rounded-none" />
        <div className="flex flex-1">
          <Skeleton className="m-3 w-[200px]" />
          <Skeleton className="m-3 flex-1" />
          <Skeleton className="m-3 w-[340px]" />
        </div>
      </div>
    );
  }
  if (wf.isError) {
    const nf = isApiError(wf.error) && wf.error.status === 404;
    return (
      <div className="flex h-full items-center justify-center p-6">
        {nf ? <EmptyState title="워크플로를 찾을 수 없어요" description="삭제되었거나 다른 워크스페이스의 워크플로입니다." action={<Button onClick={() => router.push('/studio?tab=workflows')}>스튜디오로</Button>} /> : <ErrorState error={wf.error} onRetry={() => void wf.refetch()} />}
      </div>
    );
  }
  const data = wf.data!;
  const linkedEndpoint = (endpoints.data ?? []).find((e) => data.agents.some((a) => a.id === e.agentId));
  const deployHref = linkedEndpoint ? `/deploy/${linkedEndpoint.id}` : data.agents[0] ? `/deploy?new=1&agent=${data.agents[0].id}` : null;
  const readOnlyReason = copy.common.viewerReason;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <EditorHeader
        wf={data}
        tab={tab}
        onTab={(t) => set({ tab: t })}
        canEdit={canEdit}
        canDeploy={can('deploy')}
        onRun={() => setRunOpen(true)}
        onSaveVersion={() => setVersionOpen(true)}
        onVersions={() => setVersionsSheet(true)}
        onRetrySave={saveNow}
        running={run.busy}
        deployHref={deployHref}
        readOnlyReason={readOnlyReason}
      />
      {tab === 'design' ? (
        <div className="flex min-h-0 flex-1">
          <NodePalette catalog={catalog.data} loading={catalog.isPending} error={catalog.error} onRetry={() => void catalog.refetch()} onAdd={addCentered} disabled={!canEdit} />
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="min-h-0 flex-1">
              <Canvas blocks={catalog.data?.blocks ?? []} readOnly={!canEdit} />
            </div>
            <RunConsole r={run} />
          </div>
          <aside className="bg-background flex w-[340px] shrink-0 flex-col border-l" aria-label="오른쪽 패널">
            <div role="tablist" aria-label="오른쪽 패널 탭" className="flex h-11 shrink-0 gap-5 border-b px-4">
              {(
                [
                  ['inspector', '노드 설정'],
                  ['context', '컨텍스트'],
                ] as const
              ).map(([k, l]) => (
                <button key={k} type="button" role="tab" aria-selected={s.right === k} onClick={() => set({ right: k })} className={cn('border-b-2 text-sm', s.right === k ? 'border-foreground font-bold' : 'text-muted border-transparent')}>
                  {l}
                </button>
              ))}
            </div>
            {s.right === 'context' ? (
              <ContextPanel className="min-h-0 flex-1" sessionId={run.sessionId} readOnly={!canEdit} />
            ) : (
              <div className="min-h-0 flex-1 overflow-y-auto">
                <IssueList onFocus={focusNode} />
                <Inspector readOnly={!canEdit} onFocus={focusNode} />
              </div>
            )}
          </aside>
        </div>
      ) : tab === 'runs' ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <WorkflowRunsTab workflowId={workflowId} />
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <WorkflowDeployTab wf={data} />
        </div>
      )}
      <RunInputDialog open={runOpen} onOpenChange={setRunOpen} fields={fields} onRun={(input) => void run.run(input)} />
      <SaveVersionDialog
        workflowId={workflowId}
        open={versionOpen}
        onOpenChange={setVersionOpen}
        beforeSave={async () => {
          if (useEditorStore.getState().dirty) {
            saveNow();
            await new Promise((r) => setTimeout(r, 900));
          }
        }}
      />
      <VersionsSheet workflowId={workflowId} open={versionsSheet} onOpenChange={(o) => { setVersionsSheet(o); if (!o) set({ version: '' }); }} initial={s.version ? Number(s.version) : null} />
      <ConflictDialog onOverwrite={saveNow} />
      {leave.dialog}
    </div>
  );
}

export default function WorkflowEditor({ workflowId }: { workflowId: string }) {
  return (
    <ReactFlowProvider>
      <EditorBody workflowId={workflowId} />
    </ReactFlowProvider>
  );
}
