import { describe, expect, it } from 'vitest';
import type { Template } from './model';
import { nameFromPrompt, pickTemplate } from './match';

const t = (name: string, kind: 'agent' | 'workflow', summary = ''): Template =>
  ({ id: name, name, kind, summary, skills: [], category: 'x', difficulty: 'easy', icon: '', nodeCount: 3, trigger: 'api', model: null, requiredConnections: [], official: true }) as Template;

describe('pickTemplate', () => {
  const list = [t('디자인 리서치 에이전트', 'agent', '스케치를 받아 조사 · 3D 시각화'), t('AI 뉴스 요약 발송', 'workflow', '매일 뉴스를 요약해 메일로 발송'), t('FAQ 챗봇', 'agent', 'FAQ 문서를 근거로 답하는 챗봇')];
  it('겹치는 말이 많은 템플릿을 고른다', () => {
    expect(pickTemplate('디자인팀 스케치로 3D 시각화하는 에이전트', 'agent', list)?.name).toBe('디자인 리서치 에이전트');
    expect(pickTemplate('매일 뉴스를 요약해서 메일로 보내줘', 'workflow', list)?.name).toBe('AI 뉴스 요약 발송');
  });
  it('종류가 다르거나 겹치는 게 없으면 null', () => {
    expect(pickTemplate('매일 뉴스 요약', 'agent', list)).toBeNull();
    expect(pickTemplate('완전히 다른 주제 쿼크', 'workflow', list)).toBeNull();
  });
  it('이름은 첫 문장에서 만든다', () => {
    expect(nameFromPrompt('회의록을 정리하는 에이전트를 만들어줘. 그리고…', 'agent')).toBe('회의록을 정리하는 에이전트');
    expect(nameFromPrompt('', 'workflow')).toBe('새 워크플로');
  });
});
