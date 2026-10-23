'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Check, Plus, Search } from 'lucide-react';
import { BUILTIN_SKILLS } from '@/entities/agent';
import { useMcpTools } from '@/entities/mcp';
import { useWorkflows } from '@/entities/workflow';
import { cn } from '@/shared/lib/utils';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { Input } from '@/shared/ui/input';
import { LineTabs } from '@/shared/ui/line-tabs';
import { EmptyState, ErrorState, CardGridSkeleton } from '@/shared/ui/states';
import { aliasFromName, skillKind, type DraftSkill, type DraftWorkflow } from './draft';

interface Option {
  key: string;
  tab: 'builtin' | 'kb' | 'mcp' | 'workflow';
  label: string;
  description: string;
  badge: string;
  destructive: boolean;
  make: () => { skill?: DraftSkill; workflow?: DraftWorkflow };
}

const TABS = [
  { value: 'all', label: '전체' },
  { value: 'builtin', label: '기본' },
  { value: 'kb', label: '지식 (RAG)' },
  { value: 'mcp', label: 'MCP 도구' },
  { value: 'workflow', label: '내 워크플로' },
  { value: 'market', label: '마켓' },
] as const;

export function SkillPicker({
  open,
  onOpenChange,
  existing,
  existingWorkflows,
  onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  existing: DraftSkill[];
  existingWorkflows: DraftWorkflow[];
  onDone: (skills: DraftSkill[], workflows: DraftWorkflow[]) => void;
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]['value']>('all');
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<Record<string, Option>>({});
  const tools = useMcpTools();
  const workflows = useWorkflows({ limit: 50 });

  const options: Option[] = useMemo(() => {
    const builtin: Option[] = BUILTIN_SKILLS.map((b) => ({
      key: b.id,
      tab: b.id === 'kb_search' ? 'kb' : 'builtin',
      label: b.label,
      description: b.description,
      badge: b.kind,
      destructive: b.destructive,
      make: () => ({ skill: { id: null, key: b.id, mcp_tool_id: null, builtin_skill: b.id, require_approval: b.destructive, enabled: true, label: b.label, description: b.description, kindLabel: skillKind(b.id), destructive: b.destructive } }),
    }));
    const mcp: Option[] = (tools.data ?? []).map((t) => ({
      key: t.id,
      tab: 'mcp',
      label: t.annotations.title ?? t.name,
      description: t.description ?? t.name,
      badge: `MCP · ${t.server_name}`,
      destructive: !!t.annotations.destructiveHint,
      make: () => ({ skill: { id: null, key: t.id, mcp_tool_id: t.id, builtin_skill: null, require_approval: !!t.annotations.destructiveHint, enabled: true, label: t.annotations.title ?? t.name, description: t.description ?? undefined, kindLabel: 'MCP', destructive: !!t.annotations.destructiveHint } }),
    }));
    const wfs: Option[] = workflows.items.map((w) => ({
      key: `wf:${w.id}`,
      tab: 'workflow',
      label: w.name,
      description: w.description ?? `노드 ${w.nodeCount}개`,
      badge: '워크플로',
      destructive: false,
      make: () => ({ workflow: { workflow_id: w.id, alias: aliasFromName(w.name, existingWorkflows.map((x) => x.alias)), name: w.name } }),
    }));
    return [...builtin, ...mcp, ...wfs];
  }, [tools.data, workflows.items, existingWorkflows]);

  const already = new Set([...existing.map((s) => s.key), ...existingWorkflows.map((w) => `wf:${w.workflow_id}`)]);
  const visible = options.filter((o) => (tab === 'all' || o.tab === tab) && (!q || `${o.label} ${o.description}`.toLowerCase().includes(q.toLowerCase())));
  const count = Object.keys(picked).length;

  const toggle = (o: Option) =>
    setPicked((p) => {
      const n = { ...p };
      if (n[o.key]) delete n[o.key];
      else n[o.key] = o;
      return n;
    });

  const finish = () => {
    const made = Object.values(picked).map((o) => o.make());
    onDone(made.flatMap((m) => (m.skill ? [m.skill] : [])), made.flatMap((m) => (m.workflow ? [m.workflow] : [])));
    setPicked({});
    onOpenChange(false);
  };

  const loading = tools.isPending || workflows.isPending;
  const error = tools.error ?? workflows.error;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) setPicked({}); onOpenChange(o); }}>
      <DialogContent className="flex max-h-[86vh] flex-col gap-0 p-0 sm:max-w-[880px]">
        <DialogHeader className="border-b px-6 pt-6 pb-4">
          <DialogTitle className="text-title">스킬 추가</DialogTitle>
          <DialogDescription>에이전트가 상황에 맞게 골라 쓸 도구입니다. 워크플로도 스킬처럼 붙일 수 있어요.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 px-6 pt-4">
          <LineTabs label="스킬 종류" value={tab} onChange={setTab} items={TABS.map((t) => ({ value: t.value, label: t.label }))} />
          <div className="relative">
            <Search className="text-muted pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" aria-hidden />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="스킬 검색" aria-label="스킬 검색" className="pl-9" />
          </div>
        </div>
        <div className="min-h-[300px] flex-1 overflow-y-auto px-6 py-4">
          {tab === 'market' ? (
            <EmptyState title="마켓에서 스킬 찾기" description="다른 사람이 만든 에이전트·워크플로를 구매하면 여기서 스킬로 붙일 수 있어요." action={<Button asChild variant="outline"><Link href="/market">마켓 둘러보기</Link></Button>} />
          ) : loading ? (
            <CardGridSkeleton count={6} />
          ) : error ? (
            <ErrorState error={error} onRetry={() => { void tools.refetch(); void workflows.refetch(); }} />
          ) : visible.length === 0 ? (
            <EmptyState title="찾는 스킬이 없어요" description="검색어를 바꾸거나 연동에서 MCP 서버를 연결하세요." />
          ) : (
            <ul className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {visible.map((o) => {
                const added = already.has(o.key);
                const on = !!picked[o.key];
                return (
                  <li key={o.key} className={cn('flex flex-col rounded-lg border p-4', (added || on) && 'border-primary bg-primary-soft/50')}>
                    <p className="font-semibold">{o.label}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <Badge variant={o.tab === 'mcp' ? 'blue' : 'gray'}>{o.badge}</Badge>
                      {o.destructive ? <Badge variant="orange">실행 전 승인 권장</Badge> : null}
                    </div>
                    <p className="text-muted mt-2 line-clamp-2 flex-1 text-[13px]">{o.description}</p>
                    <div className="mt-3 text-right">
                      {added ? (
                        <span className="inline-flex items-center gap-1 text-sm font-semibold">
                          추가됨 <Check className="size-4" aria-hidden />
                        </span>
                      ) : (
                        <Button size="sm" variant={on ? 'default' : 'outline'} onClick={() => toggle(o)} aria-pressed={on} aria-label={`${o.label} ${on ? '선택 취소' : '추가'}`}>
                          {on ? <Check aria-hidden /> : <Plus aria-hidden />} {on ? '선택됨' : '추가'}
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <DialogFooter className="items-center border-t px-6 py-4 sm:justify-between">
          <p className="text-muted text-sm">
            이번에 추가할 스킬 {count}개 · MCP 서버가 없나요?{' '}
            <Link href="/integrations" className="text-primary font-semibold">
              연동에서 연결하기 →
            </Link>
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              취소
            </Button>
            <Button onClick={finish} disabled={count === 0}>
              완료
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
