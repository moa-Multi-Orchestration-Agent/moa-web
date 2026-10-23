'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { modelLabel, useAgent, useAgents } from '@/entities/agent';
import { listingFormSchema, marketCategoryLabel, useCreateListing, useScan, type ListingForm, type ScanFinding } from '@/entities/product';
import { isApiError } from '@/shared/lib/api-client';
import { formatKrw } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { SectionCard } from '@/shared/ui/page-header';
import { ErrorState, ListSkeleton } from '@/shared/ui/states';
import { StepInfo, StepItem, StepPrice, StepScan } from './sell-steps';

const STEPS = ['게시할 항목', '소개 정보', '보안 점검', '가격 · 라이선스', '미리보기 · 제출'];
type Errs = Partial<Record<keyof ListingForm, string>>;
const STEP_FIELDS: (keyof ListingForm)[][] = [['agent_id'], ['title', 'summary', 'category', 'tags', 'readme_md'], [], ['free'], []];

export function SellWizard({ initialAgentId }: { initialAgentId?: string | null }) {
  const router = useRouter();
  const agents = useAgents({ limit: 50 });
  const own = agents.items.filter((a) => !a.purchased && !a.apiOnly);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<ListingForm>({ agent_id: '', title: '', summary: '', category: '', tags: [], readme_md: '## 소개\n\n무엇을 해 주는지 적어 주세요.\n\n## 사용 방법\n1. 구매하고 스튜디오에 추가\n2. 필요한 연동 연결\n3. 테스트 후 배포', free: false, sell_clone: true, sell_api: false, price_clone_krw: 49000, price_api_month_krw: 19000 });
  const [errors, setErrors] = useState<Errs>({});
  const [findings, setFindings] = useState<ScanFinding[] | null>(null);
  const scan = useScan();
  const create = useCreateListing();
  const detail = useAgent(form.agent_id || null);
  const set = (p: Partial<ListingForm>) => setForm((f) => ({ ...f, ...p }));

  useEffect(() => {
    if (initialAgentId && !form.agent_id && own.some((a) => a.id === initialAgentId)) {
      const a = own.find((x) => x.id === initialAgentId)!;
      set({ agent_id: a.id, title: a.name, summary: a.description ?? '' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialAgentId, own.length]);

  const runScan = () => {
    setFindings(null);
    scan.mutate({ agent_id: form.agent_id, readme_md: form.readme_md }, { onSuccess: (r) => setFindings(r.findings), onError: (e) => toast.error(e.message) });
  };

  const validate = (i: number) => {
    const r = listingFormSchema.safeParse(form);
    const errs: Errs = {};
    if (!r.success) for (const issue of r.error.issues) errs[issue.path[0] as keyof ListingForm] ??= issue.message;
    const mine = Object.fromEntries(Object.entries(errs).filter(([k]) => STEP_FIELDS[i]!.includes(k as keyof ListingForm)));
    setErrors(mine);
    return Object.keys(mine).length === 0;
  };

  const next = () => {
    if (!validate(step)) return;
    if (step === 2 && findings?.some((f) => f.severity === 'error')) return toast.error('보안 검사 오류를 먼저 고치세요.');
    if (step === 1) runScan();
    setStep((s) => Math.min(4, s + 1));
  };

  const submit = () => {
    const license_types = [...(form.free || form.sell_clone ? (['clone'] as const) : []), ...(form.sell_api ? (['api_sub'] as const) : [])];
    create.mutate(
      { agent_id: form.agent_id, title: form.title, summary: form.summary, category: form.category, tags: form.tags, readme_md: form.readme_md, license_types: [...license_types], price_clone_krw: form.free ? 0 : form.sell_clone ? form.price_clone_krw : null, price_api_month_krw: form.sell_api ? form.price_api_month_krw : null },
      {
        onSuccess: () => {
          toast.success('검수를 요청했습니다. 보통 하루 안에 결과가 나옵니다.');
          router.push('/market/sales');
        },
        onError: (e) => {
          if (isApiError(e) && e.code === 'MOA-MKT-001') {
            setFindings((e.body?.findings as ScanFinding[]) ?? null);
            setStep(2);
          }
          toast.error(isApiError(e) ? e.detail : e.message);
        },
      },
    );
  };

  if (agents.isPending) return <ListSkeleton rows={6} />;
  if (agents.isError) return <ErrorState error={agents.error} onRetry={() => void agents.refetch()} />;
  const a = detail.data;
  const canApi = !!a && a.endpointCount > 0;

  return (
    <div className="space-y-5">
      <ol className="grid grid-cols-5 gap-2" aria-label="게시 단계">
        {STEPS.map((t, i) => (
          <li key={t} aria-current={i === step ? 'step' : undefined} className={cn('bg-card flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm', i === step && 'border-primary')}>
            <span className={cn('flex size-6 items-center justify-center rounded border text-xs font-semibold', i < step && 'bg-foreground text-background', i === step && 'border-primary text-primary')}>{i < step ? <Check className="size-3.5" aria-label="완료" /> : i + 1}</span>
            <span className={i === step ? 'font-semibold' : 'text-muted'}>{t}</span>
          </li>
        ))}
      </ol>
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <SectionCard title={`${step + 1}. ${STEPS[step]}`}>
          {step === 0 ? <StepItem agents={own} form={form} set={set} errors={errors} /> : step === 1 ? <StepInfo form={form} set={set} errors={errors} /> : step === 2 ? <StepScan findings={findings} pending={scan.isPending} /> : step === 3 ? <StepPrice form={form} set={set} errors={errors} canApi={canApi} /> : (
            <div className="space-y-2 text-sm">
              <p>아래 내용으로 검수를 요청합니다. 검수를 통과하면 마켓에 공개됩니다.</p>
              <dl className="divide-y rounded-md border">
                {[['제목', form.title], ['요약', form.summary], ['카테고리', marketCategoryLabel(form.category)], ['태그', form.tags.join(', ') || '없음'], ['가격', [form.free ? '무료 공유' : form.sell_clone ? `복제 ${formatKrw(form.price_clone_krw)}` : null, form.sell_api ? `API 월 ${formatKrw(form.price_api_month_krw)}` : null].filter(Boolean).join(' · ')]].map(([k, v]) => (
                  <div key={k} className="grid grid-cols-[96px_1fr] gap-2 px-3 py-2"><dt className="text-muted">{k}</dt><dd>{v}</dd></div>
                ))}
              </dl>
            </div>
          )}
          <div className="mt-6 flex justify-between border-t pt-4">
            <Button variant="outline" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>이전</Button>
            {step === 2 ? <Button variant="ghost" onClick={runScan} disabled={scan.isPending}>다시 검사</Button> : null}
            {step < 4 ? <Button onClick={next} disabled={step === 2 && (scan.isPending || !findings)} data-testid="sell-next">다음</Button> : <Button onClick={submit} disabled={create.isPending} data-testid="sell-submit">{create.isPending ? <Loader2 className="animate-spin" aria-hidden /> : null}검수 요청</Button>}
          </div>
        </SectionCard>
        <SectionCard title="게시 요약">
          {!a ? <p className="text-muted text-sm">게시할 항목을 고르세요.</p> : (
            <div className="space-y-3 text-sm">
              <p className="flex items-center gap-2"><Badge variant="blue">에이전트</Badge><b>{form.title || a.name}</b></p>
              <div className="bg-surface space-y-1 rounded-md p-3">
                <p className="text-muted text-xs">함께 게시되는 구성</p>
                <p>· 모델: {modelLabel(a.model)}</p>
                <p>· 스킬 {a.skills.length}개: {a.skills.map((s) => s.label).join(', ') || '없음'}</p>
                <p>· 연결된 워크플로 {a.workflows.length}개: {a.workflows.map((w) => w.name).join(', ') || '없음'}</p>
              </div>
              <p className="font-semibold">보안 점검</p>
              <div className="flex flex-wrap gap-1.5">
                {findings === null ? <Badge variant="gray">검사 전</Badge> : (
                  <>
                    <Badge variant="green">자격증명 제거됨</Badge>
                    <Badge variant={findings.some((f) => f.severity === 'error') ? 'red' : 'green'}>{findings.some((f) => f.severity === 'error') ? '비밀값 발견' : '비밀값 없음'}</Badge>
                    <Badge variant={findings.some((f) => f.rule === 'internal_url') ? 'orange' : 'green'}>{findings.some((f) => f.rule === 'internal_url') ? '내부 URL 있음' : '내부 URL 없음'}</Badge>
                  </>
                )}
              </div>
              <p className="text-muted text-xs">구매자는 메일·Slack 등 연동을 자신의 자격증명으로 다시 연결합니다.</p>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
