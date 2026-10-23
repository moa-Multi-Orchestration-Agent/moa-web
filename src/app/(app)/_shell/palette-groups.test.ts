import { describe, expect, it } from 'vitest';
import { parseSlash } from './palette-groups';

describe('parseSlash', () => {
  it('슬러그와 내용을 나눈다', () => {
    expect(parseSlash('/docs-qa 연차는 언제?')).toEqual({ slug: 'docs-qa', rest: '연차는 언제?' });
    expect(parseSlash('/docs')).toEqual({ slug: 'docs', rest: '' });
    expect(parseSlash('검색어')).toBeNull();
  });
});
