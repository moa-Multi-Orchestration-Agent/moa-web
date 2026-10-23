'use client';

import Link from 'next/link';
import { ArrowLeft, Check, ChevronDown, Loader2, Save } from 'lucide-react';
import { useWorkflowVersions } from '@/entities/workflow';
import { copy } from '@/shared/lib/copy';
import { formatDate } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/shared/ui/dropdown-menu';
import { Guarded } from '@/shared/ui/guarded';

export type BuilderTab = 'config' | 'test' | 'deploy' | 'logs';

export function BuilderHeader({
  agentId,
  name,
  icon,
  tab,
  onTab,
  dirty,
  saving,
  onSave,
  canEdit,
  canDeploy,
  canPublish,
  primaryWorkflowId,
  deployHref,
  readOnlyReason,
}: {
  agentId: string | null;
  name: string;
  icon: string;
  tab: BuilderTab;
  onTab: (t: BuilderTab) => void;
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
  canEdit: boolean;
  canDeploy: boolean;
  canPublish: boolean;
  primaryWorkflowId: string | null;
  deployHref: string;
  readOnlyReason: string;
}) {
  const versions = useWorkflowVersions(primaryWorkflowId);
  const latest = versions.data?.[0]?.version ?? null;
  const status = saving ? copy.builder.saving : dirty ? copy.builder.unsaved : agentId ? `${copy.builder.saved}${latest ? ` · v${latest} 초안` : ''}` : '아직 저장하지 않은 새 에이전트';
  const tabs = (Object.keys(copy.builder.tabs) as BuilderTab[]).filter((t) => agentId || t === 'config');

  return (
    <header className="bg-background flex h-[58px] shrink-0 items-center gap-4 border-b px-5">
      <Link href="/studio" className="text-muted hover:text-foreground flex items-center gap-1 text-sm">
        <ArrowLeft className="size-4" aria-hidden /> {copy.builder.back}
      </Link>
      <span aria-hidden className="bg-surface flex size-9 items-center justify-center rounded-md border text-lg">
        {icon}
      </span>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <Badge variant="blue">{copy.builder.kind}</Badge>
          <h1 className="truncate font-bold">{name || '이름 없는 에이전트'}</h1>
        </div>
        <p className={cn('text-xs', dirty ? 'text-warning font-medium' : 'text-muted')} aria-live="polite">
          {status}
        </p>
      </div>
      <nav className="ml-6 flex h-full items-stretch gap-5" aria-label="에이전트 편집기 탭">
        {tabs.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onTab(t)}
            aria-current={tab === t ? 'page' : undefined}
            className={cn('border-b-2 px-0.5 text-sm', tab === t ? 'border-foreground font-bold' : 'text-muted hover:text-foreground border-transparent')}
          >
            {copy.builder.tabs[t]}
          </button>
        ))}
      </nav>
      <div className="ml-auto flex items-center gap-2">
        {primaryWorkflowId ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" aria-label="버전 목록">
                {copy.builder.version(latest)} <ChevronDown aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel className="text-muted text-xs font-normal">연결된 기본 워크플로의 버전</DropdownMenuLabel>
              {(versions.data ?? []).map((v) => (
                <DropdownMenuItem key={v.id} asChild>
                  <Link href={`/workflows/${primaryWorkflowId}/edit?version=${v.version}`}>
                    <span className="font-mono">v{v.version}</span>
                    <span className="text-muted flex-1 truncate text-xs">{v.note}</span>
                    <span className="text-muted text-xs">{formatDate(v.created_at)}</span>
                  </Link>
                </DropdownMenuItem>
              ))}
              {versions.data?.length === 0 ? <p className="text-muted px-2 py-1.5 text-sm">아직 저장한 버전이 없어요.</p> : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
        {agentId ? (
          <Guarded allowed={canPublish} reason={copy.common.adminOnly}>
            <Button variant="outline" asChild={canPublish}>
              {canPublish ? <Link href={`/market/sell?agent=${agentId}`}>{copy.builder.publish}</Link> : <span>{copy.builder.publish}</span>}
            </Button>
          </Guarded>
        ) : null}
        <Guarded allowed={canEdit} reason={readOnlyReason}>
          <Button variant={dirty ? 'default' : 'outline'} onClick={onSave} disabled={saving || (!dirty && !!agentId)} data-testid="agent-save">
            {saving ? <Loader2 className="animate-spin" aria-hidden /> : dirty || !agentId ? <Save aria-hidden /> : <Check aria-hidden />}
            {agentId ? copy.builder.save : '만들기'}
          </Button>
        </Guarded>
        {agentId ? (
          <Guarded allowed={canDeploy} reason={readOnlyReason}>
            <Button asChild={canDeploy} data-testid="agent-deploy-button">
              {canDeploy ? <Link href={deployHref}>{copy.builder.deploy}</Link> : <span>{copy.builder.deploy}</span>}
            </Button>
          </Guarded>
        ) : null}
      </div>
    </header>
  );
}
