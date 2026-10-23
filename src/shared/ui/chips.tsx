'use client';

import { cn } from '@/shared/lib/utils';

/** 단일 선택 칩(Figma 필터 칩: 선택 시 검정 채움) */
export function ChipGroup<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: React.ReactNode }[];
  label: string;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn('flex flex-wrap gap-2', className)}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={cn(
              'h-8 rounded-full border px-3.5 text-sm font-medium transition-colors',
              on ? 'bg-foreground text-background border-foreground' : 'bg-background hover:bg-surface',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
