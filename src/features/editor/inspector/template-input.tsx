'use client';

import { useId, useMemo, useRef, useState } from 'react';
import { cn } from '@/shared/lib/utils';
import { Label } from '@/shared/ui/label';
import { Textarea } from '@/shared/ui/textarea';

export interface BindingOption {
  value: string; // nodeId.output.port
  label: string;
  type: string;
}

/**
 * 프롬프트 템플릿 입력. "{{"를 치면 앞 노드 출력 목록을 보여 주고 고르면 {{노드.output.필드}}를 넣는다.
 * ↑↓로 고르고 Enter/Tab으로 넣는다. Esc로 닫는다.
 */
export function TemplateInput({ label, value, onChange, options, disabled, rows = 6 }: { label: string; value: string; onChange: (v: string) => void; options: BindingOption[]; disabled?: boolean; rows?: number }) {
  const id = useId();
  const ref = useRef<HTMLTextAreaElement>(null);
  const [query, setQuery] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const filtered = useMemo(() => (query === null ? [] : options.filter((o) => o.value.toLowerCase().includes(query.toLowerCase())).slice(0, 8)), [options, query]);

  const detect = (text: string, caret: number) => {
    const before = text.slice(0, caret);
    const m = /\{\{\s*([\w.-]*)$/.exec(before);
    setQuery(m ? m[1]! : null);
    setActive(0);
  };

  const insert = (opt: BindingOption) => {
    const el = ref.current;
    if (!el) return;
    const caret = el.selectionStart;
    const before = value.slice(0, caret).replace(/\{\{\s*[\w.-]*$/, '');
    const after = value.slice(caret).replace(/^[\w.-]*\s*\}\}/, '');
    const token = `{{${opt.value}}}`;
    onChange(before + token + after);
    setQuery(null);
    requestAnimationFrame(() => {
      el.focus();
      const pos = before.length + token.length;
      el.setSelectionRange(pos, pos);
    });
  };

  return (
    <div className="relative space-y-1.5">
      <Label htmlFor={id} className="text-muted text-xs">
        {label} <span className="font-normal">({'{{'} 입력하면 앞 노드 출력 자동완성)</span>
      </Label>
      <Textarea
        id={id}
        ref={ref}
        value={value}
        rows={rows}
        disabled={disabled}
        className="font-mono text-xs leading-5"
        onChange={(e) => {
          onChange(e.target.value);
          detect(e.target.value, e.target.selectionStart);
        }}
        onKeyDown={(e) => {
          if (query === null || filtered.length === 0) return;
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive((a) => (a + 1) % filtered.length);
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((a) => (a - 1 + filtered.length) % filtered.length);
          } else if (e.key === 'Enter' || e.key === 'Tab') {
            e.preventDefault();
            insert(filtered[active]!);
          } else if (e.key === 'Escape') {
            setQuery(null);
          }
        }}
        onBlur={() => setTimeout(() => setQuery(null), 150)}
        role="combobox"
        aria-expanded={query !== null && filtered.length > 0}
        aria-controls={`${id}-list`}
        aria-autocomplete="list"
      />
      {query !== null && filtered.length > 0 ? (
        <ul id={`${id}-list`} role="listbox" className="bg-popover absolute right-0 left-0 z-50 mt-1 max-h-52 overflow-auto rounded-md border p-1 shadow-md">
          {filtered.map((o, i) => (
            <li
              key={o.value}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                insert(o);
              }}
              className={cn('flex cursor-pointer items-center justify-between rounded px-2 py-1 font-mono text-xs', i === active && 'bg-primary-soft text-primary')}
            >
              <span>{`{{${o.value}}}`}</span>
              <span className="text-muted">{o.type}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
