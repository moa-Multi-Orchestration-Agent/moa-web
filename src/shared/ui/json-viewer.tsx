'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { CopyButton } from './copy-button';

function Node({ k, v, depth }: { k?: string; v: unknown; depth: number }) {
  const [open, setOpen] = useState(depth < 2);
  const isObj = v !== null && typeof v === 'object';
  const label = k !== undefined ? <span className="text-primary">{k}: </span> : null;
  if (!isObj) {
    const cls = typeof v === 'string' ? 'text-success' : typeof v === 'number' ? 'text-warning' : 'text-muted';
    return (
      <div className="break-all" style={{ paddingLeft: depth * 14 }}>
        {label}
        <span className={cls}>{typeof v === 'string' ? `"${v}"` : String(v)}</span>
      </div>
    );
  }
  const entries = Array.isArray(v) ? v.map((x, i) => [String(i), x] as const) : Object.entries(v as Record<string, unknown>);
  return (
    <div>
      <button type="button" onClick={() => setOpen((o) => !o)} className="hover:bg-surface flex items-center rounded text-left" style={{ paddingLeft: depth * 14 }} aria-expanded={open}>
        {open ? <ChevronDown className="size-3" aria-hidden /> : <ChevronRight className="size-3" aria-hidden />}
        {label}
        <span className="text-muted">{Array.isArray(v) ? `[${entries.length}]` : `{${entries.length}}`}</span>
      </button>
      {open ? entries.map(([ck, cv]) => <Node key={ck} k={ck} v={cv} depth={depth + 1} />) : null}
    </div>
  );
}

/** 접을 수 있는 JSON 트리 + 복사 버튼 */
export function JsonViewer({ value, className, label = 'JSON' }: { value: unknown; className?: string; label?: string }) {
  const text = JSON.stringify(value ?? null, null, 2);
  return (
    <div className={cn('bg-surface relative rounded-md border', className)}>
      <div className="absolute top-1.5 right-1.5">
        <CopyButton value={text} iconOnly label={`${label} 복사`} variant="ghost" />
      </div>
      <div className="max-h-80 overflow-auto p-3 pr-10 font-mono text-xs leading-5" aria-label={label}>
        {value === null || value === undefined ? <span className="text-muted">null</span> : <Node v={value} depth={0} />}
      </div>
    </div>
  );
}
