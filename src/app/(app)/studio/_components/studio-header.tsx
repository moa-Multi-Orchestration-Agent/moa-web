'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bot, ChevronDown, LayoutTemplate, Upload, Workflow as WorkflowIcon } from 'lucide-react';
import { toast } from 'sonner';
import { definitionSchema, useCreateWorkflow } from '@/entities/workflow';
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

  const doImport = () => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      setError(copy.studio.importInvalid);
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
            <Button onClick={doImport} disabled={!json.trim() || create.isPending}>
              {copy.studio.import}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
