'use client';

import { useEffect } from 'react';
import { copy } from '@/shared/lib/copy';
import { ErrorState } from '@/shared/ui/states';

export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <ErrorState title={copy.errors.crashTitle} error={new Error(copy.errors.crashBody)} onRetry={reset} />
    </div>
  );
}
