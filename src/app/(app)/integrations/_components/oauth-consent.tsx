'use client';

import { ShieldCheck } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog';

/**
 * 제공자 OAuth 동의 화면 흉내(목). 실제로는 새 창에서 제공자 로그인 → redirect로 code를 받는다.
 * 허용하면 임의 code를 넘기고, 거부하면 서버 생성을 하지 않는다.
 */
export function OAuthConsentDialog({
  open,
  provider,
  onAllow,
  onDeny,
}: {
  open: boolean;
  provider: string;
  onAllow: (code: string) => void;
  onDeny: () => void;
}) {
  const host = provider || 'MCP 서버';
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onDeny()}>
      <DialogContent className="sm:max-w-md" data-testid="oauth-consent">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ShieldCheck className="text-primary size-5" aria-hidden /> {host} 로그인</DialogTitle>
          <DialogDescription>MOA가 {host} 계정에 접근하려고 합니다. 허용하면 다음 권한으로 도구를 가져옵니다.</DialogDescription>
        </DialogHeader>
        <ul className="bg-surface space-y-1.5 rounded-md border p-3 text-sm">
          <li>• 도구 목록 읽기</li>
          <li>• 에이전트 실행 중 도구 호출</li>
          <li>• 토큰 자동 갱신(언제든 연결 해제 가능)</li>
        </ul>
        <p className="text-muted text-xs">모의 동의 화면입니다. 실제 제공자 창은 열리지 않습니다.</p>
        <DialogFooter>
          <Button variant="outline" onClick={onDeny}>거부</Button>
          <Button onClick={() => onAllow(`mock-${Math.random().toString(36).slice(2, 10)}`)}>허용</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
