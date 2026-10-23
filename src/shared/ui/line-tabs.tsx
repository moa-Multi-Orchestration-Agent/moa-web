'use client';

import { cn } from '@/shared/lib/utils';
import { Tabs, TabsList, TabsTrigger } from './tabs';

/** Figma 밑줄 탭(왼쪽 정렬). value는 보통 searchParams의 tab. */
export function LineTabs<T extends string>({
  value,
  onChange,
  items,
  className,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  items: { value: T; label: React.ReactNode }[];
  className?: string;
  label?: string;
}) {
  return (
    <Tabs value={value} onValueChange={(v) => onChange(v as T)} className={className}>
      <TabsList variant="line" aria-label={label} className="h-11 w-full justify-start gap-6 border-b px-0">
        {items.map((it) => (
          <TabsTrigger key={it.value} value={it.value} className={cn('h-10 flex-none px-0.5 text-[15px] data-[state=active]:font-bold')}>
            {it.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
