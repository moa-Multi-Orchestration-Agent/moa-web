/** 저장 행 → API 응답 변환(집계·표시용 확장 필드 포함) */
import { BUILTIN_SKILLS } from '@/entities/agent/model';
import { PUBLIC_API_ORIGIN } from '@/entities/endpoint/model';
import type { AgentDetailRow, AgentRow, AgentSkillRow } from '@/entities/agent/model';
import type { WorkflowDetailRow, WorkflowRow } from '@/entities/workflow/model';
import type { ApprovalRow, RunDetailRow, RunRow } from '@/entities/run/model';
import type { EndpointRow } from '@/entities/endpoint/model';
import type { ProductRow } from '@/entities/product/model';
import type { McpServerRow, McpToolRow } from '@/entities/mcp/model';
import type { ContextSessionRow } from '@/entities/context/model';
import type { CredentialRow } from '@/entities/credential/model';
import type { TemplateRow } from '@/entities/template/model';
import { db, type DbAgent, type DbAgentSkill, type DbApproval, type DbEndpoint, type DbProduct, type DbRun, type DbWorkflow } from './db';

const live = <T extends { deleted_at: string | null }>(x: T) => !x.deleted_at;

export function triggerOf(w: DbWorkflow): string {
  const input = w.draft.nodes.find((n) => n.type === 'input');
  return String(input?.config?.trigger ?? 'manual');
}

export function workflowView(w: DbWorkflow): WorkflowRow {
  const versions = db.workflow_versions.filter((v) => v.workflow_id === w.id);
  const links = db.agent_workflows.filter((l) => l.workflow_id === w.id);
  const agents = links
    .map((l) => db.agents.find((a) => a.id === l.agent_id && live(a)))
    .filter(Boolean)
    .map((a) => ({ id: a!.id, name: a!.name }));
  const runs = db.runs.filter((r) => r.workflow_id === w.id);
  const lastRun = runs.reduce<string | null>((acc, r) => (!acc || r.created_at > acc ? r.created_at : acc), null);
  const agentIds = new Set(agents.map((a) => a.id));
  const deployed = db.endpoints.some((e) => agentIds.has(e.agent_id) && e.is_active && db.agents.find((a) => a.id === e.agent_id)?.primary_workflow_id === w.id);
  const listed = db.market_products.some((p) => p.agent_id && agentIds.has(p.agent_id) && p.seller_ws === w.workspace_id && p.status === 'published');
  return {
    id: w.id,
    workspace_id: w.workspace_id,
    name: w.name,
    description: w.description,
    draft_version: w.draft_version,
    origin_version_id: w.origin_version_id,
    created_by: w.created_by,
    created_at: w.created_at,
    updated_at: w.updated_at,
    deleted_at: w.deleted_at,
    node_count: w.draft.nodes.length,
    trigger: triggerOf(w),
    agents,
    latest_version: versions.length ? Math.max(...versions.map((v) => v.version)) : null,
    last_run_at: lastRun,
    run_count: runs.length,
    deployed,
    listed,
    mini: w.draft.nodes.slice(0, 8).map((n) => n.type),
  };
}

export function workflowDetailView(w: DbWorkflow): WorkflowDetailRow {
  return { ...workflowView(w), draft: structuredClone(w.draft) };
}

export function skillView(s: DbAgentSkill): AgentSkillRow {
  if (s.builtin_skill) {
    const b = BUILTIN_SKILLS.find((x) => x.id === s.builtin_skill);
    return { ...s, label: b?.label ?? s.builtin_skill, description: b?.description, server_name: null, destructive: b?.destructive ?? false };
  }
  const t = db.mcp_tools.find((x) => x.id === s.mcp_tool_id);
  const server = db.mcp_servers.find((x) => x.id === t?.server_id);
  return { ...s, label: t?.annotations.title ?? t?.name ?? '알 수 없는 도구', description: t?.description ?? undefined, server_name: server?.name ?? null, destructive: !!t?.annotations.destructiveHint };
}

export function agentView(a: DbAgent): AgentRow {
  const skills = db.agent_skills.filter((s) => s.agent_id === a.id).map(skillView);
  const links = db.agent_workflows.filter((l) => l.agent_id === a.id);
  const wfNames = links.map((l) => db.workflows.find((w) => w.id === l.workflow_id)?.name).filter(Boolean) as string[];
  const eps = db.endpoints.filter((e) => e.agent_id === a.id && e.is_active);
  const runs = db.runs.filter((r) => r.agent_id === a.id);
  const lastRun = runs.reduce<string | null>((acc, r) => (!acc || r.created_at > acc ? r.created_at : acc), null);
  const versions = a.primary_workflow_id ? db.workflow_versions.filter((v) => v.workflow_id === a.primary_workflow_id) : [];
  const hidden = a.api_only;
  return {
    id: a.id,
    workspace_id: a.workspace_id,
    name: a.name,
    description: a.description,
    model: a.model,
    fallback_models: a.fallback_models,
    system_prompt: hidden ? '' : a.system_prompt,
    temperature: a.temperature,
    memory_enabled: a.memory_enabled,
    primary_workflow_id: a.primary_workflow_id,
    created_by: a.created_by,
    created_at: a.created_at,
    updated_at: a.updated_at,
    deleted_at: a.deleted_at,
    icon: a.icon,
    memory_scopes: a.memory_scopes,
    skill_count: skills.length,
    workflow_count: links.length,
    skill_names: skills.map((s) => s.label ?? ''),
    workflow_names: wfNames,
    endpoint_count: eps.length,
    endpoint_slugs: eps.map((e) => e.slug),
    run_count: runs.length,
    last_run_at: lastRun,
    listed: db.market_products.some((p) => p.agent_id === a.id && p.status === 'published'),
    purchased: !!a.origin_license_id,
    api_only: a.api_only,
    latest_version: versions.length ? Math.max(...versions.map((v) => v.version)) : null,
  };
}

export function agentDetailView(a: DbAgent): AgentDetailRow {
  return {
    ...agentView(a),
    skills: a.api_only ? [] : db.agent_skills.filter((s) => s.agent_id === a.id).map(skillView),
    workflows: a.api_only
      ? []
      : db.agent_workflows
          .filter((l) => l.agent_id === a.id)
          .map((l) => {
            const w = db.workflows.find((x) => x.id === l.workflow_id);
            const input = w?.draft.nodes.find((n) => n.type === 'input');
            const fields = ((input?.config?.fields as { name: string }[]) ?? []).map((f) => f.name).join(', ');
            const out = w?.draft.nodes.filter((n) => n.type === 'output').map((n) => n.name).join(', ');
            return { workflow_id: l.workflow_id, alias: l.alias, name: w?.name, io_summary: `입력: ${fields || '—'} → 출력: ${out || '—'}` };
          }),
  };
}

export function runView(r: DbRun): RunRow {
  const agent = r.agent_id ? db.agents.find((a) => a.id === r.agent_id) : null;
  const wf = r.workflow_id ? db.workflows.find((w) => w.id === r.workflow_id) : null;
  // 에이전트 대화·API·슬래시 호출은 에이전트 실행, 나머지는 워크플로 실행으로 본다
  const kind: 'agent' | 'workflow' = r.agent_id && (r.trigger === 'api' || r.trigger === 'slash' || !r.workflow_id) ? 'agent' : 'workflow';
  return {
    ...r,
    target_kind: kind,
    target_name: r.label ?? (kind === 'agent' ? (agent?.name ?? '삭제된 에이전트') : (wf?.name ?? agent?.name ?? '삭제된 워크플로')),
  } as RunRow;
}

export function approvalView(a: DbApproval): ApprovalRow {
  const run = db.runs.find((r) => r.id === a.run_id);
  const rv = run ? runView(run) : null;
  return { ...a, target_name: rv?.target_name ?? '실행', target_kind: rv?.target_kind ?? 'workflow' };
}

export function runDetailView(r: DbRun): RunDetailRow {
  return {
    ...runView(r),
    steps: db.run_steps.filter((s) => s.run_id === r.id).sort((a, b) => a.started_at.localeCompare(b.started_at)),
    approvals: db.approvals.filter((a) => a.run_id === r.id).map(approvalView),
    assets: db.assets_3d.filter((a) => a.run_id === r.id),
  };
}

export function endpointView(e: DbEndpoint, withSecret = false): EndpointRow {
  const ws = db.workspaces.find((w) => w.id === e.workspace_id);
  const agent = db.agents.find((a) => a.id === e.agent_id);
  const version = db.workflow_versions.find((v) => v.id === e.workflow_version_id);
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const calls = db.runs.filter((r) => r.endpoint_id === e.id && r.created_at >= weekAgo).length;
  const { webhook_secret, ...rest } = e;
  return {
    ...rest,
    agent_name: agent?.name ?? '—',
    workspace_slug: ws?.slug ?? '',
    version: version?.version ?? 1,
    call_count_7d: calls * 37 + (e.slug.length % 7) * 11,
    url: `${PUBLIC_API_ORIGIN}/a/${ws?.slug}/${e.slug}`,
    ...(withSecret ? { webhook_secret } : {}),
  };
}

export function productView(p: DbProduct, buyerWs: string): ProductRow {
  const versions = db.market_versions.filter((v) => v.product_id === p.id).sort((a, b) => a.created_at.localeCompare(b.created_at));
  const owned = db.licenses.find((l) => l.product_id === p.id && l.buyer_ws === buyerWs && !l.revoked_at);
  const { readme_md: _r, screenshots: _s, reject_reason: _rr, ...rest } = p;
  return { ...rest, mine: p.seller_ws === buyerWs, latest_semver: versions.at(-1)?.semver ?? '1.0.0', owned_license: owned?.type ?? null };
}

export function mcpServerView(s: (typeof db.mcp_servers)[number]): McpServerRow {
  return { ...s, tool_count: db.mcp_tools.filter((t) => t.server_id === s.id && t.is_active).length };
}

export function mcpToolView(t: (typeof db.mcp_tools)[number]): McpToolRow {
  return { ...t, server_name: db.mcp_servers.find((s) => s.id === t.server_id)?.name ?? '' };
}

export function sessionView(s: (typeof db.context_sessions)[number]): ContextSessionRow {
  const ws = db.workspaces.find((w) => w.id === s.workspace_id);
  return {
    ...s,
    used_tokens: db.context_blocks.filter((b) => b.session_id === s.id && b.enabled).reduce((acc, b) => acc + b.token_count, 0),
    compress_threshold: ws?.settings.compress_threshold ?? 0.7,
    compressions: db.compression_logs.filter((c) => c.session_id === s.id).map(({ id: _id, session_id: _sid, ...c }) => c),
  };
}

export function credentialView(c: (typeof db.credentials)[number]): CredentialRow {
  const { secret, ...rest } = c;
  return { ...rest, masked: `${secret.slice(0, 4)}••••${secret.slice(-4)}` };
}

export function templateView(t: (typeof db.templates)[number]): TemplateRow {
  return {
    id: t.id,
    name: t.name,
    summary: t.summary,
    category: t.category,
    kind: t.kind,
    difficulty: t.difficulty,
    icon: t.icon,
    node_count: t.definition.nodes.length,
    trigger: t.trigger,
    model: t.model,
    skills: t.skills,
    required_connections: t.required_connections,
    official: true,
  };
}

export function isConnected(wsId: string, req: { kind: string; provider: string }) {
  if (req.kind === 'mcp') return db.mcp_servers.some((s) => s.workspace_id === wsId && s.name.toLowerCase() === req.provider.toLowerCase() && s.is_active);
  if (req.kind === 'kb') return db.knowledge_bases.some((k) => k.workspace_id === wsId);
  return db.credentials.some((c) => c.workspace_id === wsId && c.provider === req.provider);
}
