'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { TEMPLATE_CATEGORIES, useTemplates } from '@/entities/template';
import { useSearchState } from '@/shared/hooks/use-search-state';
import { copy } from '@/shared/lib/copy';
import { Button } from '@/shared/ui/button';
import { ChipGroup } from '@/shared/ui/chips';
import { Input } from '@/shared/ui/input';
import { LineTabs } from '@/shared/ui/line-tabs';
import { PageContainer, PageHeader } from '@/shared/ui/page-header';
import { CardGridSkeleton, EmptyState, ErrorState } from '@/shared/ui/states';
import { TemplateCard } from './template-card';
import { TemplateSheet } from './template-sheet';

export function TemplatesView() {
  const [s, set] = useSearchState({ kind: 'all', category: 'all', q: '', preview: '' });
  const [focusStart, setFocusStart] = useState(false);
  const q = useTemplates({ kind: s.kind === 'all' ? undefined : (s.kind as 'agent' | 'workflow'), category: s.category === 'all' ? undefined : s.category });
  const items = useMemo(() => {
    const needle = s.q.trim().toLowerCase();
    return (q.data ?? []).filter((t) => !needle || `${t.name} ${t.summary} ${t.skills.join(' ')}`.toLowerCase().includes(needle));
  }, [q.data, s.q]);

  return (
    <PageContainer className="max-w-[1280px]">
      <PageHeader
        title={copy.templates.title}
        description={copy.templates.subtitle}
        actions={
          <Link href="/market" className="text-primary text-sm font-semibold hover:underline">
            {copy.templates.toMarket}
          </Link>
        }
      />
      <LineTabs label="종류" value={s.kind} onChange={(v) => set({ kind: v })} items={Object.entries(copy.templates.kinds).map(([value, label]) => ({ value, label }))} />
      <div className="flex flex-wrap items-center gap-3">
        <ChipGroup
          label="카테고리"
          value={s.category}
          onChange={(v) => set({ category: v })}
          options={[{ value: 'all', label: copy.common.all }, ...TEMPLATE_CATEGORIES.map((c) => ({ value: c.id as string, label: c.label }))]}
        />
        <div className="relative ml-auto">
          <Search className="text-muted pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" aria-hidden />
          <Input value={s.q} onChange={(e) => set({ q: e.target.value })} placeholder={copy.templates.search} aria-label={copy.templates.search} className="h-9 w-64 pl-8" />
        </div>
      </div>
      {q.isPending ? (
        <CardGridSkeleton count={8} className="xl:grid-cols-4" />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          title={copy.templates.empty}
          description={copy.templates.emptyBody}
          action={
            <Button variant="outline" onClick={() => set({ category: 'all', q: '', kind: 'all' })}>
              {copy.studio.clearFilters}
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {items.map((t) => (
            <TemplateCard
              key={t.id}
              t={t}
              onPreview={() => {
                setFocusStart(false);
                set({ preview: t.id });
              }}
              onUse={() => {
                setFocusStart(true);
                set({ preview: t.id });
              }}
            />
          ))}
        </div>
      )}
      <TemplateSheet id={s.preview || null} focusStart={focusStart} onOpenChange={(o) => !o && set({ preview: '' })} />
    </PageContainer>
  );
}
