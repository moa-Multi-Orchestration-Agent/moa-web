'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useLicenses } from '@/entities/license';
import { LICENSE_LABEL } from '@/entities/product';
import { ReviewDialog } from '@/features/market/review-dialog';
import { formatDate, formatKrw } from '@/shared/lib/format';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { PageContainer, PageHeader, SectionCard } from '@/shared/ui/page-header';
import { EmptyState, ErrorState, ListSkeleton } from '@/shared/ui/states';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';

export function PurchasesView() {
  const q = useLicenses();
  const [review, setReview] = useState<{ id: string; title: string } | null>(null);
  return (
    <PageContainer>
      <PageHeader title="구매 내역" description="구매한 라이선스와 만료일을 확인하고 리뷰를 남깁니다." actions={<Button variant="outline" asChild><Link href="/market">마켓으로</Link></Button>} />
      <SectionCard bodyClassName="p-0">
        {q.isPending ? <div className="p-5"><ListSkeleton rows={3} /></div> : q.isError ? <div className="p-5"><ErrorState error={q.error} onRetry={() => void q.refetch()} /></div> : !q.data!.length ? (
          <div className="p-5"><EmptyState title="구매한 상품이 없어요" description="마켓에서 필요한 에이전트를 찾아보세요." action={<Button asChild><Link href="/market">마켓 둘러보기</Link></Button>} /></div>
        ) : (
          <Table>
            <TableHeader className="bg-surface"><TableRow><TableHead>상품</TableHead><TableHead>라이선스</TableHead><TableHead>버전</TableHead><TableHead className="text-right">결제 금액</TableHead><TableHead>구매일</TableHead><TableHead>만료</TableHead><TableHead className="w-28"><span className="sr-only">리뷰</span></TableHead></TableRow></TableHeader>
            <TableBody>
              {q.data!.map((l) => {
                const expired = l.expiresAt && l.expiresAt < new Date().toISOString();
                return (
                  <TableRow key={l.id}>
                    <TableCell><Link href={`/market/${l.productId}`} className="font-medium hover:underline">{l.productTitle}</Link></TableCell>
                    <TableCell><Badge variant={l.type === 'clone' ? 'gray' : 'blue'}>{LICENSE_LABEL[l.type]}</Badge></TableCell>
                    <TableCell className="font-mono text-xs">v{l.semver}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatKrw(l.amountKrw)}</TableCell>
                    <TableCell className="text-muted">{formatDate(l.createdAt)}</TableCell>
                    <TableCell>{l.expiresAt ? <span className={expired ? 'text-danger' : ''}>{formatDate(l.expiresAt)}{expired ? ' (만료)' : ' · 자동 갱신'}</span> : '영구'}</TableCell>
                    <TableCell>{l.reviewed ? <Badge variant="green">리뷰 완료</Badge> : <Button size="sm" variant="outline" onClick={() => setReview({ id: l.id, title: l.productTitle })}>리뷰 쓰기</Button>}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </SectionCard>
      {review ? <ReviewDialog licenseId={review.id} title={review.title} open onOpenChange={(o) => !o && setReview(null)} /> : null}
    </PageContainer>
  );
}
