'use client';

import { useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';
import { kbFormSchema, useCreateKb, useSearchKb, type KbForm } from '@/entities/credential';
import { isApiError } from '@/shared/lib/api-client';
import { Button } from '@/shared/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { SectionCard } from '@/shared/ui/page-header';
import { Slider } from '@/shared/ui/slider';
import { EmptyState } from '@/shared/ui/states';

const EMPTY: KbForm = { name: '', chunk_size: 800, chunk_overlap: 120 };

/** 지식베이스 만들기: 이름 + 조각 크기·겹침(Dify의 분할 설정과 같은 역할) */
export function CreateKbDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: (id: string) => void }) {
  const create = useCreateKb();
  const [form, setForm] = useState<KbForm>(EMPTY);
  const [errs, setErrs] = useState<Partial<Record<keyof KbForm, string>>>({});
  const submit = () => {
    const r = kbFormSchema.safeParse(form);
    if (!r.success) return setErrs(Object.fromEntries(r.error.issues.map((i) => [i.path[0], i.message])));
    setErrs({});
    create.mutate(r.data, {
      onSuccess: (kb) => { toast.success(`'${kb.name}' 지식베이스를 만들었습니다. 문서를 올려 주세요.`); onCreated(kb.id); onOpenChange(false); setForm(EMPTY); },
      onError: (e) => setErrs({ name: isApiError(e) ? e.detail : e.message }),
    });
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="space-y-4">
          <DialogHeader>
            <DialogTitle>지식베이스 만들기</DialogTitle>
            <DialogDescription>문서를 올리면 조각으로 나눠 색인하고, RAG 검색 노드와 에이전트의 지식 검색에 씁니다.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="kb-name">이름</Label>
            <Input id="kb-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="예: 사내 규정집" autoFocus aria-invalid={!!errs.name} />
            {errs.name ? <p role="alert" className="text-danger text-xs">{errs.name}</p> : null}
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm"><Label id="kb-size">조각 크기</Label><span className="font-mono tabular-nums">{form.chunk_size}자</span></div>
            <Slider aria-labelledby="kb-size" min={200} max={2000} step={50} value={[form.chunk_size]} onValueChange={([v]) => setForm((f) => ({ ...f, chunk_size: v ?? 800 }))} />
            <p className="text-muted text-xs">작게 나누면 검색이 정확하고, 크게 나누면 앞뒤 맥락이 더 들어갑니다.</p>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm"><Label id="kb-overlap">겹침</Label><span className="font-mono tabular-nums">{form.chunk_overlap}자</span></div>
            <Slider aria-labelledby="kb-overlap" min={0} max={400} step={10} value={[form.chunk_overlap]} onValueChange={([v]) => setForm((f) => ({ ...f, chunk_overlap: v ?? 0 }))} />
            {errs.chunk_overlap ? <p role="alert" className="text-danger text-xs">{errs.chunk_overlap}</p> : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>취소</Button>
            <Button type="submit" disabled={create.isPending}>{create.isPending ? <Loader2 className="animate-spin" aria-hidden /> : null}만들기</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** 검색 테스트: 노드에 넣기 전에 어떤 문단이 걸리는지 확인한다 */
export function KbSearchCard({ kbId }: { kbId: string }) {
  const search = useSearchKb(kbId);
  const [query, setQuery] = useState('');
  const run = () => { if (query.trim()) search.mutate({ query: query.trim(), top_k: 4 }); };
  return (
    <SectionCard title="검색 테스트">
      <form onSubmit={(e) => { e.preventDefault(); run(); }} className="flex gap-2">
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="질문을 넣어 어떤 문단이 찾아지는지 확인하세요" aria-label="검색 테스트 문장" />
        <Button type="submit" variant="outline" disabled={!query.trim() || search.isPending}>{search.isPending ? <Loader2 className="animate-spin" aria-hidden /> : <Search aria-hidden />} 검색</Button>
      </form>
      <div className="mt-3 space-y-2">
        {search.isError ? <p role="alert" className="text-danger text-sm">{search.error.message}</p> : null}
        {search.data && !search.data.items.length ? <EmptyState title="찾은 문단이 없어요" description="준비됨 상태의 문서가 있는지 확인하세요." /> : null}
        {search.data?.items.map((h, i) => (
          <div key={i} className="bg-surface rounded-md p-3">
            <div className="text-muted mb-1 flex justify-between text-xs"><span>{h.doc ?? '문서'}</span><span className="font-mono">유사도 {h.score.toFixed(3)}</span></div>
            <p className="line-clamp-4 text-sm whitespace-pre-wrap">{h.text}</p>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
