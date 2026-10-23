'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import type { Block, NodeCatalog } from '@/entities/workflow';
import { Input } from '@/shared/ui/input';
import { nodeColor } from '@/shared/ui/node-colors';
import { ErrorState, ListSkeleton } from '@/shared/ui/states';
import { blockIcon } from './icons';

export const DND_MIME = 'application/moa-block';

/** 왼쪽 노드 팔레트: 8그룹 47블록, 검색, 드래그(또는 Enter)로 추가 */
export function NodePalette({
  catalog,
  loading,
  error,
  onRetry,
  onAdd,
  disabled,
}: {
  catalog: NodeCatalog | undefined;
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  onAdd: (b: Block) => void;
  disabled?: boolean;
}) {
  const [q, setQ] = useState('');
  const groups = useMemo(() => {
    if (!catalog) return [];
    const needle = q.trim().toLowerCase();
    return catalog.groups
      .map((g) => ({ ...g, blocks: catalog.blocks.filter((b) => b.group === g.id && (!needle || `${b.label} ${b.description}`.toLowerCase().includes(needle))) }))
      .filter((g) => g.blocks.length);
  }, [catalog, q]);

  return (
    <aside className="bg-background flex w-[220px] shrink-0 flex-col border-r" aria-label="노드 추가">
      <div className="space-y-2 p-3">
        <h2 className="text-sm font-bold">노드 추가</h2>
        <div className="relative">
          <Search className="text-muted pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="노드 검색" aria-label="노드 검색" className="bg-surface h-8 pl-7 text-sm" />
        </div>
        <p className="text-muted text-[11px]">끌어다 놓거나, 고른 뒤 Enter로 가운데에 추가</p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        {loading ? (
          <ListSkeleton rows={8} />
        ) : error ? (
          <ErrorState compact error={error} onRetry={onRetry} />
        ) : groups.length === 0 ? (
          <p className="text-muted py-6 text-center text-sm">찾는 노드가 없어요.</p>
        ) : (
          groups.map((g) => (
            <section key={g.id} className="mt-3 first:mt-0">
              <h3 className="text-muted mb-1.5 text-xs font-semibold">
                {g.label} <span className="font-normal">({g.blocks.length})</span>
              </h3>
              <ul className="space-y-1">
                {g.blocks.map((b) => {
                  const Icon = blockIcon(b.icon);
                  const c = nodeColor(b.type);
                  return (
                    <li key={b.id}>
                      <button
                        type="button"
                        draggable={!disabled}
                        disabled={disabled}
                        onDragStart={(e) => {
                          e.dataTransfer.setData(DND_MIME, b.id);
                          e.dataTransfer.effectAllowed = 'move';
                        }}
                        onClick={() => onAdd(b)}
                        title={b.description}
                        aria-label={`${b.label} 노드 추가 — ${b.description}`}
                        className="hover:border-primary/50 hover:bg-surface flex w-full cursor-grab items-center gap-2 rounded-md border px-2.5 py-1.5 text-left text-[13px] active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-50"
                        data-block={b.id}
                      >
                        <Icon className="size-3.5 shrink-0" style={{ color: c.accent }} aria-hidden />
                        <span className="truncate">{b.label}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        )}
      </div>
    </aside>
  );
}
