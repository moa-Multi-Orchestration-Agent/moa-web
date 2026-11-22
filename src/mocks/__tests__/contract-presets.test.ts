import { describe, expect, it } from 'vitest';
import { CONTRACT_LABELS, CONTRACT_PRESETS, contractPreset, presetConfig } from '@/entities/workflow/contract-presets';
import { fakeOutput } from '../engine';
import { blockById, makeNode } from '../fixtures/blocks';

const LEVELS = ['높음', '중간', '낮음'];

describe('계약서 검토 프리셋', () => {
  it('근로계약서·주택 임대차·용역 세 가지를 준비해 둔다', () => {
    expect(CONTRACT_PRESETS.map((p) => p.id)).toEqual(['labor', 'lease', 'service']);
  });

  it.each(CONTRACT_PRESETS.map((p) => [p.id, p] as const))('%s: 백엔드가 읽는 모양을 갖춘다', (_id, p) => {
    expect(p.contract_kind && p.reviewer_role).toBeTruthy();
    expect(p.stances.length).toBeGreaterThanOrEqual(2);
    expect(p.checklist.length).toBeGreaterThanOrEqual(5);
    const ids = p.checklist.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length); // 백엔드가 id로 답을 맞추므로 겹치면 안 된다
    for (const c of p.checklist) {
      expect(c.title && c.check && c.law).toBeTruthy();
      expect(LEVELS).toContain(c.default_level);
    }
    expect(CONTRACT_LABELS).toContain(p.contract_kind); // 분류 라벨과 이름이 같아야 걸러내기가 맞는다
  });

  it('presetConfig: 고른 종류가 아닌 분류 라벨은 모두 검토하지 않는다', () => {
    const cfg = presetConfig(contractPreset('lease')!) as { skip_labels: string[] };
    expect(cfg.skip_labels).toEqual(['근로계약서', '용역·프리랜서 계약서', '기타 계약서', '계약서 아님']);
    expect(cfg.skip_labels).not.toContain('주택 임대차계약서');
  });

  it('presetConfig: 기본 입장을 첫 값으로 채우고, 원본 프리셋을 공유하지 않는다', () => {
    const lease = contractPreset('lease')!;
    const cfg = presetConfig(lease) as { preset: string; stance: string; checklist: { title: string }[] };
    expect(cfg).toMatchObject({ preset: 'lease', contract_kind: '주택 임대차계약서', stance: '임차인' });
    cfg.checklist[0]!.title = '고친 제목';
    expect(lease.checklist[0]!.title).toBe('보증금 반환');
  });

  it('카탈로그 기본값은 근로계약서 프리셋이다', () => {
    const block = blockById('llm.risk_check')!;
    expect(block.label).toBe('계약서 검토');
    expect(block.config).toMatchObject(presetConfig(contractPreset('labor')!));
  });

  it('목 출력 제목은 고른 계약서 종류를 따른다', () => {
    const node = makeNode('n4', 'llm.risk_check', '검토', 0, 0, presetConfig(contractPreset('service')!));
    const out = fakeOutput(node, {}) as { text: string };
    expect(out.text.split('\n')[0]).toBe('## 계약서.pdf — 용역·프리랜서 계약서');
    expect(out.text).toContain('[항목] 실질 근로관계');
  });
});
