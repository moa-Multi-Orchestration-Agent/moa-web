'use client';

import { useEffect, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useEndpointStats, useUpdateEndpoint, type Endpoint } from '@/entities/endpoint';
import { useCurrentWorkspace } from '@/entities/workspace';
import { ApiKeysCard, embedSnippet } from '@/features/deploy';
import { isApiError } from '@/shared/lib/api-client';
import { copy } from '@/shared/lib/copy';
import { BarChart } from '@/shared/ui/bar-chart';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { CopyButton } from '@/shared/ui/copy-button';
import { Guarded } from '@/shared/ui/guarded';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { SectionCard } from '@/shared/ui/page-header';
import { RadioGroup, RadioGroupItem } from '@/shared/ui/radio-group';
import { Skeleton } from '@/shared/ui/skeleton';
import { ErrorState } from '@/shared/ui/states';

export function EndpointOverview({ ep }: { ep: Endpoint }) {
  const { can } = useCurrentWorkspace();
  const update = useUpdateEndpoint();
  const stats = useEndpointStats(ep.id, 7);
  const [mode, setMode] = useState(ep.mode);
  const [hook, setHook] = useState(ep.webhookUrl ?? '');
  const [rpm, setRpm] = useState(ep.rateLimitRpm);
  useEffect(() => {
    setMode(ep.mode);
    setHook(ep.webhookUrl ?? '');
    setRpm(ep.rateLimitRpm);
  }, [ep.mode, ep.webhookUrl, ep.rateLimitRpm]);
  const dirty = mode !== ep.mode || hook !== (ep.webhookUrl ?? '') || rpm !== ep.rateLimitRpm;
  const editable = can('deploy');

  const save = () =>
    update.mutate({ id: ep.id, mode, webhook_url: hook || null, rate_limit_rpm: rpm }, { onSuccess: () => toast.success('설정을 저장했습니다.'), onError: (e) => toast.error(e.message) });
  const redeploy = () =>
    update.mutate({ id: ep.id, redeploy: true }, { onSuccess: () => toast.success('최신 워크플로로 배포를 업데이트했습니다.'), onError: (e) => toast.error(isApiError(e) ? e.detail : e.message) });

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <SectionCard title="API 엔드포인트" actions={<Badge variant={ep.isActive ? 'green' : 'gray'}>{ep.isActive ? `배포됨 · v${ep.version}` : '꺼짐'}</Badge>}>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <code className="bg-surface min-w-0 flex-1 truncate rounded-md border px-3 py-2 font-mono text-sm" data-testid="endpoint-url">
              {ep.url}
            </code>
            <CopyButton value={ep.url} label="URL 복사" />
          </div>
          <fieldset className="space-y-2" disabled={!editable}>
            <legend className="text-sm font-medium">호출 방식</legend>
            <RadioGroup value={mode} onValueChange={(v) => setMode(v as 'sync' | 'async')} className="flex gap-5">
              <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="sync" disabled={!editable} /> 동기 · 결과 바로 반환</label>
              <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="async" disabled={!editable} /> 비동기 · job + 웹훅</label>
            </RadioGroup>
          </fieldset>
          <div className="grid grid-cols-[1fr_120px] gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ep-hook">완료 콜백 Webhook</Label>
              <Input id="ep-hook" value={hook} onChange={(e) => setHook(e.target.value)} placeholder="https://내-서버/moa-callback" disabled={!editable} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ep-rpm">분당 한도</Label>
              <Input id="ep-rpm" type="number" min={1} value={rpm} onChange={(e) => setRpm(Number(e.target.value))} disabled={!editable} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Guarded allowed={editable} reason={copy.common.viewerReason}>
              <Button onClick={save} disabled={!dirty || update.isPending}>{update.isPending ? <Loader2 className="animate-spin" aria-hidden /> : null}설정 저장</Button>
            </Guarded>
            <Guarded allowed={editable} reason={copy.common.viewerReason}>
              <Button variant="outline" onClick={redeploy} disabled={update.isPending}>
                <RefreshCw aria-hidden /> 배포 업데이트
              </Button>
            </Guarded>
          </div>
        </div>
      </SectionCard>
      <SectionCard title="최근 7일 호출">
        {stats.isPending ? (
          <Skeleton className="h-44" />
        ) : stats.isError ? (
          <ErrorState compact error={stats.error} onRetry={() => void stats.refetch()} />
        ) : (
          <>
            <p className="text-muted mb-2 text-sm">
              총 <b className="text-foreground tabular-nums">{stats.data!.reduce((s, d) => s + d.calls, 0).toLocaleString('ko-KR')}</b>회 · 오류 {stats.data!.reduce((s, d) => s + d.errors, 0)}회
            </p>
            <BarChart label="최근 7일 일별 호출 수" data={stats.data!.map((d) => ({ label: d.date, value: d.calls, hint: `오류 ${d.errors}회 · p50 ${(d.p50_ms / 1000).toFixed(1)}초` }))} />
          </>
        )}
      </SectionCard>
      <SectionCard className="xl:col-span-2">
        <ApiKeysCard compact />
      </SectionCard>
      <SectionCard title="다른 실행 경로" className="xl:col-span-2">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[
            { t: '웹 채팅 위젯', d: '자사 웹사이트에 붙이는 대화창', a: <CopyButton value={embedSnippet(ep.url)} label="임베드 코드 복사" /> },
            { t: 'UI 버튼', d: '워크스페이스 홈 · 외부 페이지 실행 버튼', a: <CopyButton value={`<button data-moa-endpoint="${ep.url}">${ep.agentName} 실행</button>`} label="버튼 코드 복사" /> },
            { t: '슬래시 명령', d: '⌘K 팔레트에서 바로 실행. 부족한 입력은 되물어 받음', a: <code className="bg-surface rounded px-2 py-1 font-mono text-xs">/{ep.slug} [내용]</code> },
            { t: 'Slack 봇', d: '@MOA 멘션으로 대화', a: <Button size="sm" variant="outline" disabled title="1차 범위 밖(설계서 미결 7)">Slack에 연결 (준비 중)</Button> },
          ].map((x) => (
            <div key={x.t} className="rounded-lg border p-4">
              <p className="font-semibold">{x.t}</p>
              <p className="text-muted mt-1 mb-3 text-xs">{x.d}</p>
              {x.a}
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
