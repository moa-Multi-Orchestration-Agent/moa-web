'use client';

import { useId, useState } from 'react';
import { ChevronDown, RotateCcw } from 'lucide-react';
import { copy } from '@/shared/lib/copy';
import { cn } from '@/shared/lib/utils';
import { Button } from './button';
import { Checkbox } from './checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './collapsible';
import { Input } from './input';
import { Label } from './label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';

/** 백엔드 GenOptions와 같은 키. 비운 값은 보내지 않는다(모델 기본값). */
export type ParamsValue = Record<string, unknown>;

const t = copy.modelParams;

const encodeStop = (v: unknown) => (Array.isArray(v) ? v.map((x) => String(x).replace(/\n/g, '\\n')).join(', ') : '');
const decodeStop = (s: string) =>
  s
    .split(',')
    .map((x) => x.trim().replace(/\\n/g, '\n'))
    .filter(Boolean)
    .slice(0, 4);

function clean(v: ParamsValue): ParamsValue {
  return Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined && x !== null && x !== '' && !(Array.isArray(x) && !x.length)));
}

function NumField({ label, value, onChange, min, max, step, placeholder, disabled }: { label: string; value: unknown; onChange: (v: number | undefined) => void; min: number; max: number; step?: number; placeholder?: string; disabled?: boolean }) {
  const id = useId();
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-muted text-[11px]">{label}</Label>
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={step}
        value={typeof value === 'number' ? value : ''}
        placeholder={placeholder}
        disabled={disabled}
        className="h-8 font-mono text-xs"
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === '') return onChange(undefined);
          const n = Number(raw);
          if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
        }}
      />
    </div>
  );
}

/** 최대 토큰·top_p·중단 문자열·JSON 응답·penalty·seed. 접어 두고 설정한 개수만 보여 준다. */
export function ModelParamsFields({ value, onChange, disabled, defaultOpen }: { value: ParamsValue | undefined; onChange: (v: ParamsValue) => void; disabled?: boolean; defaultOpen?: boolean }) {
  const v = value ?? {};
  const set = (patch: ParamsValue) => onChange(clean({ ...v, ...patch }));
  const count = Object.keys(clean(v)).length;
  const [stopText, setStopText] = useState(() => encodeStop(v.stop));
  const jsonId = useId();
  return (
    <Collapsible defaultOpen={defaultOpen} className="rounded-md border">
      <CollapsibleTrigger className="group flex w-full items-center justify-between px-3 py-2 text-left text-xs font-medium">
        <span>{t.title}</span>
        <span className="text-muted flex items-center gap-1 font-normal">
          {t.summary(count)}
          <ChevronDown className="size-3.5 transition-transform group-data-[state=open]:rotate-180" aria-hidden />
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-3 border-t px-3 py-3" data-testid="model-params">
        <div className="grid grid-cols-2 gap-2">
          <NumField label={t.maxTokens} value={v.max_tokens} onChange={(n) => set({ max_tokens: n === undefined ? undefined : Math.round(n) })} min={1} max={128000} placeholder={t.maxTokensHint} disabled={disabled} />
          <NumField label={t.topP} value={v.top_p} onChange={(n) => set({ top_p: n })} min={0} max={1} step={0.05} disabled={disabled} />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${jsonId}-stop`} className="text-muted text-[11px]">{t.stop}</Label>
          <Input
            id={`${jsonId}-stop`}
            value={stopText}
            disabled={disabled}
            className="h-8 font-mono text-xs"
            placeholder="###, \n\n"
            onChange={(e) => setStopText(e.target.value)}
            onBlur={() => set({ stop: decodeStop(stopText) })}
          />
          <p className="text-muted text-[11px]">{t.stopHint}</p>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id={jsonId} checked={v.response_format === 'json'} onCheckedChange={(c) => set({ response_format: c === true ? 'json' : undefined })} disabled={disabled} />
          <Label htmlFor={jsonId} className="text-xs font-normal">{t.json}</Label>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <NumField label={t.presence} value={v.presence_penalty} onChange={(n) => set({ presence_penalty: n })} min={-2} max={2} step={0.1} disabled={disabled} />
          <NumField label={t.frequency} value={v.frequency_penalty} onChange={(n) => set({ frequency_penalty: n })} min={-2} max={2} step={0.1} disabled={disabled} />
          <NumField label={t.seed} value={v.seed} onChange={(n) => set({ seed: n === undefined ? undefined : Math.round(n) })} min={0} max={2147483647} disabled={disabled} />
        </div>
        <div className="flex items-center justify-between">
          <p className="text-muted text-[11px]">{t.openaiOnly}</p>
          {count ? (
            <Button type="button" size="xs" variant="ghost" onClick={() => { setStopText(''); onChange({}); }} disabled={disabled}>
              <RotateCcw aria-hidden /> {t.reset}
            </Button>
          ) : null}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export const CUSTOM_FAMILY_OPTIONS = [
  { value: 'openai_compatible', label: '외부 AI (OpenAI 호환 라우터)' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'google', label: 'Google Gemini' },
  { value: 'ollama', label: 'Ollama' },
] as const;
const CUSTOM = '__custom__';

function parseCustom(value: string): { family: string; model: string } | null {
  const i = value.indexOf(':');
  if (i <= 0) return null;
  const family = value.slice(0, i);
  return CUSTOM_FAMILY_OPTIONS.some((o) => o.value === family) ? { family, model: value.slice(i + 1) } : null;
}

/** 목록 모델 고르기 + "직접 입력…"(계열 + 모델 id → `계열:모델id`). */
export function ModelPicker({ label, value, onChange, presets, disabled, className }: { label: string; value: string; onChange: (v: string) => void; presets: readonly { value: string; label: string }[]; disabled?: boolean; className?: string }) {
  const id = useId();
  const isPreset = presets.some((p) => p.value === value);
  const parsed = parseCustom(value);
  const [custom, setCustom] = useState(!isPreset);
  const [family, setFamily] = useState(parsed?.family ?? 'openai_compatible');
  const [model, setModel] = useState(parsed?.model ?? (isPreset ? '' : value));
  const showCustom = custom || !isPreset;
  const emit = (f: string, m: string) => {
    const trimmed = m.trim();
    if (trimmed) onChange(`${f}:${trimmed}`);
  };
  return (
    <div className={cn('space-y-2', className)}>
      <div className="space-y-1.5">
        <Label htmlFor={id} className="text-muted text-xs">{label}</Label>
        <Select
          value={showCustom ? CUSTOM : value}
          onValueChange={(v) => {
            if (v === CUSTOM) return setCustom(true);
            setCustom(false);
            onChange(v);
          }}
          disabled={disabled}
        >
          <SelectTrigger id={id} className="h-9 w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            {presets.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
            <SelectItem value={CUSTOM}>{t.customModel}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {showCustom ? (
        <div className="bg-surface space-y-2 rounded-md p-2.5" data-testid="custom-model">
          <div className="space-y-1">
            <Label htmlFor={`${id}-fam`} className="text-muted text-[11px]">{t.customFamily}</Label>
            <Select value={family} onValueChange={(f) => { setFamily(f); emit(f, model); }} disabled={disabled}>
              <SelectTrigger id={`${id}-fam`} className="h-8 w-full text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>{CUSTOM_FAMILY_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${id}-id`} className="text-muted text-[11px]">{t.customId}</Label>
            <Input id={`${id}-id`} value={model} onChange={(e) => setModel(e.target.value)} onBlur={() => emit(family, model)} placeholder="gpt-4.1" className="h-8 font-mono text-xs" disabled={disabled} maxLength={180} />
            <p className="text-muted text-[11px]">{t.customIdHint}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
