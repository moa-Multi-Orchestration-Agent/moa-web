'use client';

import { useRouter } from 'next/navigation';
import { Keyboard, LogOut, Monitor, Moon, Settings, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';
import { useLogout, useMe } from '@/entities/user';
import { useCurrentWorkspace } from '@/entities/workspace';
import { copy } from '@/shared/lib/copy';
import { cn } from '@/shared/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu';

export function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span aria-hidden className={cn('bg-surface-strong text-foreground/80 flex size-9 shrink-0 items-center justify-center rounded-full border text-sm font-semibold', className)}>
      {name.slice(0, 1)}
    </span>
  );
}

export function UserMenu({ onShortcuts, variant = 'avatar' }: { onShortcuts: () => void; variant?: 'avatar' | 'card' }) {
  const me = useMe();
  const { workspace, role } = useCurrentWorkspace();
  const logout = useLogout();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const name = me.data?.displayName ?? '';

  const doLogout = () =>
    logout.mutate(undefined, {
      onSuccess: () => {
        toast.success(copy.auth.loggedOut);
        router.replace('/login');
      },
    });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {variant === 'avatar' ? (
          <button type="button" aria-label={copy.topbar.userMenu} className="rounded-full focus-visible:outline-2">
            <Avatar name={name} />
          </button>
        ) : (
          <button type="button" aria-label={copy.topbar.userMenu} className="hover:bg-surface flex w-full items-center gap-2.5 rounded-md p-2 text-left">
            <Avatar name={name} />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">{name}</span>
              <span className="text-muted block truncate text-xs">
                {workspace?.name} · {role ? copy.roles[role] : ''}
              </span>
            </span>
          </button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>
          <span className="block">{name}</span>
          <span className="text-muted block text-xs font-normal">{me.data?.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-muted text-xs font-normal">{copy.topbar.theme}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme ?? 'system'} onValueChange={setTheme}>
          <DropdownMenuRadioItem value="light">
            <Sun aria-hidden /> {copy.topbar.themeLight}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <Moon aria-hidden /> {copy.topbar.themeDark}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">
            <Monitor aria-hidden /> {copy.topbar.themeSystem}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => router.push('/settings?tab=general')}>
          <Settings aria-hidden /> {copy.topbar.profile}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onShortcuts}>
          <Keyboard aria-hidden /> {copy.topbar.shortcuts}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={doLogout}>
          <LogOut aria-hidden /> {copy.topbar.logout}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
