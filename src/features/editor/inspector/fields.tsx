'use client';

import { useId } from 'react';
import { cn } from '@/shared/lib/utils';
import { Checkbox } from '@/shared/ui/checkbox';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Slider } from '@/shared/ui/slider';
import { Textarea } from '@/shared/ui/textarea';

export function Section({ title, children, className }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('space-y-3 border-t px-4 py-4 first:border-t-0', className)}>
      {title ? <h3 className="text-sm font-semibold">{title}</h3> : null}
      {children}
    </section>
  );
}

export function TextField({ label, value, onChange, placeholder, mono, disabled, type = 'text', hint }: { label: string; value: string | number; onChange: (v: string) => void; placeholder?: string; mono?: boolean; disabled?: boolean; type?: string; hint?: string }) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-muted text-xs">
        {label}
      </Label>
      <Input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} disabled={disabled} className={cn('h-9', mono && 'font-mono text-xs')} />
      {hint ? <p className="text-muted text-[11px]">{hint}</p> : null}
    </div>
  );
}

export function AreaField({ label, value, onChange, mono, rows = 5, disabled, placeholder }: { label: string; value: string; onChange: (v: string) => void; mono?: boolean; rows?: number; disabled?: boolean; placeholder?: string }) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-muted text-xs">
        {label}
      </Label>
      <Textarea id={id} value={value} onChange={(e) => onChange(e.target.value)} rows={rows} disabled={disabled} placeholder={placeholder} className={cn('text-sm', mono && 'font-mono text-xs')} />
    </div>
  );
}

export function SelectField({ label, value, onChange, options, disabled, placeholder }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; disabled?: boolean; placeholder?: string }) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-muted text-xs">
        {label}
      </Label>
      <Select value={value || undefined} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger id={id} className="h-9 w-full">
          <SelectValue placeholder={placeholder ?? '선택'} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function SliderField({ label, value, onChange, min = 0, max = 100, step = 1, disabled }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; disabled?: boolean }) {
  const id = useId();
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs">
        <Label id={id} className="text-muted text-xs">
          {label}
        </Label>
        <span className="font-mono tabular-nums">{value}</span>
      </div>
      <Slider aria-labelledby={id} min={min} max={max} step={step} value={[value]} onValueChange={([v]) => onChange(v ?? min)} disabled={disabled} />
    </div>
  );
}

export function CheckField({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <Checkbox checked={checked} onCheckedChange={(v) => onChange(v === true)} disabled={disabled} />
      {label}
    </label>
  );
}
