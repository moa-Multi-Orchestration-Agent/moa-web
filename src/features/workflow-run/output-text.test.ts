import { describe, expect, it } from 'vitest';
import { buildInput, chatField, outputText } from './output-text';

describe('outputText', () => {
  it('출력 노드의 result 안 LLM text를 꺼낸다', () => {
    expect(outputText({ result: { text: '연차는 15일입니다.', json: {} }, delivered_at: 'x' })).toBe('연차는 15일입니다.');
    expect(outputText({ result: '그냥 문자열' })).toBe('그냥 문자열');
  });
  it('모르는 모양은 JSON으로 보여 준다', () => {
    expect(outputText({ a: 1, b: 2 })).toContain('"a": 1');
    expect(outputText(null)).toBe('');
  });
});

describe('chatField / buildInput', () => {
  const fields = [
    { name: 'tone', type: 'string' as const, enum: ['친절', '간결'], default: '친절' },
    { name: 'question', type: 'string' as const, required: true },
    { name: 'top_k', type: 'integer' as const, default: 4 },
  ];
  it('필수 문자열 칸에 대화 문장을 넣고 나머지는 기본값', () => {
    expect(chatField(fields)).toBe('question');
    expect(buildInput(fields, { top_k: '2' }, '연차?')).toEqual({ tone: '친절', question: '연차?', top_k: 2 });
  });
  it('칸이 없으면 message', () => {
    expect(buildInput([], {}, '안녕')).toEqual({ message: '안녕' });
  });
});
