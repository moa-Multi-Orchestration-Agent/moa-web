'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useCreateAgent } from '@/entities/agent';
import { nameFromPrompt, pickTemplate, useInstantiateTemplate, useTemplates } from '@/entities/template';
import { useCreateWorkflow } from '@/entities/workflow';
import { useCurrentWorkspace } from '@/entities/workspace';
import { copy } from '@/shared/lib/copy';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';
import { Guarded } from '@/shared/ui/guarded';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { PageContainer, PageHeader } from '@/shared/ui/page-header';
import { RadioGroup, RadioGroupItem } from '@/shared/ui/radio-group';

type Kind = 'agent' | 'workflow';
type Start = 'auto' | 'template' | 'blank';

const KINDS: Record<Kind, { title: string; body: string; good: string[]; example: string }> = {
  agent: {
    title: '에이전트',
    body: '모델을 고르고 스킬과 워크플로를 붙여 만드는 AI. 대화로 요청을 받아 어떤 도구를 쓸지 스스로 판단합니다.',
    good: ['요청마다 판단이 달라질 때', '대화로 일을 맡기고 싶을 때', '여러 도구를 상황에 맞게 골라 써야 할 때'],
    example: '예: 디자인 리서치 에이전트, 고객 문의 응대',
  },
  workflow: {
    title: '워크플로',
    body: '정해진 순서대로 노드가 실행되는 자동화 파이프라인. 단독 배포도, 에이전트의 스킬로 연결도 가능합니다.',
    good: ['매번 같은 절차를 반복할 때', '예약 · Webhook · 메일 수신으로 자동 실행할 때', '결과 형식이 정확히 정해져 있을 때'],
    example: '예: 매일 뉴스 요약 발송, 3D 시각화 파이프라인',
  },
};

function Diagram({ kind }: { kind: Kind }) {
  if (kind === 'agent') {
    return (
      <div className="bg-surface flex items-center justify-center gap-6 rounded-lg p-6" aria-hidden>
        <div className="text-center">
          <div className="border-primary bg-primary-soft text-primary rounded-md border px-6 py-4 text-sm font-semibold">모델</div>
          <p className="text-muted mt-1 text-[11px]">+ 역할 지시문 · 기억</p>
        </div>
        <span className="text-muted">←</span>
        <div className="space-y-1.5">
          {['스킬 · 웹 검색', '스킬 · RAG 검색', '워크플로 · 3D 시각화'].map((x) => (
            <div key={x} className="bg-background rounded-md border px-3 py-1.5 text-xs font-medium">
              {x}
            </div>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="bg-surface flex items-center justify-center rounded-lg p-6" aria-hidden>
      {['트리거', '검색', 'LLM', '메일'].map((x, i) => (
        <span key={x} className="flex items-center">
          {i > 0 ? <span className="bg-border h-px w-6" /> : null}
          <span className="bg-background rounded-md border px-4 py-2 text-xs font-semibold">{x}</span>
        </span>
      ))}
    </div>
  );
}

export function NewView() {
  const sp = useSearchParams();
  const router = useRouter();
  const [kind, setKind] = useState<Kind>(sp.get('type') === 'workflow' ? 'workflow' : 'agent');
  const [start, setStart] = useState<Start>(sp.get('start') === 'blank' ? 'blank' : 'auto');
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { can } = useCurrentWorkspace();
  const templates = useTemplates();
  const instantiate = useInstantiateTemplate();
  const createAgent = useCreateAgent();
  const createWorkflow = useCreateWorkflow();
  const busy = instantiate.isPending || createAgent.isPending || createWorkflow.isPending;

  const submit = async () => {
    if (start === 'template') {
      router.push(`/templates?kind=${kind}`);
      return;
    }
    const finalName = name.trim() || (desc.trim() ? nameFromPrompt(desc, kind) : '');
    if (!finalName) {
      setError('이름을 입력하세요.');
      return;
    }
    setError(null);
    try {
      const t = start === 'auto' ? pickTemplate(`${finalName} ${desc}`, kind, templates.data ?? []) : null;
      if (t) {
        const r = await instantiate.mutateAsync({ id: t.id, name: finalName, description: desc || undefined });
        toast.success(`"${t.name}" 템플릿으로 구성했습니다.`);
        router.push(kind === 'agent' && r.agent_id ? `/agents/${r.agent_id}` : `/workflows/${r.workflow_id}/edit`);
      } else if (kind === 'agent') {
        const a = await createAgent.mutateAsync({ name: finalName, description: desc || null, system_prompt: start === 'auto' ? desc : '' });
        toast.success(copy.toast.created('에이전트'));
        router.push(`/agents/${a.id}`);
      } else {
        const w = await createWorkflow.mutateAsync({ name: finalName, description: desc || undefined });
        toast.success(copy.toast.created('워크플로'));
        router.push(`/workflows/${w.id}/edit`);
      }
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <PageContainer>
      <PageHeader title={copy.pages.studioNew} description="만들 것의 종류를 고르세요. 둘 다 스튜디오에서 관리됩니다." />
      <RadioGroup value={kind} onValueChange={(v) => setKind(v as Kind)} className="grid gap-5 lg:grid-cols-2" aria-label="종류">
        {(['agent', 'workflow'] as const).map((k) => {
          const c = KINDS[k];
          const on = kind === k;
          return (
            <label key={k} htmlFor={`kind-${k}`} className={cn('bg-card cursor-pointer rounded-xl border-2 p-6 transition-colors', on ? 'border-primary bg-primary-soft/40' : 'border-border hover:border-primary/40')}>
              <div className="flex items-center gap-3">
                <RadioGroupItem id={`kind-${k}`} value={k} />
                <span className="text-xl font-bold">{c.title}</span>
                {on ? <span className="text-primary ml-auto text-xs font-semibold">선택됨</span> : null}
              </div>
              <p className="text-muted mt-3 text-sm">{c.body}</p>
              <div className="mt-4">
                <Diagram kind={k} />
              </div>
              <p className="mt-4 text-sm font-semibold">이럴 때 좋아요</p>
              <ul className="mt-2 space-y-1.5 text-sm">
                {c.good.map((g) => (
                  <li key={g}>· {g}</li>
                ))}
              </ul>
              <p className="text-muted mt-3 text-xs">{c.example}</p>
            </label>
          );
        })}
      </RadioGroup>
      <form
        className="bg-card space-y-4 rounded-xl border p-5"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="new-name">이름</Label>
            <Input id="new-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={kind === 'agent' ? '디자인 리서치 에이전트' : 'AI 뉴스 요약 발송'} maxLength={60} aria-invalid={!!error} aria-describedby={error ? 'new-error' : undefined} />
            {error ? (
              <p id="new-error" role="alert" className="text-danger text-sm">
                {error}
              </p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-desc">한 줄 설명</Label>
            <Input id="new-desc" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="스케치를 받아 조사 · 컨셉 정리 · 3D 시각화까지 돕습니다" maxLength={200} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <span className="text-muted text-sm">시작 방식</span>
          <RadioGroup value={start} onValueChange={(v) => setStart(v as Start)} className="flex flex-wrap gap-5" aria-label="시작 방식">
            {(
              [
                ['auto', '설명으로 자동 구성 (추천)'],
                ['template', '템플릿에서'],
                ['blank', '빈 상태'],
              ] as const
            ).map(([v, l]) => (
              <div key={v} className="flex items-center gap-2">
                <RadioGroupItem id={`start-${v}`} value={v} />
                <Label htmlFor={`start-${v}`} className="font-normal">
                  {l}
                </Label>
              </div>
            ))}
          </RadioGroup>
          <div className="ml-auto flex gap-2">
            <Button type="button" variant="ghost" onClick={() => router.back()}>
              {copy.common.cancel}
            </Button>
            <Guarded allowed={can('edit')} reason={copy.common.viewerReason}>
              <Button type="submit" disabled={busy}>
                {busy ? <Loader2 className="animate-spin" aria-hidden /> : null}
                {start === 'template' ? '템플릿 고르기' : '만들기'} <ArrowRight aria-hidden />
              </Button>
            </Guarded>
          </div>
        </div>
      </form>
    </PageContainer>
  );
}
