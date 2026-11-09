'use client';

import { useEffect, useState } from 'react';
import { CloudDownload, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { BASE_URL_HINT, credentialFormSchema, LLM_PROVIDERS, parseModelIds, providerInfo, useCreateCredential, useTestCredential, useUpdateCredential, type Credential, type CredentialForm } from '@/entities/credential';
import { Button } from '@/shared/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Textarea } from '@/shared/ui/textarea';

const isLlm = (p: string) => (LLM_PROVIDERS as readonly string[]).includes(p);
type Errs = Partial<Record<keyof CredentialForm, string>>;

function Field({ id, label, error, hint, children }: { id: string; label: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? <p className="text-danger text-xs">{error}</p> : hint ? <p className="text-muted text-xs">{hint}</p> : null}
    </div>
  );
}

const MODELS_HINT = '이 키로 쓸 모델 id를 쉼표나 줄바꿈으로 적으세요. 노드·에이전트의 모델 목록에 이 키 이름으로 나옵니다.';

/** 외부 AI 키의 모델 id 입력칸 */
function ModelIdsField({ id, value, onChange, action }: { id: string; value: string; onChange: (v: string) => void; action?: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between"><Label htmlFor={id}>쓸 모델 (선택)</Label>{action}</div>
      <Textarea id={id} value={value} onChange={(e) => onChange(e.target.value)} placeholder={'gpt-4.1\nclaude-sonnet-4'} rows={3} className="font-mono text-xs" />
      <p className="text-muted text-xs">{MODELS_HINT}</p>
    </div>
  );
}

/** 자격증명 추가. 모델 키는 API 주소(base URL)를 함께 넣을 수 있고, 외부 AI 키는 주소가 필수·키는 선택이다. */
export function AddCredentialDialog({ open, onOpenChange, providers, modelKeysOnly }: { open: boolean; onOpenChange: (o: boolean) => void; providers: readonly { id: string; label: string }[]; modelKeysOnly?: boolean }) {
  const create = useCreateCredential();
  const blank = (): CredentialForm => ({ provider: providers[0]!.id, label: '', secret: '', base_url: '' });
  const [form, setForm] = useState<CredentialForm>(blank);
  const [errs, setErrs] = useState<Errs>({});
  const [modelsText, setModelsText] = useState('');
  const compat = form.provider === 'openai_compatible';

  const submit = () => {
    const r = credentialFormSchema.safeParse(form);
    if (!r.success) return setErrs(Object.fromEntries(r.error.issues.map((i) => [i.path[0], i.message])));
    setErrs({});
    const body = { ...r.data, base_url: isLlm(r.data.provider) ? r.data.base_url || undefined : undefined, models: compat ? parseModelIds(modelsText) : undefined, purposes: [...(providerInfo(r.data.provider)?.purposes ?? [])] };
    create.mutate(body, {
      onSuccess: (c) => { toast.success(`"${c.label}"을(를) 암호화해 저장했습니다.`); onOpenChange(false); setForm(blank()); setModelsText(''); },
      onError: (e) => toast.error(e.message),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="space-y-4" autoComplete="off">
          <DialogHeader><DialogTitle>{modelKeysOnly ? '모델 키 추가' : '자격증명 추가'}</DialogTitle><DialogDescription>값은 AES-256-GCM 봉투 암호화로 저장되고, 저장 후에는 다시 볼 수 없습니다(design.md 2.4.2).</DialogDescription></DialogHeader>
          <Field id="cred-provider" label="제공자">
            <Select value={form.provider} onValueChange={(v) => setForm((f) => ({ ...f, provider: v }))}><SelectTrigger id="cred-provider" className="w-full"><SelectValue /></SelectTrigger><SelectContent>{providers.map((p) => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}</SelectContent></Select>
          </Field>
          <Field id="cred-label" label="이름" error={errs.label}>
            <Input id="cred-label" value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} placeholder={compat ? '예: MonoGPT' : isLlm(form.provider) ? '예: 팀 OpenAI' : '예: 팀 메일 계정'} aria-invalid={!!errs.label} />
          </Field>
          {isLlm(form.provider) ? (
            <Field id="cred-base" label={compat ? 'API 주소 (base URL)' : 'API 주소 (선택)'} error={errs.base_url} hint={BASE_URL_HINT[form.provider]}>
              <Input id="cred-base" value={form.base_url ?? ''} onChange={(e) => setForm((f) => ({ ...f, base_url: e.target.value }))} placeholder={compat ? 'https://openrouter.ai/api/v1' : '비워 두면 기본 주소'} className="font-mono text-xs" aria-invalid={!!errs.base_url} />
            </Field>
          ) : null}
          <Field id="cred-secret" label={compat ? 'API 키 (없으면 비워 두세요)' : '값'} error={errs.secret}>
            <Input id="cred-secret" type="password" value={form.secret} onChange={(e) => setForm((f) => ({ ...f, secret: e.target.value }))} className="font-mono" aria-invalid={!!errs.secret} />
          </Field>
          {compat ? <ModelIdsField id="cred-models" value={modelsText} onChange={setModelsText} /> : null}
          <DialogFooter><Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>취소</Button><Button type="submit" disabled={create.isPending}>{create.isPending ? <Loader2 className="animate-spin" aria-hidden /> : null}저장</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** 이름·API 주소·모델 목록만 바꾼다. 키 값을 바꾸려면 새로 등록한다(평문을 다시 주고받지 않게). */
export function EditCredentialDialog({ credential, onOpenChange }: { credential: Credential | null; onOpenChange: (o: boolean) => void }) {
  const update = useUpdateCredential();
  const [label, setLabel] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [modelsText, setModelsText] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const test = useTestCredential();
  useEffect(() => {
    if (credential) { setLabel(credential.label); setBaseUrl(credential.baseUrl ?? ''); setModelsText((credential.models ?? []).join('\n')); setErr(null); }
  }, [credential]);
  if (!credential) return null;
  const llm = isLlm(credential.provider);
  const compat = credential.provider === 'openai_compatible';
  // 저장된 주소·키로 서버의 모델 목록을 불러와 채운다(주소를 바꿨다면 먼저 저장)
  const loadModels = () =>
    test.mutate(credential.id, {
      onSuccess: (r) => {
        if (r.ok && r.models?.length) { setModelsText(r.models.join('\n')); toast.success(`모델 ${r.models.length}개를 불러왔습니다. 쓸 것만 남기고 저장하세요.`); }
        else if (r.ok) toast.info(r.checked ? '서버가 모델 목록을 주지 않았습니다. 직접 적어 주세요.' : r.message);
        else toast.error(r.message);
      },
      onError: (e) => toast.error(e.message),
    });
  const submit = () => {
    const url = baseUrl.trim();
    if (!label.trim()) return setErr('이름을 입력하세요.');
    if (url && !/^https?:\/\/[^\s/?#]+/.test(url)) return setErr('http:// 또는 https://로 시작하는 주소를 넣으세요.');
    if (compat && !url) return setErr('외부 AI 키는 API 주소가 필요합니다.');
    update.mutate({ id: credential.id, label: label.trim(), ...(llm ? { base_url: url || null } : {}), ...(compat ? { models: parseModelIds(modelsText) } : {}) }, {
      onSuccess: () => { toast.success('저장했습니다.'); onOpenChange(false); },
      onError: (e) => setErr(e.message),
    });
  };
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="space-y-4" autoComplete="off">
          <DialogHeader><DialogTitle>&quot;{credential.label}&quot; 수정</DialogTitle><DialogDescription>키 값은 바꿀 수 없습니다. 값을 바꾸려면 새로 추가하고 이 항목을 지우세요.</DialogDescription></DialogHeader>
          <Field id="cred-edit-label" label="이름"><Input id="cred-edit-label" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={40} /></Field>
          {llm ? (
            <Field id="cred-edit-base" label="API 주소 (base URL)" hint={BASE_URL_HINT[credential.provider]}>
              <Input id="cred-edit-base" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} className="font-mono text-xs" placeholder="비워 두면 기본 주소" />
            </Field>
          ) : null}
          {compat ? (
            <ModelIdsField
              id="cred-edit-models"
              value={modelsText}
              onChange={setModelsText}
              action={<Button type="button" size="xs" variant="ghost" onClick={loadModels} disabled={test.isPending}>{test.isPending ? <Loader2 className="animate-spin" aria-hidden /> : <CloudDownload aria-hidden />} 서버에서 불러오기</Button>}
            />
          ) : null}
          {err ? <p className="text-danger text-xs" role="alert">{err}</p> : null}
          <DialogFooter><Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>취소</Button><Button type="submit" disabled={update.isPending}>{update.isPending ? <Loader2 className="animate-spin" aria-hidden /> : null}저장</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
