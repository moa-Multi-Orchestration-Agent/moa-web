'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, Loader2 } from 'lucide-react';
import { signupInputSchema, useSignup, type SignupInput } from '@/entities/user';
import { isApiError } from '@/shared/lib/api-client';
import { copy } from '@/shared/lib/copy';
import { Button } from '@/shared/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/ui/form';
import { Input } from '@/shared/ui/input';
import { AuthCard } from './auth-card';
import { safeRedirect } from './safe-redirect';
import { SocialButtons } from './social-buttons';

const FIELDS: { name: keyof SignupInput; label: string; type: string; auto: string }[] = [
  { name: 'display_name', label: copy.auth.displayName, type: 'text', auto: 'name' },
  { name: 'email', label: copy.auth.email, type: 'email', auto: 'email' },
  { name: 'password', label: copy.auth.password, type: 'password', auto: 'new-password' },
  { name: 'password_confirm', label: copy.auth.passwordConfirm, type: 'password', auto: 'new-password' },
];

export function SignupForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const redirect = safeRedirect(sp.get('redirect'));
  const signup = useSignup();
  const form = useForm<SignupInput>({
    resolver: zodResolver(signupInputSchema),
    defaultValues: { display_name: '', email: '', password: '', password_confirm: '' },
  });
  const done = () => router.replace(redirect);
  const onSubmit = form.handleSubmit((v) => signup.mutate(v, { onSuccess: done }));
  const serverError = signup.error ? (isApiError(signup.error) ? signup.error.detail : signup.error.message) : null;

  return (
    <AuthCard
      title={copy.auth.signupTitle}
      subtitle={copy.auth.signupSubtitle}
      footer={
        <>
          {copy.auth.hasAccount}{' '}
          <Link href="/login" className="text-primary font-medium hover:underline">
            {copy.auth.toLogin}
          </Link>
        </>
      }
    >
      <Form {...form}>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {FIELDS.map((f) => (
            <FormField
              key={f.name}
              control={form.control}
              name={f.name}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{f.label}</FormLabel>
                  <FormControl>
                    <Input type={f.type} autoComplete={f.auto} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ))}
          {serverError ? (
            <p role="alert" className="text-danger flex items-center gap-1.5 text-sm">
              <AlertCircle className="size-4" aria-hidden /> {serverError}
            </p>
          ) : null}
          <Button type="submit" className="w-full" disabled={signup.isPending}>
            {signup.isPending ? <Loader2 className="animate-spin" aria-hidden /> : null}
            {copy.auth.signupButton}
          </Button>
        </form>
      </Form>
      <div className="text-muted my-5 flex items-center gap-3 text-xs">
        <span className="h-px flex-1 bg-current opacity-20" />
        {copy.auth.or}
        <span className="h-px flex-1 bg-current opacity-20" />
      </div>
      <SocialButtons onDone={done} />
    </AuthCard>
  );
}
