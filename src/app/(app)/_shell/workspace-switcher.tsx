'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Check, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { useCurrentWorkspace, useCurrentWorkspaceStore } from '@/entities/workspace';
import { copy } from '@/shared/lib/copy';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu';

export function WorkspaceSwitcher() {
  const { workspace, query } = useCurrentWorkspace();
  const setId = useCurrentWorkspaceStore((s) => s.setId);
  const qc = useQueryClient();
  const all = query.data ?? [];

  const switchTo = (id: string, name: string) => {
    if (id === workspace?.id) return;
    setId(id);
    // 워크스페이스별 캐시는 키가 달라 자동으로 다시 불러온다. 승인 대기 같은 전역 조회만 새로 고친다.
    void qc.invalidateQueries({ queryKey: ['approvals'] });
    toast.success(`${name} 워크스페이스로 바꿨습니다.`);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="h-[38px] max-w-[220px] font-semibold" aria-label={copy.topbar.switchWorkspace}>
          <span className="truncate">{workspace?.name ?? copy.topbar.workspace} 워크스페이스</span>
          <ChevronDown className="opacity-60" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>{copy.topbar.switchWorkspace}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {all.map((w) => (
          <DropdownMenuItem key={w.id} onSelect={() => switchTo(w.id, w.name)} data-testid={`ws-${w.slug}`}>
            <span className="flex-1 truncate">{w.name}</span>
            <Badge variant={w.role === 'owner' ? 'dark' : w.role === 'viewer' ? 'gray' : 'blue'}>{copy.roles[w.role]}</Badge>
            {w.id === workspace?.id ? <Check className="size-4" aria-label="현재 워크스페이스" /> : <span className="size-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
