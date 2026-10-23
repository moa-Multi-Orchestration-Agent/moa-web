import Link from 'next/link';
import { marketCategoryLabel, type Product } from '@/entities/product';
import { formatKrw, formatNumber } from '@/shared/lib/format';
import { Badge } from '@/shared/ui/badge';
import { Stars } from './rating';

export function priceText(p: Pick<Product, 'priceCloneKrw' | 'priceApiMonthKrw' | 'licenseTypes'>) {
  if (p.licenseTypes.includes('api_sub') && p.priceApiMonthKrw !== null) return `월 ${formatKrw(p.priceApiMonthKrw)}`;
  return formatKrw(p.priceCloneKrw ?? 0);
}

/** Figma 13 라이선스 배지: API 전용(주황) · 복제 가능(초록) · 무료 공유(회색) */
export function licenseBadge(p: Pick<Product, 'licenseTypes' | 'priceCloneKrw'>) {
  if (!p.licenseTypes.includes('clone')) return <Badge variant="orange">API 전용</Badge>;
  if (p.priceCloneKrw === 0) return <Badge variant="gray">무료 공유</Badge>;
  return <Badge variant="green">복제 가능</Badge>;
}

export function ProductCard({ p }: { p: Product }) {
  return (
    <article className="bg-card hover:border-primary/40 flex flex-col overflow-hidden rounded-lg border transition-colors">
      <Link href={`/market/${p.id}`} className="flex flex-1 flex-col" aria-label={`${p.title} 상세`}>
        <div className="bg-surface-strong/60 flex h-[110px] items-center justify-center border-b text-4xl" aria-hidden>
          {p.icon}
        </div>
        <div className="flex flex-1 flex-col p-4">
          <div className="flex flex-wrap gap-1">
            <Badge variant={p.kind === 'agent' ? 'blue' : 'gray'}>{p.kind === 'agent' ? '에이전트' : '워크플로'}</Badge>
            {licenseBadge(p)}
            <Badge variant="gray">{marketCategoryLabel(p.category)}</Badge>
            {p.ownedLicense ? <Badge variant="dark">보유 중</Badge> : null}
          </div>
          <h3 className="mt-2 font-bold">{p.title}</h3>
          <p className="text-muted text-xs">{p.mine ? `${p.sellerName} (내 상품)` : p.sellerName}</p>
          <p className="text-muted mt-1 line-clamp-2 text-[13px]">{p.summary}</p>
          <div className="mt-auto flex items-end justify-between pt-3">
            <span className="text-muted flex items-center gap-1 text-xs">
              <Stars value={p.ratingAvg} /> {p.ratingAvg.toFixed(1)} · 설치 {formatNumber(p.installCount)}
            </span>
            <span className="font-bold">{priceText(p)}</span>
          </div>
        </div>
      </Link>
    </article>
  );
}
