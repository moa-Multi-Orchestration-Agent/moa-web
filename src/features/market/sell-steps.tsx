'use client';

import { Markdown as ReactMarkdown } from '@/shared/ui/markdown';
import { AlertCircle, AlertTriangle, Info, Loader2 } from 'lucide-react';
import type { Agent } from '@/entities/agent';
import { MARKET_CATEGORIES, type ListingForm, type ScanFinding } from '@/entities/product';
import { cn } from '@/shared/lib/utils';
import { Badge } from '@/shared/ui/badge';
import { Checkbox } from '@/shared/ui/checkbox';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { RadioGroup, RadioGroupItem } from '@/shared/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Textarea } from '@/shared/ui/textarea';

type Set = (p: Partial<ListingForm>) => void;
type Errs = Partial<Record<keyof ListingForm, string>>;

const Err = ({ m }: { m?: string }) => (m ? <p className="text-danger text-xs">{m}</p> : null);

export function StepItem({ agents, form, set, errors }: { agents: Agent[]; form: ListingForm; set: Set; errors: Errs }) {
  return (
    <RadioGroup value={form.agent_id} onValueChange={(v) => { const a = agents.find((x) => x.id === v); set({ agent_id: v, title: form.title || a?.name || '', summary: form.summary || a?.description || '' }); }} className="space-y-2" aria-label="게시할 에이전트">
      {agents.length === 0 ? <p className="text-muted text-sm">게시할 수 있는 에이전트가 없어요. 구매한 에이전트는 다시 팔 수 없습니다.</p> : null}
      {agents.map((a) => (
        <label key={a.id} className={cn('flex cursor-pointer items-center gap-3 rounded-lg border p-3', form.agent_id === a.id && 'border-primary bg-primary-soft/50')}>
          <RadioGroupItem value={a.id} />
          <span className="text-xl" aria-hidden>{a.icon}</span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">{a.name}</span>
            <span className="text-muted block truncate text-xs">스킬 {a.skillCount}개 · 워크플로 {a.workflowCount}개{a.endpointCount ? ' · 배포됨' : ''}</span>
          </span>
          {a.listed ? <Badge variant="blue">판매 중</Badge> : null}
        </label>
      ))}
      <Err m={errors.agent_id} />
    </RadioGroup>
  );
}

export function StepInfo({ form, set, errors }: { form: ListingForm; set: Set; errors: Errs }) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="sell-title">제목</Label>
        <Input id="sell-title" value={form.title} onChange={(e) => set({ title: e.target.value })} maxLength={60} aria-invalid={!!errors.title} />
        <Err m={errors.title} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="sell-summary">한 줄 요약</Label>
        <Input id="sell-summary" value={form.summary} onChange={(e) => set({ summary: e.target.value })} maxLength={140} aria-invalid={!!errors.summary} />
        <Err m={errors.summary} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="sell-cat">카테고리</Label>
          <Select value={form.category || undefined} onValueChange={(v) => set({ category: v })}>
            <SelectTrigger id="sell-cat" className="w-full" aria-invalid={!!errors.category}><SelectValue placeholder="고르기" /></SelectTrigger>
            <SelectContent>{MARKET_CATEGORIES.map((c) => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}</SelectContent>
          </Select>
          <Err m={errors.category} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sell-tags">태그(쉼표로 구분)</Label>
          <Input id="sell-tags" value={form.tags.join(', ')} onChange={(e) => set({ tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })} />
          <Err m={errors.tags} />
        </div>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="sell-readme">README (마크다운)</Label>
          <Textarea id="sell-readme" value={form.readme_md} onChange={(e) => set({ readme_md: e.target.value })} className="h-56 font-mono text-xs" />
          <Err m={errors.readme_md} />
        </div>
        <div className="space-y-1.5">
          <p className="text-sm font-medium">미리보기</p>
          <div className="prose-sm bg-surface h-56 overflow-auto rounded-md border p-3 text-sm [&_h2]:font-bold [&_li]:ml-4 [&_li]:list-disc"><ReactMarkdown>{form.readme_md || '_내용 없음_'}</ReactMarkdown></div>
        </div>
      </div>
    </div>
  );
}

const SEV = { info: { icon: Info, cls: 'text-primary', v: 'blue' as const, t: '자동 정리' }, warn: { icon: AlertTriangle, cls: 'text-warning', v: 'orange' as const, t: '확인 권장' }, error: { icon: AlertCircle, cls: 'text-danger', v: 'red' as const, t: '등록 불가' } };
const RULE: Record<string, string> = { credential_ref: '자격증명 참조', anthropic_key: 'Anthropic 키', openai_key: 'OpenAI 키', aws_key: 'AWS 키', jwt: 'JWT', pem: '개인 키(PEM)', slack_token: 'Slack 토큰', internal_url: '내부 주소', high_entropy: '비밀값 의심', pii: '개인정보 의심' };

export function StepScan({ findings, pending }: { findings: ScanFinding[] | null; pending: boolean }) {
  if (pending || !findings) return <p className="text-muted flex items-center gap-2 text-sm"><Loader2 className="size-4 animate-spin" aria-hidden /> 에이전트와 워크플로를 검사하는 중…</p>;
  const errors = findings.filter((f) => f.severity === 'error');
  return (
    <div className="space-y-3">
      <p className={cn('rounded-md px-3 py-2 text-sm font-medium', errors.length ? 'bg-danger-soft text-danger' : 'bg-success-soft text-success')} role="status">
        {errors.length ? `비밀값으로 보이는 문자열 ${errors.length}건이 있어 등록할 수 없습니다. 아래 위치에서 지운 뒤 다시 검사하세요.` : '등록할 수 있습니다. 자격증명 참조는 자동으로 지워지고, 구매자가 자기 것으로 다시 연결합니다.'}
      </p>
      <ul className="divide-y rounded-md border" data-testid="scan-findings">
        {findings.map((f, i) => {
          const s = SEV[f.severity];
          return (
            <li key={i} className="flex items-start gap-2 px-3 py-2 text-sm">
              <s.icon className={cn('mt-0.5 size-4 shrink-0', s.cls)} aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="font-medium">{RULE[f.rule] ?? f.rule}</span> <Badge variant={s.v}>{s.t}</Badge>
                <code className="text-muted mt-0.5 block truncate font-mono text-xs">{f.path}</code>
                {f.excerpt ? <span className="text-muted text-xs">{f.excerpt}</span> : null}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function StepPrice({ form, set, errors, canApi }: { form: ListingForm; set: Set; errors: Errs; canApi: boolean }) {
  const box = (on: boolean) => cn('rounded-lg border p-4', on && 'border-primary bg-primary-soft/40');
  return (
    <div className="space-y-3">
      <div className={box(form.free)}>
        <label className="flex items-center gap-2 font-semibold"><Checkbox checked={form.free} onCheckedChange={(v) => set({ free: v === true, sell_clone: v === true ? false : form.sell_clone })} /> 무료 공유</label>
        <p className="text-muted mt-1 text-sm">누구나 무료로 복제할 수 있습니다.</p>
      </div>
      <div className={box(form.sell_clone)}>
        <label className="flex items-center gap-2 font-semibold"><Checkbox checked={form.sell_clone} disabled={form.free} onCheckedChange={(v) => set({ sell_clone: v === true })} /> 복제 라이선스 판매</label>
        <p className="text-muted mt-1 text-sm">구매자가 에이전트와 연결된 워크플로를 복제해 수정할 수 있습니다. 재판매 금지.</p>
        {form.sell_clone ? <div className="mt-3 max-w-60 space-y-1"><Label htmlFor="price-clone">가격 (1회, 원)</Label><Input id="price-clone" type="number" min={0} step={1000} value={form.price_clone_krw} onChange={(e) => set({ price_clone_krw: Number(e.target.value) })} /></div> : null}
      </div>
      <div className={box(form.sell_api)}>
        <label className="flex items-center gap-2 font-semibold"><Checkbox checked={form.sell_api} disabled={!canApi} onCheckedChange={(v) => set({ sell_api: v === true })} /> API 사용 구독</label>
        <p className="text-muted mt-1 text-sm">내 환경에서 실행하고 구매자는 호출만 합니다. 모델 · 프롬프트 · 워크플로 구성은 공개되지 않습니다.{!canApi ? ' (먼저 이 에이전트를 배포해야 고를 수 있어요)' : ''}</p>
        {form.sell_api ? <div className="mt-3 max-w-60 space-y-1"><Label htmlFor="price-api">월 구독료(원)</Label><Input id="price-api" type="number" min={0} step={1000} value={form.price_api_month_krw} onChange={(e) => set({ price_api_month_krw: Number(e.target.value) })} /></div> : null}
      </div>
      <Err m={errors.free} />
      <p className="text-muted text-xs">플랫폼 수수료 20% · 정산은 매월 10일 · 실행 비용은 API 구독일 때 판매자 부담</p>
    </div>
  );
}
