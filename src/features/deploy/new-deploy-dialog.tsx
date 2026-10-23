'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAgents } from '@/entities/agent';
import { endpointFormSchema, PUBLIC_API_ORIGIN, RESERVED_SLUGS, SLUG_RE, useCheckSlug, useCreateEndpoint, type EndpointForm } from '@/entities/endpoint';
import { useCurrentWorkspace } from '@/entities/workspace';
import { useDebounced } from '@/shared/hooks/use-debounced';
import { isApiError } from '@/shared/lib/api-client';
import { Button } from '@/shared/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { RadioGroup, RadioGroupItem } from '@/shared/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';

/** 이름에서 slug 후보. 한글뿐이라 비면 agent-<id 끝 4자리> */
const slugify = (name: string, id = '') => {
  const s = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return s.length >= 3 ? s : `agent-${id.slice(-4) || 'new'}`;
};

const REASON: Record<string, string> = { format: '소문자·숫자·하이픈 3~63자, 첫 글자는 영문 소문자나 숫자', reserved: '예약된 이름이라 쓸 수 없습니다', taken: '이미 쓰고 있는 슬러그입니다 (MOA-API-001)' };

/** 새 배포: 에이전트 선택, slug(형식·중복 실시간 검사), 동기/비동기, 웹훅, 분당 한도 */
export function NewDeployDialog({ open, onOpenChange, initialAgentId }: { open: boolean; onOpenChange: (o: boolean) => void; initialAgentId?: string | null }) {
  const router = useRouter();
  const { workspace } = useCurrentWorkspace();
  const agents = useAgents({ limit: 50 });
  const create = useCreateEndpoint();
  const [form, setForm] = useState<EndpointForm>({ agent_id: '', slug: '', mode: 'sync', webhook_url: '', rate_limit_rpm: 60 });
  const [errors, setErrors] = useState<Partial<Record<keyof EndpointForm, string>>>({});
  const [touchedSlug, setTouchedSlug] = useState(false);
  const deployable = agents.items.filter((a) => !a.apiOnly);

  // 열릴 때 한 번만(에이전트 목록이 도착한 뒤) 초기값을 채운다
  const initialized = useRef(false);
  useEffect(() => {
    if (!open) {
      initialized.current = false;
      return;
    }
    if (initialized.current || agents.isPending) return;
    initialized.current = true;
    const a = deployable.find((x) => x.id === initialAgentId);
    setForm({ agent_id: a?.id ?? '', slug: a ? slugify(a.name, a.id) : '', mode: 'sync', webhook_url: '', rate_limit_rpm: 60 });
    setErrors({});
    setTouchedSlug(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialAgentId, agents.isPending]);

  const slug = useDebounced(form.slug, 300);
  const formatOk = SLUG_RE.test(slug) && !RESERVED_SLUGS.includes(slug);
  const check = useCheckSlug(slug, open && formatOk);
  const slugState = !slug ? null : !formatOk ? { ok: false, text: RESERVED_SLUGS.includes(slug) ? REASON.reserved : REASON.format } : check.isFetching ? { ok: null, text: '확인 중…' } : check.data ? { ok: check.data.available, text: check.data.available ? '사용할 수 있어요' : REASON[check.data.reason ?? 'taken'] } : null;

  const submit = () => {
    const r = endpointFormSchema.safeParse(form);
    if (!r.success) {
      setErrors(Object.fromEntries(r.error.issues.map((i) => [i.path[0], i.message])));
      return;
    }
    if (check.data && !check.data.available) {
      setErrors({ slug: REASON[check.data.reason ?? 'taken'] });
      return;
    }
    create.mutate(r.data, {
      onSuccess: (ep) => {
        toast.success(`/${ep.slug}로 배포했습니다.`);
        onOpenChange(false);
        router.push(`/deploy/${ep.id}`);
      },
      onError: (e) => {
        if (isApiError(e) && (e.code === 'MOA-API-001' || e.code === 'MOA-API-005')) setErrors({ slug: e.detail });
        else toast.error(isApiError(e) ? e.detail : e.message);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="space-y-4" noValidate>
          <DialogHeader>
            <DialogTitle>새 배포</DialogTitle>
            <DialogDescription>에이전트의 기본 워크플로를 불변 버전으로 고정하고, 입력 노드의 필드로 API 스키마를 만듭니다.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="dep-agent">에이전트</Label>
            <Select
              value={form.agent_id || undefined}
              onValueChange={(v) => {
                const a = deployable.find((x) => x.id === v);
                setForm((f) => ({ ...f, agent_id: v, slug: touchedSlug ? f.slug : slugify(a?.name ?? '', v) }));
              }}
            >
              <SelectTrigger id="dep-agent" className="w-full" aria-invalid={!!errors.agent_id}>
                <SelectValue placeholder={agents.isPending ? '불러오는 중…' : '에이전트 고르기'} />
              </SelectTrigger>
              <SelectContent>
                {deployable.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.icon} {a.name}
                    {a.endpointCount ? ` · 배포 ${a.endpointCount}개` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.agent_id ? <p className="text-danger text-xs">{errors.agent_id}</p> : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dep-slug">슬러그</Label>
            <div className="flex items-center rounded-md border focus-within:ring-2 focus-within:ring-ring/40">
              <span className="text-muted bg-surface shrink-0 border-r px-2.5 py-2 font-mono text-xs">{PUBLIC_API_ORIGIN.replace('https://', '')}/a/{workspace?.slug}/</span>
              <input
                id="dep-slug"
                value={form.slug}
                onChange={(e) => {
                  setTouchedSlug(true);
                  setForm((f) => ({ ...f, slug: e.target.value.toLowerCase() }));
                  setErrors((x) => ({ ...x, slug: undefined }));
                }}
                className="min-w-0 flex-1 bg-transparent px-2 py-2 font-mono text-sm outline-none"
                aria-invalid={!!errors.slug || slugState?.ok === false}
                aria-describedby="dep-slug-state"
                autoComplete="off"
              />
            </div>
            <p id="dep-slug-state" role="status" className={errors.slug || slugState?.ok === false ? 'text-danger flex items-center gap-1 text-xs' : slugState?.ok ? 'text-success flex items-center gap-1 text-xs' : 'text-muted flex items-center gap-1 text-xs'}>
              {errors.slug ? <XCircle className="size-3.5" aria-hidden /> : slugState?.ok === true ? <CheckCircle2 className="size-3.5" aria-hidden /> : slugState?.ok === false ? <XCircle className="size-3.5" aria-hidden /> : slugState ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
              {errors.slug ?? slugState?.text ?? '외부에서 부를 주소입니다'}
            </p>
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">호출 방식</legend>
            <RadioGroup value={form.mode} onValueChange={(v) => setForm((f) => ({ ...f, mode: v as 'sync' | 'async' }))} className="flex gap-5">
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="sync" /> 동기 · 결과 바로 반환(60초)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="async" /> 비동기 · job + 웹훅
              </label>
            </RadioGroup>
          </fieldset>
          <div className="grid grid-cols-[1fr_120px] gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="dep-hook">완료 콜백 Webhook (선택)</Label>
              <Input id="dep-hook" value={form.webhook_url} onChange={(e) => setForm((f) => ({ ...f, webhook_url: e.target.value }))} placeholder="https://내-서버/moa-callback" aria-invalid={!!errors.webhook_url} />
              {errors.webhook_url ? <p className="text-danger text-xs">{errors.webhook_url}</p> : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dep-rpm">분당 한도</Label>
              <Input id="dep-rpm" type="number" min={1} value={form.rate_limit_rpm} onChange={(e) => setForm((f) => ({ ...f, rate_limit_rpm: Number(e.target.value) }))} aria-invalid={!!errors.rate_limit_rpm} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              취소
            </Button>
            <Button type="submit" disabled={create.isPending} data-testid="deploy-submit">
              {create.isPending ? <Loader2 className="animate-spin" aria-hidden /> : null}배포
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
