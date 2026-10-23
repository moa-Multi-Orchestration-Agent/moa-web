'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, Loader2 } from 'lucide-react';
import { loginInputSchema, useLogin, useMe, type LoginInput } from '@/entities/user';
import { isApiError } from '@/shared/lib/api-client';
import { copy } from '@/shared/lib/copy';
import { Button } from '@/shared/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/ui/form';
import { Input } from '@/shared/ui/input';
import { AuthCard } from './auth-card';
import { safeRedirect } from './safe-redirect';
import { SocialButtons } from './social-buttons';

export function LoginForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const redirect = safeRedirect(sp.get('redirect'));
  const login = useLogin();
  const me = useMe();
  const form = useForm<LoginInput>({ resolver: zodResolver(loginInputSchema), defaultValues: { email: '', password: '' } });
  const done = () => router.replace(redirect);

  const onSubmit = form.handleSubmit((v) => login.mutate(v, { onSuccess: done }));
  const serverError = login.error ? (isApiError(login.error) ? login.error.detail : login.error.message) : null;

  return (
    <AuthCard
      title={copy.auth.loginTitle}
      subtitle={copy.auth.loginSubtitle}
      footer={
        <>
          {copy.auth.noAccount}{' '}
          <Link href={`/signup${sp.get('redirect') ? `?redirect=${encodeURIComponent(redirect)}` : ''}`} className="text-primary font-medium hover:underline">
            {copy.auth.toSignup}
          </Link>
        </>
      }
    >
      {me.data ? (
        <div className="bg-primary-soft mb-4 flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm">
          <span>{copy.auth.alreadyIn(me.data.displayName)}</span>
          <Button size="sm" variant="link" className="h-auto p-0" onClick={done}>
            {copy.auth.continue}
          </Button>
        </div>
      ) : null}
      <Form {...form}>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{copy.auth.email}</FormLabel>
                <FormControl>
                  <Input type="email" autoComplete="email" placeholder="you@company.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{copy.auth.password}</FormLabel>
                <FormControl>
                  <Input type="password" autoComplete="current-password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {serverError ? (
            <p role="alert" className="text-danger flex items-center gap-1.5 text-sm">
              <AlertCircle className="size-4" aria-hidden /> {serverError}
            </p>
          ) : null}
          <Button type="submit" className="w-full" disabled={login.isPending}>
            {login.isPending ? <Loader2 className="animate-spin" aria-hidden /> : null}
            {copy.auth.loginButton}
          </Button>
        </form>
      </Form>
      <div className="text-muted my-5 flex items-center gap-3 text-xs">
        <span className="h-px flex-1 bg-current opacity-20" />
        {copy.auth.or}
        <span className="h-px flex-1 bg-current opacity-20" />
      </div>
      <SocialButtons onDone={done} />
      {process.env.NEXT_PUBLIC_API_MOCKING === 'enabled' ? <p className="text-muted mt-5 text-xs">{copy.auth.mockHint}</p> : null}
    </AuthCard>
  );
}
