/**
 * 목 API 메모리 저장소. localStorage 등 영속 저장소는 쓰지 않는다.
 * 화면 이동 중에는 유지되고, 새로고침하면 시드 데이터로 돌아간다.
 */
import type { Role } from '@/entities/workspace/model';
import type { WorkflowDefinition } from '@/entities/workflow/model';
import type { RunStatus, RunStepRow, ApprovalRow, Asset3dRow } from '@/entities/run/model';
import type { ContextBlockRow } from '@/entities/context/model';
import type { RequiredConnection } from '@/entities/template/model';
import type { LicenseType } from '@/entities/product/model';
import { seed } from './fixtures';

export interface DbUser {
  id: string;
  email: string;
  display_name: string;
  password: string | null;
  oauth_provider: string | null;
  created_at: string;
  updated_at: string;
}
export interface DbWorkspace {
  id: string;
  slug: string;
  name: string;
  plan: string;
  settings: { compress_threshold: number; compress_target?: number };
  created_at: string;
  updated_at: string;
}
export interface DbMembership {
  workspace_id: string;
  user_id: string;
  role: Role;
  created_at: string;
  last_seen_at: string | null;
  invited?: boolean;
}
export interface DbCredential {
  id: string;
  workspace_id: string;
  provider: string;
  label: string;
  key_version: number;
  purposes: string[];
  created_by: string | null;
  created_at: string;
  secret: string;
  expires_at: string | null;
  used_by: string[];
}
export interface DbMcpServer {
  id: string;
  workspace_id: string;
  name: string;
  transport: 'stdio' | 'sse' | 'http';
  command: string | null;
  url: string | null;
  credential_id: string | null;
  allow_tools: string[] | null;
  is_active: boolean;
  last_synced_at: string | null;
  created_at: string;
  status: 'connected' | 'error' | 'syncing';
  icon: string;
  /** 확장: 인증 방식(설계서 미결 7은 정적 토큰만, 목에서는 OAuth 흐름도 흉내) */
  auth?: 'none' | 'token' | 'oauth';
}
export interface DbMcpTool {
  id: string;
  server_id: string;
  name: string;
  description: string | null;
  input_schema: Record<string, unknown>;
  output_schema: Record<string, unknown> | null;
  annotations: { title?: string; readOnlyHint?: boolean; destructiveHint?: boolean; idempotentHint?: boolean };
  is_active: boolean;
  synced_at: string;
}
export interface DbWorkflow {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  draft: WorkflowDefinition;
  draft_version: number;
  origin_version_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}
export interface DbWorkflowVersion {
  id: string;
  workflow_id: string;
  version: number;
  definition: WorkflowDefinition;
  def_hash: string;
  note: string | null;
  created_by: string | null;
  created_at: string;
}
export interface DbAgent {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  model: string;
  fallback_models: string[];
  system_prompt: string;
  temperature: number;
  memory_enabled: boolean;
  primary_workflow_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  icon: string | null;
  memory_scopes: string[];
  /** 마켓에서 구매한 사본이면 라이선스 id */
  origin_license_id: string | null;
  api_only: boolean;
}
export interface DbAgentWorkflow {
  agent_id: string;
  workflow_id: string;
  alias: string;
}
export interface DbAgentSkill {
  id: string;
  agent_id: string;
  mcp_tool_id: string | null;
  builtin_skill: string | null;
  require_approval: boolean;
  config: Record<string, unknown>;
}
export interface DbKnowledgeBase {
  id: string;
  workspace_id: string;
  name: string;
  embed_model: string;
  chunk_size: number;
  chunk_overlap: number;
  created_at: string;
  doc_count: number;
  ready_count: number;
}
export interface DbEndpoint {
  id: string;
  workspace_id: string;
  slug: string;
  agent_id: string;
  workflow_version_id: string;
  mode: 'sync' | 'async';
  input_schema: Record<string, unknown>;
  webhook_url: string | null;
  webhook_secret: string;
  rate_limit_rpm: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
export interface DbApiKey {
  id: string;
  workspace_id: string;
  name: string;
  prefix: string;
  secret: string;
  scopes: string[];
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  created_by: string | null;
  created_at: string;
}
export interface DbRun {
  id: string;
  workspace_id: string;
  agent_id: string | null;
  workflow_id: string | null;
  workflow_version_id: string | null;
  endpoint_id: string | null;
  api_key_id: string | null;
  trigger: 'editor' | 'api' | 'schedule' | 'slash' | 'market';
  status: RunStatus;
  input: Record<string, unknown> | null;
  output: unknown;
  error_code: string | null;
  error_detail: unknown;
  cost_usd: number;
  tokens_in: number;
  tokens_out: number;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  context_session_id: string | null;
  rerun_of: string | null;
  /** 마켓 무료 체험처럼 워크플로 없이 도는 실행의 표시 이름(확장) */
  label?: string | null;
}
export type DbRunStep = RunStepRow;
export type DbApproval = Omit<ApprovalRow, 'target_name' | 'target_kind'>;
export type DbAsset = Asset3dRow & { workspace_id: string };
export interface DbContextSession {
  id: string;
  workspace_id: string;
  agent_id: string | null;
  run_id: string | null;
  model_family: string;
  last_seq: number;
  used_tokens: number;
  created_at: string;
  budget_tokens: number;
}
export type DbContextBlock = ContextBlockRow;
export interface DbSnapshot {
  id: string;
  session_id: string;
  label: string;
  block_count: number;
  body: DbContextBlock[];
  s3_key: string | null;
  created_at: string;
}
export interface DbCompression {
  id: number;
  session_id: string;
  summary_block_id: string | null;
  source_block_ids: string[];
  strategy: string;
  saved_tokens: number;
  created_at: string;
}
export interface DbProduct {
  id: string;
  seller_ws: string;
  agent_id: string | null;
  endpoint_id: string | null;
  title: string;
  summary: string;
  category: string;
  tags: string[];
  readme_md: string | null;
  license_types: LicenseType[];
  price_clone_krw: number | null;
  price_api_month_krw: number | null;
  status: 'draft' | 'in_review' | 'published' | 'suspended';
  rating_avg: number;
  rating_count: number;
  install_count: number;
  created_at: string;
  updated_at: string;
  kind: 'agent' | 'workflow';
  icon: string;
  seller_name: string;
  screenshots: string[];
  reject_reason?: string | null;
}
export interface DbMarketVersion {
  id: string;
  product_id: string;
  semver: string;
  bundle: { agent: Partial<DbAgent> & { skills?: string[] }; workflows: { name: string; definition: WorkflowDefinition }[]; requirements: RequiredConnection[] };
  scan_report: Record<string, unknown>;
  workflow_version_id: string | null;
  changelog: string | null;
  created_at: string;
}
export interface DbPurchase {
  id: string;
  product_id: string;
  version_id: string;
  buyer_ws: string;
  buyer_user: string | null;
  license_type: LicenseType;
  amount_krw: number;
  fee_krw: number;
  status: 'pending' | 'paid' | 'refunded' | 'failed';
  pg_tx_id: string | null;
  created_at: string;
  paid_at: string | null;
}
export interface DbLicense {
  id: string;
  product_id: string;
  version_id: string;
  buyer_ws: string;
  purchase_id: string;
  type: LicenseType;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
}
export interface DbReview {
  id: string;
  product_id: string;
  license_id: string | null;
  author: string;
  author_name: string;
  rating: number;
  body: string | null;
  created_at: string;
  /** 판매자 답글(확장) */
  reply?: { body: string; created_at: string } | null;
}
export interface DbBudget {
  id: string;
  workspace_id: string;
  scope_type: 'workspace' | 'agent' | 'endpoint';
  scope_id: string;
  monthly_limit_usd: number | null;
  per_run_limit_usd: number | null;
  alert_ratio: number;
}
export interface DbLedger {
  id: number;
  workspace_id: string;
  run_id: string;
  step_id: string | null;
  agent_id: string | null;
  endpoint_id: string | null;
  model: string;
  tokens_in: number;
  tokens_out: number;
  cost_usd: number;
  created_at: string;
}
export interface DbWebhookDelivery {
  id: string;
  endpoint_id: string;
  run_id: string;
  status_code: number;
  ok: boolean;
  attempt: number;
  event: string;
  created_at: string;
  payload: Record<string, unknown>;
}
export interface DbTemplate {
  id: string;
  name: string;
  summary: string;
  description: string;
  category: string;
  kind: 'agent' | 'workflow';
  difficulty: 'easy' | 'medium' | 'hard';
  icon: string;
  trigger: string;
  model: string | null;
  skills: string[];
  required_connections: RequiredConnection[];
  definition: WorkflowDefinition;
  agent?: { system_prompt: string; builtin_skills: string[] };
}

export interface Db {
  session: { userId: string; loggedOut: boolean };
  users: DbUser[];
  workspaces: DbWorkspace[];
  memberships: DbMembership[];
  credentials: DbCredential[];
  mcp_servers: DbMcpServer[];
  mcp_tools: DbMcpTool[];
  workflows: DbWorkflow[];
  workflow_versions: DbWorkflowVersion[];
  agents: DbAgent[];
  agent_workflows: DbAgentWorkflow[];
  agent_skills: DbAgentSkill[];
  knowledge_bases: DbKnowledgeBase[];
  endpoints: DbEndpoint[];
  api_keys: DbApiKey[];
  runs: DbRun[];
  run_steps: DbRunStep[];
  approvals: DbApproval[];
  assets_3d: DbAsset[];
  context_sessions: DbContextSession[];
  context_blocks: DbContextBlock[];
  context_snapshots: DbSnapshot[];
  compression_logs: DbCompression[];
  market_products: DbProduct[];
  market_versions: DbMarketVersion[];
  purchases: DbPurchase[];
  licenses: DbLicense[];
  reviews: DbReview[];
  budgets: DbBudget[];
  usage_ledger: DbLedger[];
  webhook_deliveries: DbWebhookDelivery[];
  templates: DbTemplate[];
  /** 확장(1차 범위 밖 기능의 목) */
  follows: { workspace_id: string; seller_name: string }[];
  trials: { workspace_id: string; product_id: string; run_id: string; created_at: string }[];
  billing: Record<string, { card_brand: string; card_last4: string; payout_bank: string; payout_last4: string; payout_holder: string; updated_at: string }>;
  kb_documents: { id: string; kb_id: string; filename: string; mime: string; bytes: number; status: 'pending' | 'indexing' | 'ready' | 'failed'; chunk_count: number; error: string | null; created_at: string }[];
  presets_3d: { id: string; workspace_id: string; name: string; params: Record<string, unknown>; created_at: string }[];
  slack_links: { endpoint_id: string; team: string; channel: string; connected_at: string }[];
}

export const db: Db = seed();

/** 시드 상태로 되돌린다(테스트·새 세션). */
export function resetDb() {
  const fresh = seed();
  for (const key of Object.keys(fresh) as (keyof Db)[]) {
    (db as unknown as Record<string, unknown>)[key] = fresh[key];
  }
}
