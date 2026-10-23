'use client';

import { Check, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useFollowSeller, useSeller } from '@/entities/product';
import { Button } from '@/shared/ui/button';

export function FollowButton({ name, disabled }: { name: string; disabled?: boolean }) {
  const seller = useSeller(name);
  const follow = useFollowSeller(name);
  const on = !!seller.data?.following;
  return (
    <Button
      variant={on ? 'secondary' : 'outline'}
      aria-pressed={on}
      disabled={disabled || seller.isPending || follow.isPending}
      onClick={() => follow.mutate(!on, { onSuccess: () => toast.success(on ? `${name} 팔로우를 끊었습니다.` : `${name}의 새 상품 소식을 받습니다.`), onError: (e) => toast.error(e.message) })}
      data-testid="follow"
    >
      {on ? <Check aria-hidden /> : <Plus aria-hidden />} {on ? '팔로우 중' : '제작자 팔로우'}
      {seller.data ? <span className="text-muted text-xs tabular-nums">{seller.data.follower_count}</span> : null}
    </Button>
  );
}
