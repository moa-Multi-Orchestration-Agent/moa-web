'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Copy, ExternalLink, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useDeleteAgent, useDuplicateAgent, useUpdateAgent } from '@/entities/agent';
import { useDeleteWorkflow, useDuplicateWorkflow, useUpdateWorkflow } from '@/entities/workflow';
import { useCurrentWorkspace } from '@/entities/workspace';
import { copy } from '@/shared/lib/copy';
import { Button } from '@/shared/ui/button';
import { ConfirmDialog } from '@/shared/ui/confirm-dialog';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/shared/ui/dropdown-menu';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';

export function ItemMenu({ kind, id, name, href, locked }: { kind: 'agent' | 'workflow'; id: string; name: string; href: string; locked?: boolean }) {
  const router = useRouter();
  const { can } = useCurrentWorkspace();
  const [confirm, setConfirm] = useState(false);
  const [rename, setRename] = useState(false);
  const [newName, setNewName] = useState(name);
  const dupA = useDuplicateAgent();
  const dupW = useDuplicateWorkflow();
  const delA = useDeleteAgent();
  const delW = useDeleteWorkflow();
  const updA = useUpdateAgent();
  const updW = useUpdateWorkflow();
  const label = kind === 'agent' ? '에이전트' : '워크플로';

  const onDuplicate = () => {
    const m = kind === 'agent' ? dupA : dupW;
    m.mutate(id, { onSuccess: () => toast.success(copy.toast.duplicated(label)), onError: (e) => toast.error(e.message) });
  };
  const onDelete = () => {
    const m = kind === 'agent' ? delA : delW;
    m.mutate(id, {
      onSuccess: () => toast.success(copy.toast.deleted(label)),
      onError: (e) => toast.error(e.message),
      onSettled: () => setConfirm(false),
    });
  };
  const onRename = () => {
    const v = newName.trim();
    if (!v) return;
    const opts = { onSuccess: () => toast.success(copy.toast.renamed), onError: (e: Error) => toast.error(e.message) };
    if (kind === 'agent') updA.mutate({ id, name: v }, opts);
    else updW.mutate({ id, name: v }, opts);
    setRename(false);
  };
  const canEdit = can('edit') && !locked;
  const canDelete = can('delete');

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={copy.studio.menu(name)}>
            <MoreHorizontal aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => router.push(href)}>
            <ExternalLink aria-hidden /> {copy.studio.open}
          </DropdownMenuItem>
          <DropdownMenuItem disabled={!canEdit} onSelect={onDuplicate}>
            <Copy aria-hidden /> {copy.studio.duplicate}
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!canEdit}
            onSelect={() => {
              setNewName(name);
              setRename(true);
            }}
          >
            <Pencil aria-hidden /> {copy.studio.rename}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={!canDelete} variant="destructive" onSelect={() => setConfirm(true)} title={canDelete ? undefined : copy.common.adminOnly}>
            <Trash2 aria-hidden /> {copy.common.delete}
            {!canDelete ? <span className="text-muted ml-auto text-[11px]">관리자 이상</span> : null}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={copy.studio.deleteConfirm(name)}
        description={copy.studio.deleteBody}
        pending={delA.isPending || delW.isPending}
        onConfirm={onDelete}
      />
      <Dialog open={rename} onOpenChange={setRename}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{copy.studio.renameTitle}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onRename();
            }}
            className="space-y-2"
          >
            <Label htmlFor={`rename-${id}`}>이름</Label>
            <Input id={`rename-${id}`} value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus maxLength={80} />
            <DialogFooter className="mt-4">
              <Button type="button" variant="ghost" onClick={() => setRename(false)}>
                {copy.common.cancel}
              </Button>
              <Button type="submit" disabled={!newName.trim()}>
                {copy.common.save}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
