import { cn } from '@/shared/lib/utils';

interface PageHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

/** Figma 공통 페이지 헤더: 제목 + 회색 설명 + 오른쪽 버튼 */
export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <header className={cn('flex flex-wrap items-end justify-between gap-4', className)}>
      <div className="min-w-0">
        <h1 className="text-[28px] leading-9 font-bold tracking-tight">{title}</h1>
        {description ? <p className="text-muted mt-1">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function PageContainer({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('mx-auto w-full max-w-[1200px] space-y-6 px-9 py-7', className)}>{children}</div>;
}

export function SectionCard({
  title,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn('bg-card rounded-lg border', className)}>
      {title || actions ? (
        <div className="flex items-center justify-between gap-2 px-5 pt-4">
          {title ? <h2 className="text-subtitle font-semibold">{title}</h2> : <span />}
          {actions}
        </div>
      ) : null}
      <div className={cn('p-5', bodyClassName)}>{children}</div>
    </section>
  );
}
