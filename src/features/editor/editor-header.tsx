'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AlertCircle, ArrowLeft, Check, CloudOff, History, Loader2, Play, RotateCw, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useUpdateWorkflow, type WorkflowDetail } from '@/entities/workflow';
import { relativeTime } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Guarded } from '@/shared/ui/guarded';
import { useEditorStore } from './store';

export type EditorTab = 'design' | 'runs' | 'deploy';

function SaveStatus({ onRetry }: { onRetry: () => void }) {
  const status = useEditorStore((s) => s.saveStatus);
  const dirty = useEditorStore((s) => s.dirty);
  const error = useEditorStore((s) => s.saveError);
  const at = useEditorStore((s) => s.lastSavedAt);
  if (status === 'saving') return <span className="text-muted inline-flex items-center gap-1 text-xs" role="status"><Loader2 className="size-3 animate-spin" aria-hidden /> 저장 중…</span>;
  if (status === 'error')
    return (
      <span className="text-danger inline-flex items-center gap-1 text-xs" role="alert">
        <CloudOff className="size-3" aria-hidden /> 저장 실패 · {error}
        <button type="button" onClick={onRetry} className="inline-flex items-center gap-0.5 font-semibold underline">
          <RotateCw className="size-3" aria-hidden /> 다시 시도
        </button>
      </span>
    );
  if (dirty) return <span className="text-warning text-xs" role="status">저장 대기 중…</span>;
  return (
    <span className="text-muted inline-flex items-center gap-1 text-xs" role="status">
      <Check className="size-3" aria-hidden /> 자동 저장됨{at ? ` · ${relativeTime(new Date(at).toISOString())}` : ''}
    </span>
  );
}

export function EditorHeader({
  wf,
  tab,
  onTab,
  canEdit,
  canDeploy,
  onRun,
  onSaveVersion,
  onVersions,
  onRetrySave,
  running,
  deployHref,
  readOnlyReason,
}: {
  wf: WorkflowDetail;
  tab: EditorTab;
  onTab: (t: EditorTab) => void;
  canEdit: boolean;
  canDeploy: boolean;
  onRun: () => void;
  onSaveVersion: () => void;
  onVersions: () => void;
  onRetrySave: () => void;
  running: boolean;
  deployHref: string | null;
  readOnlyReason: string;
}) {
  const [name, setName] = useState(wf.name);
  const update = useUpdateWorkflow();
  const issues = useEditorStore((s) => Object.values(s.issues).flat().filter((i) => i.severity === 'error').length + s.globalIssues.filter((i) => i.severity === 'error').length);
  const commitName = () => {
    const v = name.trim();
    if (!v || v === wf.name) return setName(wf.name);
    update.mutate({ id: wf.id, name: v }, { onSuccess: () => toast.success('이름을 바꿨습니다.'), onError: (e) => toast.error(e.message) });
  };
  return (
    <header className="bg-background flex h-[58px] shrink-0 items-center gap-4 border-b px-5">
      <Link href="/studio?tab=workflows" className="text-muted hover:text-foreground flex items-center gap-1 text-sm">
        <ArrowLeft className="size-4" aria-hidden /> 스튜디오
      </Link>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <Badge variant="gray">워크플로</Badge>
          <label htmlFor="wf-name" className="sr-only">
            워크플로 이름
          </label>
          <input id="wf-name" value={name} onChange={(e) => setName(e.target.value)} onBlur={commitName} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} disabled={!canEdit} className="hover:bg-surface focus:bg-surface w-64 truncate rounded px-1 font-bold outline-none" />
        </div>
        <p className="flex items-center gap-1.5 px-1">
          <SaveStatus onRetry={onRetrySave} />
          <span className="text-muted text-xs">
            {wf.latestVersion ? ` · v${wf.latestVersion}` : ''}
            {wf.agents.length ? ` · ${wf.agents.map((a) => a.name).join(', ')}에 연결됨` : ''}
          </span>
        </p>
      </div>
      <nav className="ml-4 flex h-full items-stretch gap-5" aria-label="워크플로 편집기 탭">
        {(
          [
            ['design', '설계'],
            ['runs', '실행 기록'],
            ['deploy', '배포'],
          ] as const
        ).map(([t, label]) => (
          <button key={t} type="button" onClick={() => onTab(t)} aria-current={tab === t ? 'page' : undefined} className={cn('border-b-2 px-0.5 text-sm', tab === t ? 'border-foreground font-bold' : 'text-muted hover:text-foreground border-transparent')}>
            {label}
          </button>
        ))}
      </nav>
      <div className="ml-auto flex items-center gap-2">
        {issues ? (
          <span className="text-danger inline-flex items-center gap-1 text-xs font-semibold">
            <AlertCircle className="size-3.5" aria-hidden /> 오류 {issues}
          </span>
        ) : null}
        <Button variant="ghost" size="sm" onClick={onVersions}>
          <History aria-hidden /> 버전{wf.latestVersion ? ` v${wf.latestVersion}` : ''}
        </Button>
        <Guarded allowed={canEdit} reason={readOnlyReason}>
          <Button variant="outline" size="sm" onClick={onSaveVersion}>
            <Save aria-hidden /> 버전 저장
          </Button>
        </Guarded>
        <Guarded allowed={canEdit} reason={readOnlyReason}>
          <Button variant="outline" size="sm" onClick={onRun} disabled={running} data-testid="test-run">
            {running ? <Loader2 className="animate-spin" aria-hidden /> : <Play aria-hidden />} 테스트 실행
          </Button>
        </Guarded>
        <Guarded allowed={canDeploy && !!deployHref} reason={!deployHref ? '에이전트에 연결해야 배포할 수 있습니다(design: endpoints.agent_id).' : readOnlyReason}>
          <Button size="sm" asChild={canDeploy && !!deployHref}>
            {canDeploy && deployHref ? <Link href={deployHref}>배포하기</Link> : <span>배포하기</span>}
          </Button>
        </Guarded>
      </div>
    </header>
  );
}
