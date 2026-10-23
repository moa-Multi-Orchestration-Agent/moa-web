'use client';

import { useMemo, useState } from 'react';
import { Download, Eye, EyeOff, Loader2, Play, RotateCw } from 'lucide-react';
import { toast } from 'sonner';
import { useIssueKey } from '@/entities/api-key';
import { invokeEndpoint, useOpenApi, useRedeliver, useWebhookDeliveries, type Endpoint, type InvokeResult } from '@/entities/endpoint';
import { exampleFromSchema } from '@/entities/workflow';
import { useCurrentWorkspace } from '@/entities/workspace';
import { codeSamples } from '@/features/deploy/code-samples';
import { copy } from '@/shared/lib/copy';
import { formatDateTime } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { CopyButton } from '@/shared/ui/copy-button';
import { Guarded } from '@/shared/ui/guarded';
import { Input } from '@/shared/ui/input';
import { JsonViewer } from '@/shared/ui/json-viewer';
import { Label } from '@/shared/ui/label';
import { SectionCard } from '@/shared/ui/page-header';
import { Skeleton } from '@/shared/ui/skeleton';
import { EmptyState, ErrorState, ListSkeleton } from '@/shared/ui/states';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import { Textarea } from '@/shared/ui/textarea';

export function ExamplesTab({ ep }: { ep: Endpoint }) {
  const [lang, setLang] = useState<'curl' | 'js' | 'py'>('curl');
  const samples = useMemo(() => codeSamples(ep.url, exampleFromSchema(ep.inputSchema), ep.mode), [ep]);
  return (
    <SectionCard title="호출 예시" actions={<span className="text-muted text-xs">입력 스키마로 자동 생성</span>}>
      <div role="tablist" aria-label="언어" className="mb-3 flex gap-4 border-b">
        {([['curl', 'cURL'], ['js', 'JavaScript'], ['py', 'Python']] as const).map(([k, l]) => (
          <button key={k} role="tab" type="button" aria-selected={lang === k} onClick={() => setLang(k)} className={cn('-mb-px border-b-2 pb-2 text-sm', lang === k ? 'border-foreground font-bold' : 'text-muted border-transparent')}>
            {l}
          </button>
        ))}
      </div>
      <div className="relative">
        <pre className="max-h-[420px] overflow-auto rounded-lg bg-[#1C1C1A] p-4 font-mono text-xs leading-5 text-[#ECEDEF]" data-testid="code-sample">{samples[lang]}</pre>
        <div className="absolute top-2 right-2">
          <CopyButton value={samples[lang]} label="코드 복사" />
        </div>
      </div>
      <p className="text-muted mt-3 text-xs">
        응답 예: 동기 <code>{'{ run_id, status, output, usage{tokens_in,tokens_out,cost_usd}, latency_ms }'}</code>, 비동기 202 <code>{'{ job_id, status_url, events_url }'}</code>. 오류는 Problem Details(`code`, `detail`, `retryable`).
      </p>
    </SectionCard>
  );
}

export function OpenApiTab({ ep }: { ep: Endpoint }) {
  const q = useOpenApi(ep.id);
  const download = () => {
    const blob = new Blob([JSON.stringify(q.data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${ep.slug}-openapi.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <SectionCard
      title="OpenAPI 3.1"
      actions={
        <Button size="sm" variant="outline" onClick={download} disabled={!q.data}>
          <Download aria-hidden /> JSON 다운로드
        </Button>
      }
    >
      {q.isPending ? <Skeleton className="h-80" /> : q.isError ? <ErrorState error={q.error} onRetry={() => void q.refetch()} /> : <JsonViewer value={q.data} label="OpenAPI 문서" />}
      <p className="text-muted mt-2 text-xs">공개 주소: {ep.url}/openapi.json</p>
    </SectionCard>
  );
}

type Prop = { type?: string; description?: string; enum?: string[] };

export function PlaygroundTab({ ep }: { ep: Endpoint }) {
  const props = (ep.inputSchema.properties ?? {}) as Record<string, Prop>;
  const required = (ep.inputSchema.required as string[] | undefined) ?? [];
  const example = useMemo(() => exampleFromSchema(ep.inputSchema), [ep.inputSchema]);
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(Object.entries(example).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)])));
  const [key, setKey] = useState('');
  const [idem, setIdem] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<InvokeResult | null>(null);
  const issue = useIssueKey();
  const { can } = useCurrentWorkspace();
  const path = new URL(ep.url).pathname;

  const call = async () => {
    const body: Record<string, unknown> = {};
    for (const [k, p] of Object.entries(props)) {
      const v = values[k];
      if (v === undefined || v === '') continue;
      body[k] = p.type === 'number' || p.type === 'integer' ? Number(v) : p.type === 'boolean' ? v === 'true' : p.type === 'object' || p.type === 'array' ? safeJson(v) : v;
    }
    setBusy(true);
    try {
      setResult(await invokeEndpoint(path, key.trim(), body, { idempotencyKey: idem || undefined }));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <SectionCard title="요청">
        <form onSubmit={(e) => { e.preventDefault(); void call(); }} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="pg-key">API 키</Label>
            <div className="flex gap-2">
              <Input id="pg-key" value={key} onChange={(e) => setKey(e.target.value)} placeholder="moa_live_…" className="font-mono text-xs" autoComplete="off" />
              <Guarded allowed={can('manageKeys')} reason={copy.common.adminOnly}>
                <Button type="button" variant="outline" onClick={() => issue.mutate({ name: '플레이그라운드', expires_at: new Date(Date.now() + 86_400_000).toISOString() }, { onSuccess: (k) => { setKey(k.key); toast.success('하루짜리 테스트 키를 발급해 넣었습니다.'); } })} disabled={issue.isPending}>
                  테스트 키 발급
                </Button>
              </Guarded>
            </div>
          </div>
          {Object.entries(props).map(([k, p]) => (
            <div key={k} className="space-y-1.5">
              <Label htmlFor={`pg-${k}`}>
                {k}
                {required.includes(k) ? <span className="text-danger"> *</span> : null} <span className="text-muted font-normal">· {p.type}</span>
              </Label>
              {p.type === 'object' || p.type === 'array' ? (
                <Textarea id={`pg-${k}`} value={values[k] ?? ''} onChange={(e) => setValues((s) => ({ ...s, [k]: e.target.value }))} className="font-mono text-xs" />
              ) : (
                <Input id={`pg-${k}`} value={values[k] ?? ''} onChange={(e) => setValues((s) => ({ ...s, [k]: e.target.value }))} placeholder={p.description} />
              )}
            </div>
          ))}
          <div className="space-y-1.5">
            <Label htmlFor="pg-idem">Idempotency-Key (선택)</Label>
            <Input id="pg-idem" value={idem} onChange={(e) => setIdem(e.target.value)} className="font-mono text-xs" />
          </div>
          <Button type="submit" disabled={busy || !key.trim()} data-testid="playground-call">
            {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Play aria-hidden />} 호출
          </Button>
        </form>
      </SectionCard>
      <SectionCard title="응답">
        {!result ? (
          <EmptyState title="아직 호출하지 않았어요" description="키를 넣고 호출하면 상태 코드·헤더·본문이 여기 보입니다." />
        ) : (
          <div className="space-y-3" data-testid="playground-result">
            <p className="flex items-center gap-2 text-sm">
              <Badge variant={result.status < 300 ? 'green' : result.status < 500 ? 'orange' : 'red'}>HTTP {result.status}</Badge>
              <span className="text-muted">{result.ms}ms</span>
              {result.headers['x-ratelimit-remaining'] ? <span className="text-muted">남은 한도 {result.headers['x-ratelimit-remaining']}/{result.headers['x-ratelimit-limit']}</span> : null}
            </p>
            <JsonViewer value={result.body} label="응답 본문" />
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function safeJson(v: string) {
  try {
    return JSON.parse(v);
  } catch {
    return v;
  }
}

export function WebhookTab({ ep }: { ep: Endpoint }) {
  const [show, setShow] = useState(false);
  const q = useWebhookDeliveries(ep.id);
  const redeliver = useRedeliver(ep.id);
  const { can } = useCurrentWorkspace();
  const secret = ep.webhookSecret;
  return (
    <div className="space-y-5">
      <SectionCard title="서명">
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="text-muted text-xs">수신 주소</dt>
            <dd className="font-mono">{ep.webhookUrl ?? '설정 안 함 — 개요 탭에서 넣으세요'}</dd>
          </div>
          <div>
            <dt className="text-muted text-xs">서명 비밀</dt>
            <dd className="flex items-center gap-2">
              {secret ? (
                <>
                  <code className="font-mono text-xs">{show ? secret : `${secret.slice(0, 8)}${'•'.repeat(16)}`}</code>
                  <Button size="icon-sm" variant="ghost" onClick={() => setShow((v) => !v)} aria-label={show ? '서명 비밀 가리기' : '서명 비밀 보기'}>
                    {show ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
                  </Button>
                  <CopyButton value={secret} iconOnly label="서명 비밀 복사" variant="ghost" />
                </>
              ) : (
                <span className="text-muted">뷰어 권한에서는 볼 수 없습니다.</span>
              )}
            </dd>
          </div>
        </dl>
        <pre className="bg-surface mt-4 overflow-auto rounded-md p-3 font-mono text-xs">{`X-MOA-Signature: t={timestamp},v1={HMAC_SHA256(secret, "{timestamp}.{raw_body}")}
수신 측: |now - t| <= 300초, 상수 시간 비교 (design.md 1.5.1)
실패 시 1분·5분·30분·2시간 재시도, 5회 실패하면 웹훅 비활성`}</pre>
      </SectionCard>
      <SectionCard title="최근 전송 기록" bodyClassName="p-0 pt-3">
        {q.isPending ? (
          <div className="p-5"><ListSkeleton rows={3} /></div>
        ) : q.isError ? (
          <div className="p-5"><ErrorState error={q.error} onRetry={() => void q.refetch()} /></div>
        ) : !q.data?.length ? (
          <div className="p-5"><EmptyState title="전송 기록이 없어요" description="비동기 실행이 끝나면 웹훅이 보내집니다." /></div>
        ) : (
          <Table>
            <TableHeader className="bg-surface">
              <TableRow>
                <TableHead>시각</TableHead>
                <TableHead>이벤트</TableHead>
                <TableHead>응답</TableHead>
                <TableHead>시도</TableHead>
                <TableHead>실행</TableHead>
                <TableHead className="w-24"><span className="sr-only">재전송</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {q.data.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="text-muted">{formatDateTime(d.created_at)}</TableCell>
                  <TableCell className="font-mono text-xs">{d.event}</TableCell>
                  <TableCell><Badge variant={d.ok ? 'green' : 'red'}>{d.ok ? '성공' : '실패'} {d.status_code}</Badge></TableCell>
                  <TableCell>{d.attempt}</TableCell>
                  <TableCell className="font-mono text-xs">run_{d.run_id.slice(-6)}</TableCell>
                  <TableCell>
                    <Guarded allowed={can('deploy')} reason={copy.common.viewerReason}>
                      <Button size="xs" variant="outline" onClick={() => redeliver.mutate(d.id, { onSuccess: () => toast.success('다시 보냈습니다.'), onError: (e) => toast.error(e.message) })} disabled={redeliver.isPending}>
                        <RotateCw aria-hidden /> 재전송
                      </Button>
                    </Guarded>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SectionCard>
    </div>
  );
}
