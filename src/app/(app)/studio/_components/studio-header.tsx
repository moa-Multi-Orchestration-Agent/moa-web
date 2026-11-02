'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bot, ChevronDown, FileUp, LayoutTemplate, Upload, Workflow as WorkflowIcon } from 'lucide-react';
import { toast } from 'sonner';
import { definitionSchema, useCreateWorkflow, useImportWorkflow } from '@/entities/workflow';
import { useCurrentWorkspace } from '@/entities/workspace';
import { copy } from '@/shared/lib/copy';
import { Button } from '@/shared/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/ui/dropdown-menu';
import { Guarded } from '@/shared/ui/guarded';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { PageHeader } from '@/shared/ui/page-header';
import { Textarea } from '@/shared/ui/textarea';

export function StudioHeader({ tab }: { tab: 'agents' | 'workflows' }) {
  const { can } = useCurrentWorkspace();
  const router = useRouter();
  const [importOpen, setImportOpen] = useState(false);
  const [json, setJson] = useState('');
  const [name, setName] = useState('가져온 워크플로');
  const [error, setError] = useState<string | null>(null);
  const create = useCreateWorkflow();
  const importFile = useImportWorkflow();

  const onPickFile = async (f: File | undefined) => {
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) return setError('파일이 너무 큽니다(2MB 이하).');
    const text = await f.text();
    setJson(text);
    setError(null);
    try {
      const p = JSON.parse(text) as { workflow?: { name?: string } };
      if (p.workflow?.name) setName(p.workflow.name);
    } catch {
      /* 내용 확인은 가져오기 버튼에서 */
    }
  };

  const doImport = () => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      setError(copy.studio.importInvalid);
      return;
    }
    // MOA에서 내보낸 파일(kind: moa.workflow)은 서버가 검증하고 키·지식베이스 참조를 정리한다
    if ((parsed as { kind?: string })?.kind === 'moa.workflow') {
      const file = parsed as { workflow?: Record<string, unknown> };
      importFile.mutate(
        { ...file, workflow: { ...file.workflow, name: name.trim() || file.workflow?.name } },
        {
          onSuccess: (w) => {
            toast.success(copy.studio.imported);
            if (w.import_notes?.length) toast.info(`다시 골라야 하는 설정이 있어요: ${w.import_notes.join(' / ')}`, { duration: 8000 });
            setImportOpen(false);
            router.push(`/workflows/${w.id}/edit`);
          },
          onError: (e) => setError(e.message),
        },
      );
      return;
    }
    const r = definitionSchema.safeParse((parsed as { draft?: unknown })?.draft ?? parsed);
    if (!r.success) {
      setError(copy.studio.importInvalid);
      return;
    }
    create.mutate(
      { name: name.trim() || '가져온 워크플로', draft: r.data },
      {
        onSuccess: (w) => {
          toast.success(copy.studio.imported);
          setImportOpen(false);
          router.push(`/workflows/${w.id}/edit`);
        },
        onError: (e) => setError(e.message),
      },
    );
  };

  const primary = tab === 'agents' ? { label: copy.studio.newAgent, href: '/studio/new?type=agent' } : { label: copy.studio.newWorkflow, href: '/studio/new?type=workflow' };

  return (
    <>
      <PageHeader
        title={copy.studio.title}
        description={copy.studio.subtitle}
        actions={
          <>
            <Guarded allowed={can('edit')} reason={copy.common.viewerReason}>
              <Button variant="outline" onClick={() => setImportOpen(true)}>
                <Upload aria-hidden /> {copy.studio.import}
              </Button>
            </Guarded>
            <div className="flex">
              <Guarded allowed={can('edit')} reason={copy.common.viewerReason}>
                <Button asChild={can('edit')} className="rounded-r-none">
                  {can('edit') ? <Link href={primary.href}>+ {primary.label}</Link> : <span>+ {primary.label}</span>}
                </Button>
              </Guarded>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button className="border-primary-foreground/30 rounded-l-none border-l px-2" aria-label={copy.studio.newMenu} disabled={!can('edit')}>
                    <ChevronDown aria-hidden />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => router.push('/studio/new?type=agent&start=blank')}>
                    <Bot aria-hidden /> {copy.studio.blankAgent}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => router.push('/studio/new?type=workflow&start=blank')}>
                    <WorkflowIcon aria-hidden /> {copy.studio.blankWorkflow}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => router.push('/templates')}>
                    <LayoutTemplate aria-hidden /> {copy.studio.fromTemplate}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </>
        }
      />
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{copy.studio.importTitle}</DialogTitle>
            <DialogDescription>{copy.studio.importBody}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="import-name">이름</Label>
              <Input id="import-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="import-file" className="flex items-center gap-1.5"><FileUp className="size-4" aria-hidden /> 파일에서 불러오기 (MOA에서 내보낸 .json)</Label>
              <Input id="import-file" type="file" accept=".json,application/json" onChange={(e) => void onPickFile(e.target.files?.[0])} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="import-json">JSON</Label>
              <Textarea id="import-json" value={json} onChange={(e) => setJson(e.target.value)} className="h-48 font-mono text-xs" placeholder='{"nodes": [...], "edges": [...]}' aria-invalid={!!error} />
              {error ? (
                <p role="alert" className="text-danger text-sm">
                  {error}
                </p>
              ) : null}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setImportOpen(false)}>
              {copy.common.cancel}
            </Button>
            <Button onClick={doImport} disabled={!json.trim() || create.isPending || importFile.isPending}>
              {copy.studio.import}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
