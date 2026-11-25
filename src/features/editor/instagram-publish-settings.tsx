'use client';

import Link from 'next/link';
import { useCredentials } from '@/entities/credential';
import type { FormProps } from './inspector/forms-ai';
import { SelectField } from './inspector/fields';

export function InstagramPublishSettings({ cfg, set, disabled }: FormProps) {
  const credentials = useCredentials();
  const options = (credentials.data ?? [])
    .filter((credential) => credential.provider === 'instagram' && !credential.isDemo)
    .map((credential) => ({ value: credential.id, label: credential.label }));

  return (
    <div className="space-y-3">
      <SelectField
        label="Instagram 자격증명"
        value={String(cfg.credential_id ?? '')}
        onChange={(credential_id) => set({ credential_id })}
        options={options}
        disabled={disabled || credentials.isPending}
        placeholder={credentials.isPending ? '불러오는 중…' : '자격증명 선택'}
      />
      {credentials.isError && <p className="text-danger text-xs">자격증명을 불러오지 못했습니다.</p>}
      {!credentials.isPending && !options.length && (
        <Link href="/integrations?tab=credentials" className="text-primary text-xs hover:underline">Instagram 토큰 등록</Link>
      )}
      <p className="text-muted text-xs">카드 구성 → 승인 노드의 확인할 내용 → 이 노드의 승인된 카드 구성 순으로 연결하세요. 카드에 입력한 계정명으로 게시합니다.</p>
      <p className="text-warning text-xs">실제 백엔드에서 승인하면 테스트 실행에서도 게시됩니다.</p>
    </div>
  );
}
