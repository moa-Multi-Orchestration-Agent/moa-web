import { Suspense } from 'react';
import { SessionGate } from '@/features/auth';
import { AppShell } from './_shell/app-shell';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense>
      <SessionGate>
        <AppShell>{children}</AppShell>
      </SessionGate>
    </Suspense>
  );
}
