import Link from 'next/link';
import { copy } from '@/shared/lib/copy';

export function AuthCard({ title, subtitle, children, footer }: { title: string; subtitle: string; children: React.ReactNode; footer: React.ReactNode }) {
  return (
    <div className="w-full max-w-[400px]">
      <Link href="/home" className="mb-6 block text-center">
        <span className="text-3xl font-extrabold tracking-tight">{copy.app.name}</span>
        <span className="text-muted block text-xs">{copy.app.tagline}</span>
      </Link>
      <div className="bg-card rounded-lg border p-7 shadow-sm">
        <h1 className="text-title font-bold">{title}</h1>
        <p className="text-muted mt-1 text-sm">{subtitle}</p>
        <div className="mt-6">{children}</div>
      </div>
      <p className="text-muted mt-4 text-center text-sm">{footer}</p>
    </div>
  );
}
