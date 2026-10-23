'use client';

import { categoryLabel, DIFFICULTY_LABEL, type Template } from '@/entities/template';
import { modelLabel } from '@/entities/agent';
import { TRIGGER_LABEL } from '@/entities/workflow';
import { copy } from '@/shared/lib/copy';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';

function Thumb({ t }: { t: Template }) {
  return (
    <div className="bg-surface-strong/60 flex h-[92px] items-center justify-center gap-3 border-b" aria-hidden>
      {t.kind === 'agent' ? (
        <>
          <span className="border-primary bg-primary-soft text-primary rounded-md border px-3 py-2 text-xs font-semibold">모델</span>
          <span className="space-y-1">
            {[0, 1, 2].map((i) => (
              <span key={i} className="bg-background block h-1.5 w-14 rounded border" />
            ))}
          </span>
        </>
      ) : (
        Array.from({ length: Math.min(5, t.nodeCount) }).map((_, i) => (
          <span key={i} className="flex items-center">
            {i > 0 ? <span className="bg-border -ml-3 h-px w-3" /> : null}
            <span className="bg-background h-4 w-6 rounded border" />
          </span>
        ))
      )}
      <span className="absolute top-2 left-2 text-lg">{t.icon}</span>
    </div>
  );
}

export function TemplateCard({ t, onPreview, onUse }: { t: Template; onPreview: () => void; onUse: () => void }) {
  const requires = t.requiredConnections.map((r) => r.label.replace(' (MCP)', '')).join(', ');
  return (
    <article className="bg-card relative flex flex-col overflow-hidden rounded-lg border" aria-label={t.name}>
      <Thumb t={t} />
      <div className="flex flex-1 flex-col p-4">
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="dark">{copy.templates.official}</Badge>
          <Badge variant={t.kind === 'agent' ? 'blue' : 'gray'}>{copy.templates.kinds[t.kind]}</Badge>
          <Badge variant="gray">{categoryLabel(t.category)}</Badge>
          <Badge variant="gray">
            {copy.templates.difficulty} {DIFFICULTY_LABEL[t.difficulty]}
          </Badge>
        </div>
        <h3 className="mt-2.5 font-bold">{t.name}</h3>
        <p className="text-muted mt-1 line-clamp-2 text-[13px]">{t.summary}</p>
        <p className="text-muted mt-2 text-xs">
          {t.kind === 'agent'
            ? `${t.model ? modelLabel(t.model).replace('Claude ', '') : ''} · 스킬 ${t.skills.length} · 워크플로 1`
            : `${copy.templates.nodes(t.nodeCount)} · ${TRIGGER_LABEL[t.trigger] ?? t.trigger}`}
        </p>
        <p className="text-muted mt-1 text-xs">
          {copy.templates.requires}: {requires || copy.templates.none}
        </p>
        <div className="mt-auto grid grid-cols-2 gap-2 pt-4">
          <Button variant="outline" onClick={onPreview}>
            {copy.templates.preview}
          </Button>
          <Button onClick={onUse}>{copy.templates.use}</Button>
        </div>
      </div>
    </article>
  );
}
