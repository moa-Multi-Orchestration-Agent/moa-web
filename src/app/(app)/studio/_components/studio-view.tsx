'use client';

import { useEffect, useState } from 'react';
import { LayoutGrid, List, Search } from 'lucide-react';
import { useAgents, type AgentListParams } from '@/entities/agent';
import { TRIGGER_LABEL, useWorkflows, type WorkflowListParams } from '@/entities/workflow';
import { useDebounced } from '@/shared/hooks/use-debounced';
import { useInView } from '@/shared/hooks/use-in-view';
import { useSearchState } from '@/shared/hooks/use-search-state';
import { copy } from '@/shared/lib/copy';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';
import { ChipGroup } from '@/shared/ui/chips';
import { Input } from '@/shared/ui/input';
import { PageContainer } from '@/shared/ui/page-header';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { CardGridSkeleton, EmptyState, ErrorState, ListSkeleton } from '@/shared/ui/states';
import { LineTabs } from '@/shared/ui/line-tabs';
import { AgentCard, AgentTable } from './agent-views';
import { StudioHeader } from './studio-header';
import { WorkflowCard, WorkflowTable } from './workflow-views';

const DEFAULTS = { tab: 'agents', q: '', filter: 'all', sort: 'updated', view: '', trigger: '' };

export function StudioView() {
  const [s, set] = useSearchState(DEFAULTS);
  const tab = s.tab === 'workflows' ? 'workflows' : 'agents';
  const view = s.view || (tab === 'agents' ? 'card' : 'list');
  const [q, setQ] = useState(s.q);
  const dq = useDebounced(q, 250);
  useEffect(() => {
    if (dq !== s.q) set({ q: dq });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dq]);

  const agentParams: AgentListParams = { q: s.q || undefined, filter: s.filter as AgentListParams['filter'], sort: s.sort as AgentListParams['sort'] };
  const wfParams: WorkflowListParams = { q: s.q || undefined, filter: s.filter as WorkflowListParams['filter'], sort: s.sort as WorkflowListParams['sort'], trigger: s.trigger || undefined };
  const agents = useAgents(agentParams);
  const workflows = useWorkflows(wfParams);
  const allAgents = useAgents({});
  const allWorkflows = useWorkflows({});
  const active = tab === 'agents' ? agents : workflows;
  const filters = tab === 'agents' ? copy.studio.agentFilters : copy.studio.workflowFilters;
  const filtered = !!s.q || s.filter !== 'all' || !!s.trigger;

  const { ref, inView } = useInView<HTMLDivElement>();
  useEffect(() => {
    if (inView && active.hasNextPage && !active.isFetchingNextPage) void active.fetchNextPage();
  }, [inView, active]);

  const count = (n: number | null | undefined) => (n === null || n === undefined ? '' : ` ${n}`);

  return (
    <PageContainer>
      <StudioHeader tab={tab} />
      <LineTabs
        label="스튜디오 탭"
        value={tab}
        onChange={(v) => set({ tab: v, filter: 'all', trigger: '', view: '' })}
        items={[
          { value: 'agents', label: `${copy.studio.tabAgents}${count(allAgents.total)}` },
          { value: 'workflows', label: `${copy.studio.tabWorkflows}${count(allWorkflows.total)}` },
        ]}
      />
      <div className="flex flex-wrap items-center gap-3">
        <ChipGroup label="상태 필터" value={s.filter} onChange={(v) => set({ filter: v })} options={Object.entries(filters).map(([value, label]) => ({ value, label }))} />
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="text-muted pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" aria-hidden />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={copy.studio.search} className="h-9 w-56 pl-8" aria-label={copy.studio.search} />
          </div>
          {tab === 'workflows' ? (
            <Select value={s.trigger || 'all'} onValueChange={(v) => set({ trigger: v === 'all' ? '' : v })}>
              <SelectTrigger className="h-9 w-40" aria-label="트리거">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{copy.studio.triggerAll}</SelectItem>
                {Object.entries(TRIGGER_LABEL).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          <Select value={s.sort} onValueChange={(v) => set({ sort: v })}>
            <SelectTrigger className="h-9 w-36" aria-label="정렬">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(copy.studio.sort).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div role="radiogroup" aria-label="보기 방식" className="flex rounded-md border">
            {(['card', 'list'] as const).map((v) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={view === v}
                aria-label={v === 'card' ? copy.studio.viewCard : copy.studio.viewList}
                onClick={() => set({ view: v })}
                className={cn('flex h-9 items-center gap-1 px-2.5 text-sm', view === v ? 'bg-surface-strong font-semibold' : 'text-muted')}
              >
                {v === 'card' ? <LayoutGrid className="size-4" aria-hidden /> : <List className="size-4" aria-hidden />}
                <span className="hidden xl:inline">{v === 'card' ? copy.studio.viewCard : copy.studio.viewList}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {active.isPending ? (
        view === 'card' ? <CardGridSkeleton /> : <ListSkeleton rows={6} />
      ) : active.isError ? (
        <ErrorState error={active.error} onRetry={() => void active.refetch()} />
      ) : active.items.length === 0 ? (
        filtered ? (
          <EmptyState
            title={copy.studio.noResult}
            description={copy.studio.noResultBody}
            action={
              <Button variant="outline" onClick={() => { setQ(''); set({ q: '', filter: 'all', trigger: '' }); }}>
                {copy.studio.clearFilters}
              </Button>
            }
          />
        ) : (
          <EmptyState
            title={tab === 'agents' ? copy.studio.emptyAgents : copy.studio.emptyWorkflows}
            description={tab === 'agents' ? copy.studio.emptyAgentsBody : copy.studio.emptyWorkflowsBody}
            action={
              <Button asChild>
                <a href={tab === 'agents' ? '/studio/new?type=agent' : '/studio/new?type=workflow'}>{tab === 'agents' ? `+ ${copy.studio.newAgent}` : `+ ${copy.studio.newWorkflow}`}</a>
              </Button>
            }
          />
        )
      ) : tab === 'agents' ? (
        view === 'card' ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">{agents.items.map((a) => <AgentCard key={a.id} a={a} />)}</div>
        ) : (
          <AgentTable items={agents.items} />
        )
      ) : view === 'card' ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">{workflows.items.map((w) => <WorkflowCard key={w.id} w={w} />)}</div>
      ) : (
        <WorkflowTable items={workflows.items} />
      )}

      <div ref={ref} aria-hidden className="h-1" />
      {active.isFetchingNextPage ? <ListSkeleton rows={2} /> : null}
      {active.hasNextPage && !active.isFetchingNextPage ? (
        <div className="text-center">
          <Button variant="outline" onClick={() => void active.fetchNextPage()}>
            {copy.studio.loadMore}
          </Button>
        </div>
      ) : null}
      {tab === 'workflows' && active.items.length > 0 ? <p className="bg-primary-soft text-primary rounded-lg px-4 py-3 text-sm">{copy.studio.workflowInfo}</p> : null}
    </PageContainer>
  );
}
