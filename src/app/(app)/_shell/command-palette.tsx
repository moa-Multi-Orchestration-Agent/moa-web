'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/shared/ui/command';
import { ALL_NAV } from './nav';

export interface PaletteExtraGroup {
  heading: string;
  items: { id: string; label: string; hint?: string; onSelect: () => void; keywords?: string[] }[];
}

/** ⌘K 커맨드 팔레트. 화면 이동 + (2단계 이후) 검색·새로 만들기·슬래시 명령 */
export function CommandPalette({
  open,
  onOpenChange,
  query,
  onQueryChange,
  extraGroups = [],
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  query: string;
  onQueryChange: (q: string) => void;
  extraGroups?: PaletteExtraGroup[];
}) {
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);

  const go = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} title="커맨드 팔레트" description="화면 이동, 검색, 명령 실행">
      <CommandInput placeholder="이동할 화면, 에이전트·워크플로 이름, /명령 …" value={query} onValueChange={onQueryChange} />
      <CommandList>
        <CommandEmpty>결과가 없습니다.</CommandEmpty>
        {extraGroups.map((g) =>
          g.items.length ? (
            <CommandGroup key={g.heading} heading={g.heading}>
              {g.items.map((it) => (
                <CommandItem
                  key={it.id}
                  value={`${it.label} ${it.keywords?.join(' ') ?? ''} ${it.id}`}
                  onSelect={() => {
                    onOpenChange(false);
                    it.onSelect();
                  }}
                >
                  <span className="flex-1 truncate">{it.label}</span>
                  {it.hint ? <span className="text-muted text-xs">{it.hint}</span> : null}
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null,
        )}
        <CommandGroup heading="화면 이동">
          {ALL_NAV.map((n) => {
            const Icon = n.icon;
            return (
              <CommandItem key={n.href} value={`이동 ${n.label} ${n.href}`} onSelect={() => go(n.href)}>
                <Icon aria-hidden /> {n.label}
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
