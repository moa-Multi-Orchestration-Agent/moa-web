'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertTriangle, CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { categoryLabel, DIFFICULTY_LABEL, useInstantiateTemplate, useTemplate } from '@/entities/template';
import { useCurrentWorkspace } from '@/entities/workspace';
import { copy } from '@/shared/lib/copy';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Guarded } from '@/shared/ui/guarded';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/shared/ui/sheet';
import { Skeleton } from '@/shared/ui/skeleton';
import { ErrorState } from '@/shared/ui/states';

const FlowPreview = dynamic(() => import('@/features/editor/flow-preview'), {
  ssr: false,
  loading: () => <Skeleton className="h-[260px] w-full" />,
});

export function TemplateSheet({ id, onOpenChange, focusStart }: { id: string | null; onOpenChange: (open: boolean) => void; focusStart?: boolean }) {
  const q = useTemplate(id);
  const t = q.data;
  const router = useRouter();
  const instantiate = useInstantiateTemplate();
  const { can } = useCurrentWorkspace();
  const [name, setName] = useState('');
  const startRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (t) setName(t.name);
  }, [t]);
  useEffect(() => {
    if (t && focusStart) setTimeout(() => startRef.current?.focus(), 50);
  }, [t, focusStart]);

  const missing = t?.connections.filter((c) => !c.connected) ?? [];

  const start = () => {
    if (!t) return;
    instantiate.mutate(
      { id: t.id, name: name.trim() || t.name },
      {
        onSuccess: (r) => {
          toast.success(copy.templates.created(name.trim() || t.name), r.missing.length ? { description: copy.templates.missingAfter(r.missing.map((m) => m.label).join(', ')) } : undefined);
          onOpenChange(false);
          router.push(r.agent_id ? `/agents/${r.agent_id}${r.missing.length ? '?missing=1' : ''}` : `/workflows/${r.workflow_id}/edit`);
        },
        onError: (e) => toast.error(e.message),
      },
    );
  };

  return (
    <Sheet open={!!id} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-[560px]">
        {q.isPending ? (
          <div className="space-y-3 p-6">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-[260px] w-full" />
          </div>
        ) : q.isError ? (
          <div className="p-6">
            <ErrorState error={q.error} onRetry={() => void q.refetch()} />
          </div>
        ) : t ? (
          <>
            <SheetHeader>
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="dark">{copy.templates.official}</Badge>
                <Badge variant={t.kind === 'agent' ? 'blue' : 'gray'}>{copy.templates.kinds[t.kind]}</Badge>
                <Badge variant="gray">{categoryLabel(t.category)}</Badge>
                <Badge variant="gray">
                  {copy.templates.difficulty} {DIFFICULTY_LABEL[t.difficulty]}
                </Badge>
              </div>
              <SheetTitle className="text-title flex items-center gap-2">
                <span aria-hidden>{t.icon}</span> {t.name}
              </SheetTitle>
              <SheetDescription>{t.description}</SheetDescription>
            </SheetHeader>
            <div className="space-y-6 px-4">
              <section>
                <h3 className="mb-2 text-sm font-semibold">{copy.templates.structure}</h3>
                <FlowPreview definition={t.definition} />
                <p className="text-muted mt-1.5 text-xs">
                  {copy.templates.nodes(t.definition.nodes.length)} · 연결 {t.definition.edges.length}개
                </p>
              </section>
              <section>
                <h3 className="mb-2 text-sm font-semibold">{copy.templates.connections}</h3>
                {t.connections.length === 0 ? (
                  <p className="text-muted text-sm">따로 연결할 것이 없어요. 바로 실행할 수 있습니다.</p>
                ) : (
                  <ul className="divide-y rounded-md border">
                    {t.connections.map((c) => (
                      <li key={`${c.kind}-${c.provider}`} className="flex items-center gap-2 px-3 py-2.5 text-sm">
                        {c.connected ? <CheckCircle2 className="text-success size-4" aria-hidden /> : <XCircle className="text-danger size-4" aria-hidden />}
                        <span className="flex-1">{c.label}</span>
                        <Badge variant={c.connected ? 'green' : 'red'}>{c.connected ? copy.templates.connected : copy.templates.missing}</Badge>
                      </li>
                    ))}
                  </ul>
                )}
                {missing.length ? (
                  <div role="status" className="bg-warning-soft text-warning mt-3 flex items-start gap-2 rounded-md p-3 text-sm">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                    <div>
                      <p>{copy.templates.missingBanner(missing.length)}</p>
                      <Link href="/integrations" className="font-semibold underline">
                        {copy.templates.connectNow}
                      </Link>
                    </div>
                  </div>
                ) : null}
              </section>
              <section className="space-y-1.5">
                <Label htmlFor="tpl-name">{copy.templates.nameLabel}</Label>
                <Input id="tpl-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
              </section>
            </div>
            <SheetFooter>
              <Guarded allowed={can('edit')} reason={copy.common.viewerReason}>
                <Button ref={startRef} onClick={start} disabled={instantiate.isPending} className="w-full">
                  {instantiate.isPending ? <Loader2 className="animate-spin" aria-hidden /> : null}
                  {copy.templates.start}
                </Button>
              </Guarded>
            </SheetFooter>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
