'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { useCurrentWorkspaceStore } from '@/entities/workspace';
import { copy } from '@/shared/lib/copy';
import { Kbd } from '@/shared/ui/kbd';
import { ApprovalsButton } from './approvals-button';
import { CommandPalette } from './command-palette';
import { isEditorPath } from './nav';
import { ShortcutHelp } from './shortcut-help';
import { Sidebar } from './sidebar';
import { UserMenu } from './user-menu';
import { WorkspaceSwitcher } from './workspace-switcher';
import { usePaletteGroups } from './palette-groups';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '';
  const router = useRouter();
  const compact = isEditorPath(pathname);
  const wsId = useCurrentWorkspaceStore((s) => s.id);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [query, setQuery] = useState('');
  const groups = usePaletteGroups(query, paletteOpen);

  // G 다음 H/S/R: 화면 이동
  useEffect(() => {
    let pendingG = 0;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'g' || e.key === 'G') {
        pendingG = Date.now();
        return;
      }
      if (Date.now() - pendingG < 1000) {
        const to = { h: '/home', s: '/studio', r: '/runs' }[e.key.toLowerCase()];
        if (to) {
          e.preventDefault();
          router.push(to);
        }
        pendingG = 0;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [router]);

  const openPalette = (q = '') => {
    setQuery(q);
    setPaletteOpen(true);
  };

  return (
    <div className="flex h-dvh overflow-hidden">
      <a href="#main" className="bg-background sr-only z-50 rounded-md p-2 focus:not-sr-only focus:absolute focus:top-2 focus:left-2">
        본문으로 건너뛰기
      </a>
      <Sidebar compact={compact} userCard={<UserMenu variant="card" onShortcuts={() => setHelpOpen(true)} />} />
      <div className="flex min-w-0 flex-1 flex-col">
        {compact ? null : (
          <header className="bg-background flex h-[60px] shrink-0 items-center gap-4 border-b px-7">
            <WorkspaceSwitcher />
            <button
              type="button"
              onClick={() => openPalette()}
              className="bg-surface text-muted hover:bg-surface-strong flex h-[38px] max-w-[560px] min-w-0 flex-1 items-center gap-2 rounded-md border px-3 text-left text-sm"
              aria-label="커맨드 팔레트 열기"
            >
              <Search className="size-4 shrink-0" aria-hidden />
              <span className="flex-1 truncate">{copy.topbar.commandPlaceholder}</span>
              <Kbd>⌘K</Kbd>
            </button>
            <div className="ml-auto flex items-center gap-3">
              <ApprovalsButton />
              <UserMenu onShortcuts={() => setHelpOpen(true)} />
            </div>
          </header>
        )}
        <main id="main" className="bg-surface min-h-0 flex-1 overflow-y-auto" key={wsId ?? 'none'}>
          {children}
        </main>
      </div>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} query={query} onQueryChange={setQuery} extraGroups={groups} />
      <ShortcutHelp open={helpOpen} onOpenChange={setHelpOpen} />
    </div>
  );
}
