import { describe, expect, it } from 'vitest';
import type { InputField } from '@/entities/workflow';
import type { FileRef } from '@/shared/lib/attachments';
import { withFieldType } from './default-files';

const ref = (name: string): FileRef => ({ kind: 'file', filename: name, mime: 'application/pdf', size: 1, storage_key: `uploads/w/assets/${name}` });

describe('기본 첨부가 있는 필드의 타입 바꾸기', () => {
  const files: InputField = { name: 'guide', type: 'files', default: [ref('a.pdf'), ref('b.pdf')] };

  it('files → file이면 첫 파일만, 다시 files면 목록으로', () => {
    const one = withFieldType(files, 'file');
    expect(one).toEqual({ name: 'guide', type: 'file', default: ref('a.pdf') });
    expect(withFieldType(one, 'files')).toEqual({ name: 'guide', type: 'files', default: [ref('a.pdf')] });
  });

  it('파일이 아닌 타입이 되면 기본 첨부를 지우고, 일반 기본값은 그대로 둔다', () => {
    expect(withFieldType(files, 'string')).toEqual({ name: 'guide', type: 'string' });
    expect(withFieldType({ name: 'n', type: 'string', default: '안녕' }, 'number')).toEqual({ name: 'n', type: 'number', default: '안녕' });
  });
});
