'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { BASE_URL_HINT, credentialFormSchema, LLM_PROVIDERS, providerInfo, useCreateCredential, useUpdateCredential, type Credential, type CredentialForm } from '@/entities/credential';
import { Button } from '@/shared/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';

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

/** 자격증명 추가. 모델 키는 API 주소(base URL)를 함께 넣을 수 있고, OpenAI 호환 서버는 주소가 필수·키는 선택이다. */
export function AddCredentialDialog({ open, onOpenChange, providers, modelKeysOnly }: { open: boolean; onOpenChange: (o: boolean) => void; providers: readonly { id: string; label: string }[]; modelKeysOnly?: boolean }) {
  const create = useCreateCredential();
  const blank = (): CredentialForm => ({ provider: providers[0]!.id, label: '', secret: '', base_url: '' });
  const [form, setForm] = useState<CredentialForm>(blank);
  const [errs, setErrs] = useState<Errs>({});
  const compat = form.provider === 'openai_compatible';

  const submit = () => {
    const r = credentialFormSchema.safeParse(form);
    if (!r.success) return setErrs(Object.fromEntries(r.error.issues.map((i) => [i.path[0], i.message])));
    setErrs({});
    const body = { ...r.data, base_url: isLlm(r.data.provider) ? r.data.base_url || undefined : undefined, purposes: [...(providerInfo(r.data.provider)?.purposes ?? [])] };
    create.mutate(body, {
      onSuccess: (c) => { toast.success(`"${c.label}"을(를) 암호화해 저장했습니다.`); onOpenChange(false); setForm(blank()); },
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
            <Input id="cred-label" value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} placeholder={isLlm(form.provider) ? '예: 팀 OpenRouter' : '예: 팀 메일 계정'} aria-invalid={!!errs.label} />
          </Field>
          {isLlm(form.provider) ? (
            <Field id="cred-base" label={compat ? 'API 주소 (base URL)' : 'API 주소 (선택)'} error={errs.base_url} hint={BASE_URL_HINT[form.provider]}>
              <Input id="cred-base" value={form.base_url ?? ''} onChange={(e) => setForm((f) => ({ ...f, base_url: e.target.value }))} placeholder={compat ? 'https://openrouter.ai/api/v1' : '비워 두면 기본 주소'} className="font-mono text-xs" aria-invalid={!!errs.base_url} />
            </Field>
          ) : null}
          <Field id="cred-secret" label={compat ? 'API 키 (없으면 비워 두세요)' : '값'} error={errs.secret}>
            <Input id="cred-secret" type="password" value={form.secret} onChange={(e) => setForm((f) => ({ ...f, secret: e.target.value }))} className="font-mono" aria-invalid={!!errs.secret} />
          </Field>
          <DialogFooter><Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>취소</Button><Button type="submit" disabled={create.isPending}>{create.isPending ? <Loader2 className="animate-spin" aria-hidden /> : null}저장</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** 이름·API 주소만 바꾼다. 키 값을 바꾸려면 새로 등록한다(평문을 다시 주고받지 않게). */
export function EditCredentialDialog({ credential, onOpenChange }: { credential: Credential | null; onOpenChange: (o: boolean) => void }) {
  const update = useUpdateCredential();
  const [label, setLabel] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (credential) { setLabel(credential.label); setBaseUrl(credential.baseUrl ?? ''); setErr(null); }
  }, [credential]);
  if (!credential) return null;
  const llm = isLlm(credential.provider);
  const submit = () => {
    const url = baseUrl.trim();
    if (!label.trim()) return setErr('이름을 입력하세요.');
    if (url && !/^https?:\/\/[^\s/?#]+/.test(url)) return setErr('http:// 또는 https://로 시작하는 주소를 넣으세요.');
    if (credential.provider === 'openai_compatible' && !url) return setErr('OpenAI 호환 서버는 주소가 필요합니다.');
    update.mutate({ id: credential.id, label: label.trim(), ...(llm ? { base_url: url || null } : {}) }, {
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
          {err ? <p className="text-danger text-xs" role="alert">{err}</p> : null}
          <DialogFooter><Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>취소</Button><Button type="submit" disabled={update.isPending}>{update.isPending ? <Loader2 className="animate-spin" aria-hidden /> : null}저장</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
