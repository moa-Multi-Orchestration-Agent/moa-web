'use client';

import { useRouter } from 'next/navigation';
import { useAgents } from '@/entities/agent';
import { useWorkflows } from '@/entities/workflow';
import type { PaletteExtraGroup } from './command-palette';

/** 커맨드 팔레트 추가 그룹: 새로 만들기, 에이전트·워크플로 검색 (3-11에서 슬래시 명령 추가) */
export function usePaletteGroups(query: string, open: boolean): PaletteExtraGroup[] {
  const router = useRouter();
  const q = query.startsWith('/') ? '' : query;
  const agents = useAgents({ q, limit: 6 });
  const workflows = useWorkflows({ q, limit: 6 });
  if (!open) return [];
  return [
    {
      heading: '새로 만들기',
      items: [
        { id: 'new-agent', label: '새 에이전트', onSelect: () => router.push('/studio/new?type=agent'), keywords: ['만들기', 'agent'] },
        { id: 'new-workflow', label: '새 워크플로', onSelect: () => router.push('/studio/new?type=workflow'), keywords: ['만들기', 'workflow'] },
        { id: 'from-template', label: '템플릿에서 시작', onSelect: () => router.push('/templates'), keywords: ['템플릿'] },
      ],
    },
    {
      heading: '에이전트',
      items: agents.items.map((a) => ({ id: `agent-${a.id}`, label: a.name, hint: '에이전트', onSelect: () => router.push(`/agents/${a.id}`) })),
    },
    {
      heading: '워크플로',
      items: workflows.items.map((w) => ({ id: `wf-${w.id}`, label: w.name, hint: '워크플로', onSelect: () => router.push(`/workflows/${w.id}/edit`) })),
    },
  ];
}
