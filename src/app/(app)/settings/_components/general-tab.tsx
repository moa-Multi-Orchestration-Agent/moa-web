'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';
import { billingFormSchema, useBilling, useUpdateBilling, type BillingForm } from '@/entities/budget';
import { useCurrentWorkspace, useUpdateWorkspace, workspaceFormSchema, type WorkspaceForm } from '@/entities/workspace';
import { copy } from '@/shared/lib/copy';
import { Button } from '@/shared/ui/button';
import { Guarded } from '@/shared/ui/guarded';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { SectionCard } from '@/shared/ui/page-header';
import { RadioGroup, RadioGroupItem } from '@/shared/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Slider } from '@/shared/ui/slider';
import { Skeleton } from '@/shared/ui/skeleton';
import { ErrorState } from '@/shared/ui/states';

export function GeneralTab() {
  const { workspace, can } = useCurrentWorkspace();
  const update = useUpdateWorkspace();
  const { theme, setTheme } = useTheme();
  const [form, setForm] = useState<WorkspaceForm>({ name: '', slug: '', compress_threshold: 0.7 });
  const [errors, setErrors] = useState<Partial<Record<keyof WorkspaceForm, string>>>({});
  useEffect(() => {
    if (workspace) setForm({ name: workspace.name, slug: workspace.slug, compress_threshold: workspace.settings.compress_threshold ?? 0.7 });
  }, [workspace]);
  const disabled = !can('budget');
  const save = () => {
    const r = workspaceFormSchema.safeParse(form);
    if (!r.success) return setErrors(Object.fromEntries(r.error.issues.map((i) => [i.path[0], i.message])));
    setErrors({});
    update.mutate({ id: workspace!.id, name: r.data.name, slug: r.data.slug, settings: { compress_threshold: r.data.compress_threshold } }, { onSuccess: () => toast.success('워크스페이스 설정을 저장했습니다.'), onError: (e) => toast.error(e.message) });
  };
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <SectionCard title="워크스페이스">
        <form onSubmit={(e) => { e.preventDefault(); save(); }} className="space-y-4">
          <div className="space-y-1.5"><Label htmlFor="ws-name">이름</Label><Input id="ws-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} disabled={disabled} aria-invalid={!!errors.name} />{errors.name ? <p className="text-danger text-xs">{errors.name}</p> : null}</div>
          <div className="space-y-1.5"><Label htmlFor="ws-slug">slug (배포 주소에 쓰임)</Label><Input id="ws-slug" value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value.toLowerCase() }))} disabled={disabled} className="font-mono" aria-invalid={!!errors.slug} /><p className={errors.slug ? 'text-danger text-xs' : 'text-muted text-xs'}>{errors.slug ?? `https://api.moa.dev/a/${form.slug}/…  바꾸면 기존 배포 주소도 바뀝니다.`}</p></div>
          <div className="space-y-2">
            <div className="flex justify-between"><Label id="ws-th">컨텍스트 압축 임계치</Label><span className="font-mono text-sm">{Math.round(form.compress_threshold * 100)}%</span></div>
            <Slider aria-labelledby="ws-th" min={30} max={95} step={5} value={[Math.round(form.compress_threshold * 100)]} onValueChange={([v]) => setForm((f) => ({ ...f, compress_threshold: (v ?? 70) / 100 }))} disabled={disabled} />
            <p className="text-muted text-xs">컨텍스트가 이 비율을 넘으면 오래된 비고정 블록을 요약합니다(기본 70%, design.md 2.1.2).</p>
          </div>
          <Guarded allowed={!disabled} reason={copy.common.adminOnly}><Button type="submit" disabled={update.isPending}>저장</Button></Guarded>
        </form>
      </SectionCard>
      <SectionCard title="개인 설정">
        <div className="space-y-5">
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">테마</legend>
            <RadioGroup value={theme ?? 'system'} onValueChange={setTheme} className="flex gap-5">
              {[['light', '라이트'], ['dark', '다크'], ['system', '시스템 설정']].map(([v, l]) => <label key={v} className="flex items-center gap-2 text-sm"><RadioGroupItem value={v!} /> {l}</label>)}
            </RadioGroup>
          </fieldset>
          <div className="space-y-1.5">
            <Label htmlFor="lang">언어</Label>
            <Select value="ko" disabled><SelectTrigger id="lang" className="w-48"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ko">한국어</SelectItem></SelectContent></Select>
            <p className="text-muted text-xs">다른 언어는 준비 중입니다.</p>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

const BANKS = ['국민은행', '신한은행', '우리은행', '하나은행', '카카오뱅크', '토스뱅크'];
const CARDS = ['현대카드', '신한카드', '삼성카드', 'KB국민카드', '비씨카드'];

/** 결제·정산 정보(모의). 소유자만 바꿀 수 있고, 저장 후에는 끝 4자리만 보인다. */
export function BillingTab() {
  const { can } = useCurrentWorkspace();
  const q = useBilling();
  const update = useUpdateBilling();
  const [form, setForm] = useState<BillingForm>({ card_brand: '', card_number: '', payout_bank: '', payout_account: '', payout_holder: '' });
  const [errors, setErrors] = useState<Partial<Record<keyof BillingForm, string>>>({});
  useEffect(() => {
    if (q.data) setForm({ card_brand: q.data.card_brand, card_number: '', payout_bank: q.data.payout_bank, payout_account: '', payout_holder: q.data.payout_holder });
  }, [q.data]);
  const owner = can('ownerOnly');
  const save = () => {
    const r = billingFormSchema.safeParse(form);
    if (!r.success) return setErrors(Object.fromEntries(r.error.issues.map((i) => [i.path[0], i.message])));
    setErrors({});
    update.mutate(r.data, { onSuccess: () => { toast.success('결제 · 정산 정보를 바꿨습니다.'); setForm((f) => ({ ...f, card_number: '', payout_account: '' })); }, onError: (e) => toast.error(e.message) });
  };
  const sel = (id: keyof BillingForm, label: string, opts: string[]) => (
    <div className="space-y-1.5">
      <Label htmlFor={`bill-${id}`}>{label}</Label>
      <Select value={form[id] || undefined} onValueChange={(v) => setForm((f) => ({ ...f, [id]: v }))} disabled={!owner}>
        <SelectTrigger id={`bill-${id}`} className="w-full" aria-invalid={!!errors[id]}><SelectValue placeholder="고르기" /></SelectTrigger>
        <SelectContent>{opts.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
      </Select>
      {errors[id] ? <p className="text-danger text-xs">{errors[id]}</p> : null}
    </div>
  );
  const input = (id: keyof BillingForm, label: string, placeholder?: string, mono = true) => (
    <div className="space-y-1.5">
      <Label htmlFor={`bill-${id}`}>{label}</Label>
      <Input id={`bill-${id}`} value={form[id]} onChange={(e) => setForm((f) => ({ ...f, [id]: e.target.value }))} placeholder={placeholder} className={mono ? 'font-mono' : undefined} disabled={!owner} autoComplete="off" inputMode={mono ? 'numeric' : undefined} aria-invalid={!!errors[id]} />
      {errors[id] ? <p className="text-danger text-xs">{errors[id]}</p> : null}
    </div>
  );
  if (q.isPending) return <SectionCard title="결제 · 정산"><Skeleton className="h-48" /></SectionCard>;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  const b = q.data;
  return (
    <div className="grid gap-5 xl:grid-cols-[380px_1fr]">
      <SectionCard title="현재 정보">
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between"><dt className="text-muted">플랜</dt><dd className="font-semibold">Team</dd></div>
          <div className="flex justify-between"><dt className="text-muted">결제 수단</dt><dd className="font-mono" data-testid="billing-card">{b ? `${b.card_brand} ••••${b.card_last4}` : '없음'}</dd></div>
          <div className="flex justify-between"><dt className="text-muted">판매 정산 계좌</dt><dd className="font-mono">{b ? `${b.payout_bank} ••••${b.payout_last4}` : '없음'}</dd></div>
          <div className="flex justify-between"><dt className="text-muted">예금주</dt><dd>{b?.payout_holder ?? '—'}</dd></div>
          <div className="flex justify-between"><dt className="text-muted">정산일</dt><dd>매월 10일 · 수수료 20%</dd></div>
        </dl>
        <p className="text-muted mt-4 text-xs">모의 결제입니다(설계서 미결 3). 실제 PG 연동은 백엔드 준비 후 붙입니다.</p>
      </SectionCard>
      <SectionCard title="결제 · 정산 정보 변경">
        <form onSubmit={(e) => { e.preventDefault(); save(); }} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {sel('card_brand', '카드사', CARDS)}
            {input('card_number', '카드 번호(바꿀 때만)', '0000 0000 0000 0000')}
            {sel('payout_bank', '정산 은행', BANKS)}
            {input('payout_account', '계좌 번호(바꿀 때만)', '숫자만')}
            {input('payout_holder', '예금주', undefined, false)}
          </div>
          <p className="text-muted text-xs">카드·계좌 번호는 저장하지 않고 끝 4자리만 남깁니다.</p>
          <Guarded allowed={owner} reason="결제 · 정산 정보는 소유자만 바꿀 수 있습니다.">
            <Button type="submit" disabled={update.isPending}>저장</Button>
          </Guarded>
        </form>
      </SectionCard>
    </div>
  );
}
