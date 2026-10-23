import { describe, expect, it } from 'vitest';
import { codeSamples } from './code-samples';

describe('codeSamples', () => {
  it('입력 예시로 세 언어 예시를 만든다', () => {
    const s = codeSamples('https://api.moa.dev/a/team-moa/docs-qa', { question: "연차는 언제?", n: 1, ok: true }, 'sync');
    expect(s.curl).toContain('https://api.moa.dev/a/team-moa/docs-qa');
    expect(s.curl).toContain('"question":"연차는 언제?"');
    expect(s.js).toContain("'Idempotency-Key': crypto.randomUUID()");
    expect(s.py).toContain('json={"question": "연차는 언제?", "n": 1, "ok": True}');
  });
});
