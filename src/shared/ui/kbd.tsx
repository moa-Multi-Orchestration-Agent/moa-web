import { cn } from '@/shared/lib/utils';

export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd className={cn('bg-surface text-muted rounded border px-1.5 py-0.5 font-mono text-[11px]', className)}>
      {children}
    </kbd>
  );
}
