'use client';

import { ChevronDown } from 'lucide-react';
import { AGENT_ICONS, MODELS, modelLabel, type AgentForm } from '@/entities/agent';
import { copy } from '@/shared/lib/copy';
import { estimateTokens } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Checkbox } from '@/shared/ui/checkbox';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Slider } from '@/shared/ui/slider';
import { Switch } from '@/shared/ui/switch';
import { Textarea } from '@/shared/ui/textarea';

export function Card({ title, actions, children, className }: { title: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('bg-card rounded-lg border p-5', className)}>
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-subtitle font-bold">{title}</h2>
        {actions}
      </div>
      {children}
    </section>
  );
}

interface Props {
  form: AgentForm;
  setForm: (p: Partial<AgentForm>) => void;
  disabled?: boolean;
  errors?: Partial<Record<keyof AgentForm, string>>;
}

export function BasicCard({ form, setForm, disabled, errors }: Props) {
  return (
    <Card title={copy.builder.basic}>
      <div className="flex gap-3">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="size-14 text-2xl" aria-label={`${copy.builder.icon}: ${form.icon}`} disabled={disabled}>
              {form.icon}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="grid w-56 grid-cols-5 gap-1 p-2">
            {AGENT_ICONS.map((i) => (
              <button key={i} type="button" onClick={() => setForm({ icon: i })} className={cn('hover:bg-surface rounded-md p-1.5 text-xl', form.icon === i && 'bg-primary-soft')} aria-label={`아이콘 ${i}`}>
                {i}
              </button>
            ))}
          </PopoverContent>
        </Popover>
        <div className="min-w-0 flex-1 space-y-1.5">
          <Label htmlFor="agent-name">{copy.builder.name}</Label>
          <Input id="agent-name" value={form.name} onChange={(e) => setForm({ name: e.target.value })} maxLength={60} disabled={disabled} aria-invalid={!!errors?.name} aria-describedby={errors?.name ? 'agent-name-err' : undefined} />
          {errors?.name ? (
            <p id="agent-name-err" className="text-danger text-xs">
              {errors.name}
            </p>
          ) : null}
        </div>
      </div>
      <div className="mt-3 space-y-1.5">
        <Label htmlFor="agent-desc">{copy.builder.description}</Label>
        <Input id="agent-desc" value={form.description ?? ''} onChange={(e) => setForm({ description: e.target.value || null })} maxLength={200} disabled={disabled} />
      </div>
    </Card>
  );
}

export function ModelCard({ form, setForm, disabled }: Props) {
  const toggleFallback = (id: string) =>
    setForm({ fallback_models: form.fallback_models.includes(id) ? form.fallback_models.filter((x) => x !== id) : [...form.fallback_models, id] });
  return (
    <Card title={copy.builder.model} actions={<span className="text-muted text-sm">{copy.builder.params(form.temperature)}</span>}>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="agent-model">{copy.builder.baseModel}</Label>
          <Select value={form.model} onValueChange={(v) => setForm({ model: v, fallback_models: form.fallback_models.filter((x) => x !== v) })} disabled={disabled}>
            <SelectTrigger id="agent-model" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MODELS.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label id="fallback-label">{copy.builder.fallback}</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-between font-normal" aria-labelledby="fallback-label" disabled={disabled}>
                <span className="truncate">{form.fallback_models.length ? form.fallback_models.map(modelLabel).join(', ') : copy.builder.fallbackNone}</span>
                <ChevronDown className="opacity-60" aria-hidden />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-2" align="start">
              <p className="text-muted px-2 pb-1 text-xs">순서대로 시도합니다(design.md 2.2.3).</p>
              {MODELS.filter((m) => m.id !== form.model).map((m) => (
                <label key={m.id} className="hover:bg-surface flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm">
                  <Checkbox checked={form.fallback_models.includes(m.id)} onCheckedChange={() => toggleFallback(m.id)} />
                  <span className="flex-1">{m.label}</span>
                  {form.fallback_models.includes(m.id) ? <Badge variant="gray">{form.fallback_models.indexOf(m.id) + 1}순위</Badge> : null}
                </label>
              ))}
            </PopoverContent>
          </Popover>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label id="temp-label">{copy.builder.temperature}</Label>
            <span className="font-mono text-sm tabular-nums">{form.temperature.toFixed(1)}</span>
          </div>
          <Slider aria-labelledby="temp-label" min={0} max={2} step={0.1} value={[form.temperature]} onValueChange={([v]) => setForm({ temperature: Number((v ?? 0).toFixed(1)) })} disabled={disabled} />
          <p className="text-muted text-xs">{copy.builder.temperatureHint}</p>
        </div>
      </div>
    </Card>
  );
}

export function PromptCard({ form, setForm, disabled }: Props) {
  const tokens = estimateTokens(form.system_prompt);
  return (
    <Card title={copy.builder.prompt} actions={<Badge variant="blue">{copy.builder.promptBadge}</Badge>}>
      <Label htmlFor="agent-prompt" className="sr-only">
        {copy.builder.prompt}
      </Label>
      <Textarea id="agent-prompt" value={form.system_prompt} onChange={(e) => setForm({ system_prompt: e.target.value })} placeholder={copy.builder.promptPlaceholder} className="min-h-[140px] text-sm leading-6" disabled={disabled} aria-describedby="agent-prompt-count" />
      <p id="agent-prompt-count" className="text-muted mt-1.5 text-right text-xs tabular-nums">
        {copy.builder.promptCount(form.system_prompt.length, tokens)}
      </p>
    </Card>
  );
}

export function MemoryCard({ form, setForm, disabled, threshold }: Props & { threshold: number }) {
  const toggle = (k: string) => setForm({ memory_scopes: form.memory_scopes.includes(k) ? form.memory_scopes.filter((x) => x !== k) : [...form.memory_scopes, k] });
  return (
    <Card
      title={copy.builder.memory}
      actions={
        <div className="flex items-center gap-2">
          <Label htmlFor="memory-on" className="text-sm font-normal">
            {copy.builder.memoryEnabled}
          </Label>
          <Switch id="memory-on" checked={form.memory_enabled} onCheckedChange={(v) => setForm({ memory_enabled: v })} disabled={disabled} />
        </div>
      }
    >
      <fieldset className="space-y-2.5" disabled={disabled || !form.memory_enabled}>
        <legend className="sr-only">기억 범위</legend>
        {Object.entries(copy.builder.memoryScopes).map(([k, label]) => (
          <label key={k} className={cn('flex items-center gap-2 text-sm', !form.memory_enabled && 'opacity-50')}>
            <Checkbox checked={form.memory_enabled && form.memory_scopes.includes(k)} onCheckedChange={() => toggle(k)} disabled={disabled || !form.memory_enabled} />
            {label}
          </label>
        ))}
      </fieldset>
      <div className="bg-surface mt-4 rounded-md p-3 text-sm">
        <p className="font-medium">{copy.builder.threshold(Math.round(threshold * 100))}</p>
        <p className="text-muted mt-0.5 text-xs">{copy.builder.thresholdHint}</p>
      </div>
    </Card>
  );
}
