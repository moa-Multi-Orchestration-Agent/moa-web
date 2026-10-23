/**
 * 에이전트 빌더 편집 상태. 명시적 저장 전까지 서버에 보내지 않는다.
 * 스킬·워크플로도 같이 모아 두었다가 저장할 때 차이만 반영한다.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { agentKeys, type AgentDetail, type AgentForm } from '@/entities/agent';
import { api } from '@/shared/lib/api-client';

export interface DraftSkill {
  /** 저장된 스킬이면 id, 새로 붙인 스킬이면 null */
  id: string | null;
  key: string;
  mcp_tool_id: string | null;
  builtin_skill: string | null;
  require_approval: boolean;
  enabled: boolean;
  label: string;
  description?: string;
  kindLabel: string;
  destructive: boolean;
}

export interface DraftWorkflow {
  workflow_id: string;
  alias: string;
  name: string;
  io_summary?: string;
}

export interface AgentDraft {
  form: AgentForm;
  skills: DraftSkill[];
  workflows: DraftWorkflow[];
}

export const EMPTY_FORM: AgentForm = {
  name: '',
  description: null,
  icon: '🤖',
  model: 'claude-sonnet-4',
  fallback_models: [],
  temperature: 0.7,
  system_prompt: '',
  memory_enabled: true,
  memory_scopes: ['short'],
};

export function draftFromDetail(d: AgentDetail | undefined): AgentDraft {
  if (!d) return { form: EMPTY_FORM, skills: [], workflows: [] };
  return {
    form: {
      name: d.name,
      description: d.description,
      icon: d.icon ?? '🤖',
      model: d.model,
      fallback_models: d.fallbackModels,
      temperature: d.temperature,
      system_prompt: d.systemPrompt,
      memory_enabled: d.memoryEnabled,
      memory_scopes: d.memoryScopes ?? [],
    },
    skills: d.skills.map((s) => ({
      id: s.id,
      key: s.mcp_tool_id ?? s.builtin_skill ?? s.id,
      mcp_tool_id: s.mcp_tool_id,
      builtin_skill: s.builtin_skill,
      require_approval: s.require_approval,
      enabled: (s.config as { enabled?: boolean }).enabled !== false,
      label: s.label ?? '',
      description: (s.config as { note?: string }).note ?? s.description,
      kindLabel: s.server_name ? 'MCP' : skillKind(s.builtin_skill),
      destructive: !!s.destructive,
    })),
    workflows: d.workflows.map((w) => ({ workflow_id: w.workflow_id, alias: w.alias, name: w.name ?? '', io_summary: w.io_summary })),
  };
}

export function skillKind(builtin: string | null | undefined) {
  if (builtin === 'kb_search') return '지식';
  if (builtin === 'three_d' || builtin === 'code_exec') return '도구';
  return '기본';
}

const snapshot = (d: AgentDraft) =>
  JSON.stringify({
    f: d.form,
    s: d.skills.map((x) => [x.key, x.require_approval, x.enabled]),
    w: d.workflows.map((x) => [x.workflow_id, x.alias]),
  });

export function useAgentDraft(detail: AgentDetail | undefined) {
  // 다시 불러와도 내용이 같으면 편집 상태를 덮어쓰지 않게, 바뀐 시각·구성으로 판단한다
  const key = detail ? `${detail.id}:${detail.updatedAt}:${detail.skills.map((s) => s.id + s.require_approval).join()}:${detail.workflows.map((w) => w.workflow_id + w.alias).join()}` : 'new';
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const base = useMemo(() => draftFromDetail(detail), [key]);
  const [draft, setDraft] = useState<AgentDraft>(base);
  const [baseSnap, setBaseSnap] = useState(() => snapshot(base));
  // 서버 데이터가 (처음) 도착하면 편집 상태를 맞춘다
  useEffect(() => {
    setDraft(base);
    setBaseSnap(snapshot(base));
  }, [base]);
  const dirty = snapshot(draft) !== baseSnap;
  const setForm = useCallback((patch: Partial<AgentForm>) => setDraft((d) => ({ ...d, form: { ...d.form, ...patch } })), []);
  const setSkills = useCallback((fn: (s: DraftSkill[]) => DraftSkill[]) => setDraft((d) => ({ ...d, skills: fn(d.skills) })), []);
  const setWorkflows = useCallback((fn: (w: DraftWorkflow[]) => DraftWorkflow[]) => setDraft((d) => ({ ...d, workflows: fn(d.workflows) })), []);
  const reset = useCallback(() => setDraft(base), [base]);
  return { draft, setForm, setSkills, setWorkflows, dirty, reset };
}

/** 저장: 필드 PATCH(또는 생성) → 스킬 차이 반영 → 워크플로 목록 PUT */
export function useSaveAgent() {
  const qc = useQueryClient();
  return async (agentId: string | null, draft: AgentDraft, original: AgentDetail | undefined): Promise<string> => {
    let id = agentId;
    if (!id) {
      const created = await api.post<{ id: string }>('/agents', { ...draft.form, primary_workflow_id: draft.workflows[0]?.workflow_id ?? null });
      id = created.id;
    } else {
      await api.patch(`/agents/${id}`, draft.form);
    }
    const before = original?.skills ?? [];
    const keep = new Set(draft.skills.filter((s) => s.id).map((s) => s.id));
    for (const s of before) if (!keep.has(s.id)) await api.delete(`/agents/${id}/skills/${s.id}`);
    for (const s of draft.skills) {
      if (!s.id) {
        await api.post(`/agents/${id}/skills`, { mcp_tool_id: s.mcp_tool_id ?? undefined, builtin_skill: s.builtin_skill ?? undefined, require_approval: s.require_approval, config: { enabled: s.enabled } });
      } else {
        const prev = before.find((b) => b.id === s.id);
        const prevEnabled = (prev?.config as { enabled?: boolean } | undefined)?.enabled !== false;
        if (prev && (prev.require_approval !== s.require_approval || prevEnabled !== s.enabled)) {
          await api.patch(`/agents/${id}/skills/${s.id}`, { require_approval: s.require_approval, config: { enabled: s.enabled } });
        }
      }
    }
    const wfChanged = JSON.stringify(draft.workflows.map((w) => [w.workflow_id, w.alias])) !== JSON.stringify((original?.workflows ?? []).map((w) => [w.workflow_id, w.alias]));
    if (wfChanged || !agentId) await api.put(`/agents/${id}/workflows`, { items: draft.workflows.map(({ workflow_id, alias }) => ({ workflow_id, alias })) });
    await qc.invalidateQueries({ queryKey: agentKeys.all });
    await qc.refetchQueries({ queryKey: agentKeys.detail(id) });
    return id;
  };
}

export function aliasFromName(name: string, taken: string[]) {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .replace(/^[^a-z]+/, '') || 'workflow';
  let alias = base.slice(0, 30);
  let i = 2;
  while (taken.includes(alias)) alias = `${base.slice(0, 27)}_${i++}`;
  return alias;
}

export const ALIAS_RE = /^[a-z][a-z0-9_]{1,39}$/;
