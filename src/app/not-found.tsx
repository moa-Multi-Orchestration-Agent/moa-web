import Link from 'next/link';
import { copy } from '@/shared/lib/copy';
import { Button } from '@/shared/ui/button';

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-muted font-mono text-sm">404</p>
      <h1 className="text-title font-bold">{copy.errors.notFoundTitle}</h1>
      <p className="text-muted">{copy.errors.notFoundBody}</p>
      <Button asChild className="mt-2">
        <Link href="/home">{copy.errors.goHome}</Link>
      </Button>
    </div>
  );
}
