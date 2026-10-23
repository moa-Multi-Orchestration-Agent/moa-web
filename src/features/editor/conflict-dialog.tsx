'use client';

import { useQueryClient } from '@tanstack/react-query';
import { workflowKeys } from '@/entities/workflow';
import { relativeTime } from '@/shared/lib/format';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { toDefinition } from './convert';
import { useEditorStore } from './store';

/** 409 충돌: 내 변경과 서버 최신본 비교 요약 + 선택 */
export function ConflictDialog({ onOverwrite }: { onOverwrite: () => void }) {
  const conflict = useEditorStore((s) => s.conflict);
  const nodes = useEditorStore((s) => s.nodes);
  const edges = useEditorStore((s) => s.edges);
  const qc = useQueryClient();
  if (!conflict) return null;
  const mine = toDefinition(nodes, edges);
  const theirs = conflict.draft;
  const mineIds = new Map(mine.nodes.map((n) => [n.id, n]));
  const theirIds = new Map(theirs.nodes.map((n) => [n.id, n]));
  const onlyMine = mine.nodes.filter((n) => !theirIds.has(n.id));
  const onlyTheirs = theirs.nodes.filter((n) => !mineIds.has(n.id));
  const changed = mine.nodes.filter((n) => {
    const t = theirIds.get(n.id);
    return t && JSON.stringify({ ...n, position: undefined }) !== JSON.stringify({ ...t, position: undefined });
  });
  const rows: [string, React.ReactNode][] = [
    ['노드 수', `내 것 ${mine.nodes.length}개 · 서버 ${theirs.nodes.length}개`],
    ['연결 수', `내 것 ${mine.edges.length}개 · 서버 ${theirs.edges.length}개`],
    ['내게만 있는 노드', onlyMine.map((n) => n.name).join(', ') || '없음'],
    ['서버에만 있는 노드', onlyTheirs.map((n) => n.name).join(', ') || '없음'],
    ['설정이 다른 노드', changed.map((n) => n.name).join(', ') || '없음'],
  ];

  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent showCloseButton={false} className="max-w-lg" onEscapeKeyDown={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>다른 곳에서 먼저 저장했습니다</DialogTitle>
          <DialogDescription>
            같은 워크플로를 다른 탭이나 팀원이 {relativeTime(conflict.updated_at)} 저장했습니다(서버 버전 <Badge variant="gray">{conflict.draft_version}</Badge>). 어느 쪽을 남길지 고르세요.
          </DialogDescription>
        </DialogHeader>
        <dl className="divide-y rounded-md border text-sm" data-testid="conflict-summary">
          {rows.map(([k, v]) => (
            <div key={k} className="grid grid-cols-[130px_1fr] gap-2 px-3 py-2">
              <dt className="text-muted">{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => {
              useEditorStore.getState().loadServer(conflict);
              void qc.invalidateQueries({ queryKey: workflowKeys.all });
            }}
          >
            서버 것 불러오기
          </Button>
          <Button
            onClick={() => {
              useEditorStore.getState().adoptServerVersion(conflict.draft_version);
              onOverwrite();
            }}
          >
            내 것으로 덮어쓰기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
