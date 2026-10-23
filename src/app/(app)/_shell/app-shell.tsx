'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Search } from 'lucide-react';
import { copy } from '@/shared/lib/copy';
import { Kbd } from '@/shared/ui/kbd';
import { Sidebar } from './sidebar';
import { CommandPalette } from './command-palette';
import { isEditorPath } from './nav';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '';
  const compact = isEditorPath(pathname);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [query, setQuery] = useState('');

  return (
    <div className="flex h-dvh overflow-hidden">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-2">
        본문으로 건너뛰기
      </a>
      <Sidebar compact={compact} />
      <div className="flex min-w-0 flex-1 flex-col">
        {compact ? null : (
          <header className="bg-background flex h-[60px] shrink-0 items-center gap-4 border-b px-7">
            <span className="rounded-md border px-3 py-2 text-sm font-semibold">MOA 팀 워크스페이스</span>
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="bg-surface text-muted hover:bg-surface-strong flex h-[38px] max-w-[560px] flex-1 items-center gap-2 rounded-md border px-3 text-left text-sm"
            >
              <Search className="size-4" aria-hidden />
              <span className="flex-1 truncate">{copy.topbar.commandPlaceholder}</span>
              <Kbd>⌘K</Kbd>
            </button>
          </header>
        )}
        <main id="main" className="bg-surface min-h-0 flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} query={query} onQueryChange={setQuery} />
    </div>
  );
}
