'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';
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

export function BillingTab() {
  return (
    <SectionCard title="결제 · 정산">
      <dl className="max-w-md space-y-3 text-sm">
        <div className="flex justify-between"><dt className="text-muted">플랜</dt><dd className="font-semibold">Team</dd></div>
        <div className="flex justify-between"><dt className="text-muted">결제 수단</dt><dd className="font-mono">카드 ••••4242</dd></div>
        <div className="flex justify-between"><dt className="text-muted">판매 정산 계좌</dt><dd className="font-mono">국민은행 ••••1024</dd></div>
        <div className="flex justify-between"><dt className="text-muted">정산일</dt><dd>매월 10일 · 수수료 20%</dd></div>
      </dl>
      <p className="text-muted mt-4 text-xs">학기 범위에서는 모의 결제만 지원합니다(설계서 미결 3). 실제 PG 연동은 백엔드 준비 후 붙입니다.</p>
      <Button variant="outline" className="mt-3" disabled>결제 · 정산 정보 변경</Button>
    </SectionCard>
  );
}
