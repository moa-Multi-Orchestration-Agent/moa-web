import type { Metadata } from 'next';
import { Suspense } from 'react';
import { SignupForm } from '@/features/auth';
import { copy } from '@/shared/lib/copy';

export const metadata: Metadata = { title: copy.pages.signup };

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}
