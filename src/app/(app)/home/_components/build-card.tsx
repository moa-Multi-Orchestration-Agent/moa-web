'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { useCreateAgent } from '@/entities/agent';
import { useInstantiateTemplate, useTemplates } from '@/entities/template';
import { useCreateWorkflow } from '@/entities/workflow';
import { useCurrentWorkspace } from '@/entities/workspace';
import { copy } from '@/shared/lib/copy';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';
import { Guarded } from '@/shared/ui/guarded';
import { Textarea } from '@/shared/ui/textarea';
import { nameFromPrompt, pickTemplate } from './draft-from-prompt';

type Kind = 'agent' | 'workflow';

export function BuildCard() {
  const [kind, setKind] = useState<Kind>('agent');
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const templates = useTemplates();
  const instantiate = useInstantiateTemplate();
  const createAgent = useCreateAgent();
  const createWorkflow = useCreateWorkflow();
  const { can } = useCurrentWorkspace();
  const busy = instantiate.isPending || createAgent.isPending || createWorkflow.isPending;

  const go = (agentId: string | null, workflowId: string | null) => {
    if (kind === 'agent' && agentId) router.push(`/agents/${agentId}`);
    else if (workflowId) router.push(`/workflows/${workflowId}/edit`);
  };

  const submit = async () => {
    const value = text.trim();
    if (value.length < 5) {
      setError(copy.home.promptRequired);
      return;
    }
    setError(null);
    const name = nameFromPrompt(value, kind);
    try {
      const t = pickTemplate(value, kind, templates.data ?? []);
      if (t) {
        const r = await instantiate.mutateAsync({ id: t.id, name, description: value });
        toast.success(copy.home.draftCreated(name), { description: `"${t.name}" 템플릿을 바탕으로 구성했습니다.` });
        go(r.agent_id, r.workflow_id);
      } else if (kind === 'agent') {
        const a = await createAgent.mutateAsync({ name, description: value, system_prompt: value });
        toast.success(copy.home.draftCreated(name));
        go(a.id, null);
      } else {
        const w = await createWorkflow.mutateAsync({ name, description: value });
        toast.success(copy.home.draftCreated(name));
        go(null, w.id);
      }
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <section className="bg-card rounded-xl border p-6" aria-labelledby="build-title">
      <div className="flex items-center justify-between gap-4">
        <h2 id="build-title" className="text-xl font-bold">
          {copy.home.whatToBuild}
        </h2>
        <div role="radiogroup" aria-label="만들 종류" className="bg-surface flex rounded-md border p-1">
          {(['agent', 'workflow'] as const).map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={kind === k}
              onClick={() => setKind(k)}
              className={cn('rounded px-3 py-1.5 text-sm', kind === k ? 'bg-background font-semibold shadow-sm' : 'text-muted')}
            >
              {k === 'agent' ? '에이전트' : '워크플로'}
            </button>
          ))}
        </div>
      </div>
      <label htmlFor="build-prompt" className="sr-only">
        만들고 싶은 것 설명
      </label>
      <Textarea
        id="build-prompt"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void submit();
        }}
        placeholder={copy.home.promptPlaceholder[kind]}
        className="mt-5 min-h-[92px] resize-none text-[15px]"
        aria-invalid={!!error}
        aria-describedby={error ? 'build-error' : undefined}
      />
      {error ? (
        <p id="build-error" role="alert" className="text-danger mt-1 text-sm">
          {error}
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Guarded allowed={can('edit')} reason={copy.common.viewerReason}>
          <Button onClick={() => void submit()} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Sparkles aria-hidden />}
            {copy.home.draftFromPrompt}
          </Button>
        </Guarded>
        <Button variant="outline" asChild>
          <Link href={`/templates?kind=${kind}`}>{copy.home.fromTemplate}</Link>
        </Button>
        <Button variant="ghost" asChild>
          <Link href={`/studio/new?type=${kind}&start=blank`}>{copy.home.blank}</Link>
        </Button>
        <p className="text-muted ml-auto text-xs">{copy.home.hint}</p>
      </div>
    </section>
  );
}
