import { z } from 'zod';
import { camelKeys } from '@/shared/lib/case';

export const ROLES = ['owner', 'admin', 'maker', 'viewer'] as const;
export const roleSchema = z.enum(ROLES);
export type Role = z.infer<typeof roleSchema>;
export const ROLE_RANK: Record<Role, number> = { viewer: 0, maker: 1, admin: 2, owner: 3 };

/** design.md 3.1.1 RBAC 권한 매트릭스 */
export const PERMISSIONS = {
  view: 'viewer',
  edit: 'maker', // 에이전트·워크플로 생성·수정, 테스트 실행
  deploy: 'maker',
  delete: 'admin',
  manageKeys: 'admin', // API 키, 자격증명, MCP
  market: 'admin', // 마켓 등록·구매
  budget: 'admin',
  invite: 'admin',
  approve: 'admin', // 승인자 지정이 없을 때
  ownerOnly: 'owner',
} as const satisfies Record<string, Role>;
export type Permission = keyof typeof PERMISSIONS;

export function can(role: Role | undefined | null, perm: Permission): boolean {
  if (!role) return false;
  return ROLE_RANK[role] >= ROLE_RANK[PERMISSIONS[perm]];
}

export const workspaceSettingsSchema = z
  .object({ compress_threshold: z.number().min(0.3).max(0.95).default(0.7), compress_target: z.number().optional() })
  ;

export const workspaceRowSchema = z
  .object({
    id: z.string(),
    slug: z.string(),
    name: z.string(),
    plan: z.string(),
    settings: workspaceSettingsSchema,
    created_at: z.string(),
    updated_at: z.string(),
    /** 목록 응답에만: 내 역할(memberships.role) */
    role: roleSchema,
  })
  ;
export type WorkspaceRow = z.infer<typeof workspaceRowSchema>;
export const toWorkspace = (r: WorkspaceRow) => camelKeys(r);
export type Workspace = ReturnType<typeof toWorkspace>;

export const memberRowSchema = z
  .object({
    workspace_id: z.string(),
    user_id: z.string(),
    role: roleSchema,
    created_at: z.string(),
    /** 표시용 확장 */
    user: z.object({ id: z.string(), email: z.string(), display_name: z.string() }),
    last_seen_at: z.string().nullable(),
    invited: z.boolean().optional(),
  })
  ;
export type MemberRow = z.infer<typeof memberRowSchema>;
export const toMember = (r: MemberRow) => camelKeys(r);
export type Member = ReturnType<typeof toMember>;

export const workspaceSlugRe = /^[a-z0-9][a-z0-9-]{2,39}$/;
export const workspaceFormSchema = z.object({
  name: z.string().trim().min(2, '이름은 2자 이상입니다.').max(40),
  slug: z.string().regex(workspaceSlugRe, '소문자·숫자·하이픈 3~40자, 첫 글자는 영문 소문자나 숫자'),
  compress_threshold: z.number().min(0.3).max(0.95),
});
export type WorkspaceForm = z.infer<typeof workspaceFormSchema>;

export const inviteFormSchema = z.object({
  email: z.string().email('이메일 형식이 아닙니다.'),
  role: z.enum(['admin', 'maker', 'viewer']),
});
export type InviteForm = z.infer<typeof inviteFormSchema>;
