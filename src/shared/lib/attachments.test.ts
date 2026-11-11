import { describe, expect, it } from 'vitest';
import { ATTACH_MAX_FILES, checkFiles, fileToUpload, formatBytes, isFileRef } from './attachments';

const MB = 1024 * 1024;

describe('첨부 파일 도우미', () => {
  it('형식·개수·크기·합계를 검사한다', () => {
    expect(checkFiles([{ name: 'a.pdf', size: 10, type: 'application/pdf' }, { name: 'b.png', size: 10, type: 'image/png' }])).toBeNull();
    expect(checkFiles([{ name: 'a.docx', size: 10, type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }])).toContain('a.docx');
    expect(checkFiles([{ name: 'big.pdf', size: 21 * MB, type: 'application/pdf' }])).toContain('너무 큽니다');
    expect(checkFiles([{ name: 'a.pdf', size: 12 * MB, type: 'application/pdf' }, { name: 'b.pdf', size: 12 * MB, type: 'application/pdf' }])).toContain('합계');
    const many = Array.from({ length: ATTACH_MAX_FILES + 1 }, (_, i) => ({ name: `${i}.png`, size: 1, type: 'image/png' }));
    expect(checkFiles(many)).toContain(`${ATTACH_MAX_FILES}개`);
  });

  it('파일을 data URL 접두어 없는 base64로 바꾼다', async () => {
    const file = new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], '계약서.pdf', { type: 'application/pdf' });
    expect(await fileToUpload(file)).toEqual({ filename: '계약서.pdf', mime: 'application/pdf', data_base64: 'JVBERg==' });
  });

  it('파일 참조 판별과 크기 표시', () => {
    expect(isFileRef({ kind: 'file', filename: 'a', mime: 'image/png', size: 1, storage_key: 'uploads/w/a.png' })).toBe(true);
    expect(isFileRef({ filename: 'a', data_base64: 'x' })).toBe(false);
    expect(formatBytes(512)).toBe('512B');
    expect(formatBytes(2048)).toBe('2KB');
    expect(formatBytes(3 * MB)).toBe('3.0MB');
  });
});
