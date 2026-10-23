'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useState } from 'react';
import { Save } from 'lucide-react';
import { toast } from 'sonner';
import { useRun } from '@/entities/run';
import { usePresets3d, useSavePreset3d } from '@/entities/workflow';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Skeleton } from '@/shared/ui/skeleton';
import { useEditorStore } from '../store';
import { SelectField } from './fields';

const ThreeViewer = dynamic(() => import('@/shared/ui/three-viewer'), { ssr: false, loading: () => <Skeleton className="h-48 w-full" /> });

/** 프리셋으로 저장·적용하는 3D 파라미터 키 */
const PRESET_KEYS = ['mode', 'resolution', 'volume', 'density', 'style', 'symmetry', 'formats'] as const;

export function PresetBar({ cfg, set, disabled }: { cfg: Record<string, unknown>; set: (p: Record<string, unknown>) => void; disabled?: boolean }) {
  const presets = usePresets3d();
  const save = useSavePreset3d();
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  const apply = (id: string) => {
    const p = presets.data?.find((x) => x.id === id);
    if (!p) return;
    set(p.params);
    toast.success(`프리셋 “${p.name}”을 적용했습니다.`);
  };
  const submit = () => {
    if (!name.trim()) return;
    const params = Object.fromEntries(PRESET_KEYS.filter((k) => cfg[k] !== undefined).map((k) => [k, cfg[k]]));
    save.mutate({ name: name.trim(), params }, {
      onSuccess: (p) => { toast.success(`프리셋 “${p.name}”을 저장했습니다.`); setNaming(false); setName(''); },
      onError: (e) => toast.error(e.message),
    });
  };
  if (presets.isPending) return <Skeleton className="h-9 w-full" />;
  return (
    <div className="space-y-2">
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <SelectField
            label="프리셋"
            value=""
            onChange={apply}
            options={(presets.data ?? []).map((p) => ({ value: p.id, label: p.name }))}
            placeholder={presets.isError ? '불러오지 못함' : presets.data?.length ? '프리셋 적용' : '저장한 프리셋 없음'}
            disabled={disabled || !presets.data?.length}
          />
        </div>
        <Button size="icon" variant="outline" aria-label="현재 설정을 프리셋으로 저장" onClick={() => setNaming((v) => !v)} disabled={disabled} aria-expanded={naming}>
          <Save aria-hidden />
        </Button>
      </div>
      {naming ? (
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="프리셋 이름" aria-label="프리셋 이름" autoFocus className="h-8" />
          <Button size="sm" type="submit" disabled={!name.trim() || save.isPending}>저장</Button>
        </form>
      ) : null}
    </div>
  );
}

/** 마지막 테스트 실행에서 이 노드가 만든 3D 결과 미리보기 */
export function ResultPreview({ nodeId }: { nodeId: string }) {
  const runId = useEditorStore((s) => s.lastRunId);
  const run = useRun(runId);
  if (!runId) return <p className="text-muted rounded-md border border-dashed p-3 text-xs">테스트 실행을 하면 이 노드의 결과를 여기서 미리 볼 수 있어요.</p>;
  if (run.isPending) return <Skeleton className="h-48 w-full" />;
  if (run.isError) return <p className="text-danger text-xs">마지막 실행 결과를 불러오지 못했습니다.</p>;
  const stepIds = new Set(run.data.steps.filter((s) => s.node_id === nodeId).map((s) => s.id));
  const asset = run.data.assets.find((a) => a.step_id && stepIds.has(a.step_id));
  if (!asset) {
    const running = run.data.status === 'queued' || run.data.status === 'running';
    return <p className="text-muted rounded-md border border-dashed p-3 text-xs">{running ? '생성 중이에요. 끝나면 여기에 보입니다.' : '마지막 실행에서 이 노드의 결과가 없어요.'}</p>;
  }
  return (
    <div className="space-y-1.5" data-testid="three-preview">
      <ThreeViewer url={asset.url} previewUrl={asset.preview_url} height={200} />
      <p className="text-muted flex justify-between text-xs">
        <span>{asset.format.toUpperCase()}{asset.poly_count ? ` · ${asset.poly_count.toLocaleString('ko-KR')} 폴리곤` : ''}</span>
        <Link href={`/runs/${run.data.id}`} className="text-primary hover:underline">실행 보기</Link>
      </p>
    </div>
  );
}
