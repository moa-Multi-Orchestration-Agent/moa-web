'use client';

import { useQueryClient } from '@tanstack/react-query';
import { FileText, Trash2, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useDeleteKbDocument, useKbDocuments, useKnowledgeBases, useUploadKbDocument, type KbDocument } from '@/entities/credential';
import { useCurrentWorkspace } from '@/entities/workspace';
import { formatDate, relativeTime } from '@/shared/lib/format';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { ConfirmDialog } from '@/shared/ui/confirm-dialog';
import { Guarded } from '@/shared/ui/guarded';
import { SectionCard } from '@/shared/ui/page-header';
import { EmptyState, ErrorState, ListSkeleton } from '@/shared/ui/states';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import { cn } from '@/shared/lib/utils';

const STATUS: Record<KbDocument['status'], { label: string; variant: 'gray' | 'orange' | 'green' | 'red' }> = {
  pending: { label: '대기', variant: 'gray' },
  indexing: { label: '색인 중', variant: 'orange' },
  ready: { label: '준비됨', variant: 'green' },
  failed: { label: '실패', variant: 'red' },
};

const ACCEPT = '.pdf,.md,.txt,.docx,.html';

function size(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function KbDocuments({ kbId, name }: { kbId: string; name: string }) {
  const { can } = useCurrentWorkspace();
  const qc = useQueryClient();
  const docs = useKbDocuments(kbId);
  const upload = useUploadKbDocument(kbId);
  const del = useDeleteKbDocument(kbId);
  const fileRef = useRef<HTMLInputElement>(null);
  const [target, setTarget] = useState<KbDocument | null>(null);

  // 색인 상태가 바뀌면 왼쪽 목록의 문서 수도 맞춘다
  const sig = docs.data?.map((d) => d.status).join(',');
  useEffect(() => {
    if (sig !== undefined) void qc.invalidateQueries({ queryKey: ['knowledge-bases'], exact: false, predicate: (q) => q.queryKey.length === 2 });
  }, [sig, qc]);

  const onFiles = (files: FileList | null) => {
    // 파일 내용은 보내지 않고 메타데이터만 보낸다(목에서는 사전 서명 URL 업로드를 생략)
    for (const f of Array.from(files ?? [])) {
      upload.mutate({ filename: f.name, mime: f.type || 'application/octet-stream', bytes: f.size }, {
        onSuccess: () => toast.success(`${f.name} 업로드 완료, 색인을 시작합니다.`),
        onError: (e) => toast.error(`${f.name}: ${e.message}`),
      });
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <SectionCard
      title={`${name} 문서`}
      bodyClassName="p-0 pt-3"
      actions={
        <Guarded allowed={can('edit')} reason="문서는 메이커 이상만 올릴 수 있습니다.">
          <Button size="sm" onClick={() => fileRef.current?.click()} disabled={upload.isPending} data-testid="kb-upload">
            <Upload aria-hidden /> 문서 올리기
          </Button>
        </Guarded>
      }
    >
      <input ref={fileRef} type="file" multiple accept={ACCEPT} className="hidden" aria-label="올릴 문서 파일" onChange={(e) => onFiles(e.target.files)} />
      {docs.isPending ? <div className="p-5"><ListSkeleton rows={3} /></div> : docs.isError ? <div className="p-5"><ErrorState error={docs.error} onRetry={() => void docs.refetch()} /></div> : !docs.data.length ? (
        <div className="p-5"><EmptyState title="아직 문서가 없어요" description="PDF · MD · TXT · DOCX · HTML 파일을 20MB까지 올릴 수 있습니다." /></div>
      ) : (
        <Table>
          <TableHeader className="bg-surface"><TableRow><TableHead>파일</TableHead><TableHead>상태</TableHead><TableHead>크기</TableHead><TableHead>청크</TableHead><TableHead>올린 시각</TableHead><TableHead className="w-10"><span className="sr-only">삭제</span></TableHead></TableRow></TableHeader>
          <TableBody>
            {docs.data.map((d) => (
              <TableRow key={d.id} data-testid="kb-doc">
                <TableCell>
                  <span className="flex items-center gap-2 font-medium"><FileText className="text-muted size-4" aria-hidden />{d.filename}</span>
                  {d.error ? <p className="text-danger mt-1 text-xs">{d.error}</p> : null}
                </TableCell>
                <TableCell><Badge variant={STATUS[d.status].variant} data-status={d.status}>{STATUS[d.status].label}</Badge></TableCell>
                <TableCell className="text-muted tabular-nums">{size(d.bytes)}</TableCell>
                <TableCell className="tabular-nums">{d.status === 'ready' ? d.chunk_count : '—'}</TableCell>
                <TableCell className="text-muted">{relativeTime(d.created_at)}</TableCell>
                <TableCell>
                  <Guarded allowed={can('edit')} reason="문서는 메이커 이상만 지울 수 있습니다.">
                    <Button variant="ghost" size="icon" aria-label={`${d.filename} 삭제`} onClick={() => setTarget(d)}><Trash2 aria-hidden /></Button>
                  </Guarded>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <p className="text-muted px-5 py-3 text-xs">모의 업로드입니다. 파일 내용은 보내지 않고, 이름에 “fail”이 들어가면 색인 실패를 흉내 냅니다.</p>
      <ConfirmDialog
        open={!!target}
        onOpenChange={(o) => !o && setTarget(null)}
        title="문서를 지울까요?"
        description={`${target?.filename ?? ''}와 색인된 청크가 모두 지워집니다.`}
        pending={del.isPending}
        onConfirm={() => target && del.mutate(target.id, { onSuccess: () => { toast.success('문서를 지웠습니다.'); setTarget(null); }, onError: (e) => toast.error(e.message) })}
      />
    </SectionCard>
  );
}

export function KbTab() {
  const q = useKnowledgeBases();
  const [sel, setSel] = useState<string | null>(null);
  const selected = q.data?.find((k) => k.id === sel) ?? q.data?.[0] ?? null;
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
      <SectionCard title="지식베이스 (RAG)" bodyClassName="p-0 pt-3">
        {q.isPending ? <div className="p-5"><ListSkeleton rows={3} /></div> : q.isError ? <div className="p-5"><ErrorState error={q.error} onRetry={() => void q.refetch()} /></div> : !q.data.length ? <div className="p-5"><EmptyState title="지식베이스가 없어요" /></div> : (
          <Table>
            <TableHeader className="bg-surface"><TableRow><TableHead>이름</TableHead><TableHead>문서</TableHead><TableHead>임베딩 · 청크</TableHead><TableHead>만든 날</TableHead></TableRow></TableHeader>
            <TableBody>
              {q.data.map((k) => (
                <TableRow key={k.id} aria-selected={selected?.id === k.id} className={cn('cursor-pointer', selected?.id === k.id && 'bg-primary-soft/60')} onClick={() => setSel(k.id)}>
                  <TableCell className="font-medium">
                    <button type="button" className="text-left hover:underline" onClick={() => setSel(k.id)}>{k.name}</button>
                  </TableCell>
                  <TableCell>{k.ready_count}/{k.doc_count}{' '}
                    {(() => {
                      const failed = k.failed_count ?? 0;
                      const busy = k.doc_count - k.ready_count - failed;
                      return busy > 0 ? <Badge variant="orange">색인 중 {busy}</Badge> : failed > 0 ? <Badge variant="red">실패 {failed}</Badge> : <Badge variant="green">준비됨</Badge>;
                    })()}</TableCell>
                  <TableCell className="text-muted text-xs"><span className="font-mono">{k.embed_model}</span><br />{k.chunk_size} / 겹침 {k.chunk_overlap}</TableCell>
                  <TableCell className="text-muted">{formatDate(k.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SectionCard>
      {selected ? <KbDocuments kbId={selected.id} name={selected.name} /> : null}
    </div>
  );
}
