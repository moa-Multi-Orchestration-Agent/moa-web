import { describe, expect, it } from 'vitest';
import { boundCredential, modelPresets, parseModelIds, type ModelStatus } from './model';

const ext = (id: string, cred: string, label: string): ModelStatus => ({
  id: `openai_compatible:${id}`, label: id, family: 'openai_compatible', context_window: 128_000, price_in: 0, price_out: 0,
  source: 'workspace', keyable: true, credentials: [], default_credential_id: cred, credential_label: label,
});

describe('외부 AI 키 모델', () => {
  it('쉼표·줄바꿈으로 적은 모델 id를 정리한다', () => {
    expect(parseModelIds(' gpt-4.1, claude\n\ngpt-4.1 ')).toEqual(['gpt-4.1', 'claude']);
  });

  it('외부 키에 등록한 모델을 목록 뒤에 키 이름과 함께 붙이고, 고르면 그 키를 쓴다', () => {
    const data = { items: [ext('gpt-4.1', 'cr1', 'MonoGPT')] };
    const presets = modelPresets([{ value: 'gpt-4o', label: 'GPT-4o' }], data);
    expect(presets.at(-1)).toEqual({ value: 'openai_compatible:gpt-4.1', label: 'gpt-4.1 · MonoGPT' });
    expect(boundCredential(data, 'openai_compatible:gpt-4.1')).toBe('cr1');
    expect(boundCredential(data, 'gpt-4o')).toBeNull();
  });
});
