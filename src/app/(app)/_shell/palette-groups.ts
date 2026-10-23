'use client';

import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useAgents } from '@/entities/agent';
import { useEndpoints } from '@/entities/endpoint';
import { useStartRun } from '@/entities/run';
import { useWorkflows } from '@/entities/workflow';
import { useCurrentWorkspace } from '@/entities/workspace';
import { isApiError } from '@/shared/lib/api-client';
import type { PaletteExtraGroup } from './command-palette';

/** `/슬러그 내용` → 입력 스키마의 첫 문자열 필드에 내용을 넣는다 (design.md 2.3.5) */
export function parseSlash(text: string): { slug: string; rest: string } | null {
  const m = /^\/([a-z0-9-]*)(?:\s+([\s\S]*))?$/.exec(text.trim());
  return m ? { slug: m[1]!, rest: (m[2] ?? '').trim() } : null;
}

/** 커맨드 팔레트 추가 그룹: 슬래시 명령, 새로 만들기, 에이전트·워크플로 검색 */
export function usePaletteGroups(query: string, open: boolean): PaletteExtraGroup[] {
  const router = useRouter();
  const slash = parseSlash(query);
  const q = slash ? '' : query;
  const agents = useAgents({ q, limit: 6 });
  const workflows = useWorkflows({ q, limit: 6 });
  const endpoints = useEndpoints();
  const start = useStartRun();
  const { can } = useCurrentWorkspace();
  if (!open) return [];

  const runSlash = (id: string) => {
    const ep = endpoints.data?.find((e) => e.id === id);
    if (!ep || !slash) return;
    const props = (ep.inputSchema.properties ?? {}) as Record<string, { type?: string }>;
    const field = Object.entries(props).find(([, p]) => p.type === 'string')?.[0];
    if (!slash.rest || !field) {
      toast.error(`입력이 필요해요: /${ep.slug} ${field ?? '내용'}`, { description: '명령 형식: /슬러그 내용 (MOA-API-008)' });
      return;
    }
    start.mutate(
      { agent_id: ep.agentId, endpoint_id: ep.id, input: { [field]: slash.rest }, trigger: 'slash' },
      { onSuccess: (r) => { toast.success(`/${ep.slug} 실행을 시작했습니다.`); router.push(`/runs/${r.id}`); }, onError: (e) => toast.error(isApiError(e) ? e.detail : e.message) },
    );
  };

  if (slash) {
    const items = (endpoints.data ?? [])
      .filter((e) => e.isActive && e.slug.startsWith(slash.slug))
      .map((e) => ({ id: `slash-${e.id}`, label: `/${e.slug} ${slash.rest || '…'}`, hint: can('edit') ? `${e.agentName} 실행` : '뷰어는 실행 불가', keywords: [query], onSelect: () => (can('edit') ? runSlash(e.id) : toast.error('뷰어 권한에서는 실행할 수 없습니다.')) }));
    return [{ heading: '슬래시 명령', items }];
  }
  return [
    {
      heading: '새로 만들기',
      items: [
        { id: 'new-agent', label: '새 에이전트', onSelect: () => router.push('/studio/new?type=agent'), keywords: ['만들기', 'agent'] },
        { id: 'new-workflow', label: '새 워크플로', onSelect: () => router.push('/studio/new?type=workflow'), keywords: ['만들기', 'workflow'] },
        { id: 'from-template', label: '템플릿에서 시작', onSelect: () => router.push('/templates'), keywords: ['템플릿'] },
      ],
    },
    { heading: '에이전트', items: agents.items.map((a) => ({ id: `agent-${a.id}`, label: a.name, hint: '에이전트', onSelect: () => router.push(`/agents/${a.id}`) })) },
    { heading: '워크플로', items: workflows.items.map((w) => ({ id: `wf-${w.id}`, label: w.name, hint: '워크플로', onSelect: () => router.push(`/workflows/${w.id}/edit`) })) },
  ];
}
