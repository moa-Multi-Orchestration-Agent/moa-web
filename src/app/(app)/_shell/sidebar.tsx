'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Plus } from 'lucide-react';
import { copy } from '@/shared/lib/copy';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip';
import { NAV_GROUPS, SETTINGS_ITEM, isActive, type NavItem } from './nav';

export function Sidebar({ compact, userCard }: { compact: boolean; userCard?: React.ReactNode }) {
  const pathname = usePathname() ?? '';
  if (compact) return <CompactSidebar pathname={pathname} />;
  return (
    <aside className="bg-background flex w-[232px] shrink-0 flex-col border-r px-3.5 py-4" aria-label="주 메뉴">
      <Link href="/home" className="px-2 py-1">
        <div className="text-[22px] leading-7 font-extrabold tracking-tight">{copy.app.name}</div>
        <div className="text-muted text-xs">{copy.app.tagline}</div>
      </Link>
      <Button asChild className="mt-3 w-full">
        <Link href="/studio/new">
          <Plus aria-hidden /> {copy.app.newButton}
        </Link>
      </Button>
      <nav className="mt-2 flex flex-1 flex-col overflow-y-auto">
        {NAV_GROUPS.map((g) => (
          <div key={g.label} className="mt-3">
            <div className="text-muted px-2.5 pb-1.5 text-xs font-medium">{g.label}</div>
            <ul className="space-y-0.5">
              {g.items.map((item) => (
                <li key={item.href}>
                  <SideLink item={item} active={isActive(item, pathname)} />
                </li>
              ))}
            </ul>
          </div>
        ))}
        <div className="flex-1" />
        <SideLink item={SETTINGS_ITEM} active={isActive(SETTINGS_ITEM, pathname)} />
      </nav>
      {userCard ? <div className="mt-2 border-t pt-2">{userCard}</div> : null}
    </aside>
  );
}

function SideLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex h-[38px] items-center gap-2.5 rounded-md px-2.5 text-[15px] transition-colors',
        active ? 'bg-primary-soft text-primary font-semibold' : 'hover:bg-surface',
      )}
    >
      <Icon className="size-4 opacity-80" aria-hidden />
      {item.label}
    </Link>
  );
}

function CompactSidebar({ pathname }: { pathname: string }) {
  const items = [...NAV_GROUPS.flatMap((g) => g.items)];
  return (
    <aside className="bg-background flex w-[72px] shrink-0 flex-col items-center border-r py-3" aria-label="주 메뉴">
      <Link href="/home" className="text-base font-extrabold">
        {copy.app.name}
      </Link>
      <Button asChild size="icon-lg" className="mt-2">
        <Link href="/studio/new" aria-label={copy.app.newButton}>
          <Plus aria-hidden />
        </Link>
      </Button>
      <nav className="mt-3 flex w-full flex-1 flex-col items-center gap-1">
        {items.map((item) => (
          <CompactLink key={item.href} item={item} active={isActive(item, pathname)} />
        ))}
        <div className="flex-1" />
        <CompactLink item={SETTINGS_ITEM} active={isActive(SETTINGS_ITEM, pathname)} />
      </nav>
    </aside>
  );
}

function CompactLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href={item.href}
          aria-current={active ? 'page' : undefined}
          className={cn(
            'flex w-14 flex-col items-center gap-0.5 rounded-md py-1.5 text-[11px]',
            active ? 'bg-primary-soft text-primary font-semibold' : 'text-muted hover:bg-surface',
          )}
        >
          <Icon className="size-4" aria-hidden />
          {item.short}
        </Link>
      </TooltipTrigger>
      <TooltipContent side="right">{item.label}</TooltipContent>
    </Tooltip>
  );
}
