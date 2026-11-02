'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { passwordFormSchema, profileFormSchema, useChangePassword, useMe, useUpdateMe, type PasswordForm } from '@/entities/user';
import { isApiError } from '@/shared/lib/api-client';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { SectionCard } from '@/shared/ui/page-header';
import { Skeleton } from '@/shared/ui/skeleton';
import { ErrorState } from '@/shared/ui/states';

const EMPTY_PW: PasswordForm = { current_password: '', new_password: '', new_password_confirm: '' };

/** 내 계정: 이름 바꾸기, 비밀번호 바꾸기(다른 기기 세션은 끊김) */
export function AccountTab() {
  const me = useMe();
  const update = useUpdateMe();
  const change = useChangePassword();
  const [name, setName] = useState('');
  const [nameErr, setNameErr] = useState<string | null>(null);
  const [pw, setPw] = useState<PasswordForm>(EMPTY_PW);
  const [pwErr, setPwErr] = useState<Partial<Record<keyof PasswordForm, string>>>({});
  useEffect(() => { if (me.data) setName(me.data.displayName); }, [me.data]);

  if (me.isPending) return <Skeleton className="h-64 w-full" />;
  if (me.isError) return <ErrorState error={me.error} onRetry={() => void me.refetch()} />;
  const social = !!me.data.oauthProvider;

  const saveName = () => {
    const r = profileFormSchema.safeParse({ display_name: name });
    if (!r.success) return setNameErr(r.error.issues[0]!.message);
    setNameErr(null);
    update.mutate(r.data, { onSuccess: () => toast.success('이름을 바꿨습니다.'), onError: (e) => setNameErr(isApiError(e) ? e.detail : e.message) });
  };
  const savePw = () => {
    const r = passwordFormSchema.safeParse(pw);
    if (!r.success) return setPwErr(Object.fromEntries(r.error.issues.map((i) => [i.path[0], i.message])));
    setPwErr({});
    change.mutate(
      { current_password: r.data.current_password, new_password: r.data.new_password },
      {
        onSuccess: () => { toast.success('비밀번호를 바꿨습니다. 다른 기기에서는 다시 로그인해야 합니다.'); setPw(EMPTY_PW); },
        onError: (e) => {
          const field = isApiError(e) ? (e.errors?.[0]?.loc?.at(-1) as keyof PasswordForm | undefined) : undefined;
          setPwErr({ [field ?? 'current_password']: isApiError(e) ? e.detail : e.message });
        },
      },
    );
  };

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <SectionCard title="프로필">
        <form onSubmit={(e) => { e.preventDefault(); saveName(); }} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="me-email">이메일</Label>
            <Input id="me-email" value={me.data.email} disabled />
            {social ? <p className="text-muted text-xs">{me.data.oauthProvider} 계정으로 로그인했습니다.</p> : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="me-name">이름</Label>
            <Input id="me-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={30} aria-invalid={!!nameErr} />
            {nameErr ? <p role="alert" className="text-danger text-xs">{nameErr}</p> : <p className="text-muted text-xs">팀원 목록과 알림에 이 이름이 보입니다.</p>}
          </div>
          <Button type="submit" disabled={update.isPending || name.trim() === me.data.displayName}>{update.isPending ? <Loader2 className="animate-spin" aria-hidden /> : null}저장</Button>
        </form>
      </SectionCard>
      <SectionCard title="비밀번호 바꾸기">
        <form onSubmit={(e) => { e.preventDefault(); savePw(); }} className="space-y-4" autoComplete="off">
          {([
            ['current_password', '지금 비밀번호', 'current-password'],
            ['new_password', '새 비밀번호 (8자 이상)', 'new-password'],
            ['new_password_confirm', '새 비밀번호 확인', 'new-password'],
          ] as const).map(([k, label, ac]) => (
            <div key={k} className="space-y-1.5">
              <Label htmlFor={`pw-${k}`}>{label}</Label>
              <Input id={`pw-${k}`} type="password" autoComplete={ac} value={pw[k]} onChange={(e) => setPw((f) => ({ ...f, [k]: e.target.value }))} aria-invalid={!!pwErr[k]} />
              {pwErr[k] ? <p role="alert" className="text-danger text-xs">{pwErr[k]}</p> : null}
            </div>
          ))}
          <p className="text-muted text-xs">바꾸면 지금 이 기기를 뺀 다른 기기의 로그인이 모두 끊깁니다.</p>
          <Button type="submit" disabled={change.isPending}>{change.isPending ? <Loader2 className="animate-spin" aria-hidden /> : null}비밀번호 바꾸기</Button>
        </form>
      </SectionCard>
    </div>
  );
}
