'use client';

import { useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { Kbd } from '@/shared/ui/kbd';

/** 단축키 표. MMI 정의서 원본이 이 저장소에 없어 design.md 3.4.5와 편집기 요구(prompts 3-6)를 기준으로 정했다. */
export const SHORTCUTS: { group: string; items: [string[], string][] }[] = [
  {
    group: '전체',
    items: [
      [['⌘', 'K'], '커맨드 팔레트 열기'],
      [['/'], '명령 입력(팔레트에서 /슬러그 실행)'],
      [['?'], '단축키 도움말'],
      [['G', 'H'], '홈으로'],
      [['G', 'S'], '스튜디오로'],
      [['G', 'R'], '실행 로그로'],
    ],
  },
  {
    group: '워크플로 편집기',
    items: [
      [['⌘', 'Z'], '실행 취소'],
      [['⇧', '⌘', 'Z'], '다시 실행'],
      [['⌘', 'C'], '선택 노드 복사'],
      [['⌘', 'V'], '붙여넣기'],
      [['Delete'], '선택 노드·연결 삭제'],
      [['⌘', 'A'], '전체 선택'],
      [['방향키'], '선택 노드 이동(⇧ 함께 누르면 크게)'],
      [['Tab'], '다음 노드 선택'],
      [['⌘', 'Enter'], '테스트 실행'],
      [['⌘', 'S'], '지금 저장'],
      [['L'], '자동 정렬'],
    ],
  },
  {
    group: '에이전트 빌더',
    items: [
      [['⌘', 'S'], '저장'],
      [['Enter'], '테스트 메시지 보내기'],
      [['⇧', 'Enter'], '메시지 줄바꿈'],
    ],
  },
];

export function ShortcutHelp({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))) return;
      if (e.key === '?' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        onOpenChange(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>단축키</DialogTitle>
          <DialogDescription>키보드만으로 화면을 다룰 수 있습니다. Windows에서는 ⌘ 대신 Ctrl을 누르세요.</DialogDescription>
        </DialogHeader>
        <div className="grid max-h-[60vh] gap-5 overflow-y-auto">
          {SHORTCUTS.map((g) => (
            <section key={g.group}>
              <h3 className="text-muted mb-2 text-xs font-semibold">{g.group}</h3>
              <dl className="divide-y rounded-md border">
                {g.items.map(([keys, label]) => (
                  <div key={label} className="flex items-center justify-between px-3 py-2 text-sm">
                    <dt>{label}</dt>
                    <dd className="flex gap-1">
                      {keys.map((k) => (
                        <Kbd key={k}>{k}</Kbd>
                      ))}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
