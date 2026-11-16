import { describe, expect, it } from 'vitest';
import { ATTACH_MAX_FILES, DEFAULT_FILE_LIMITS, checkFiles, defaultRefs, fileToUpload, formatBytes, isFileRef } from './attachments';

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

  it('이미지는 5MB까지, 기본 첨부는 파일 10MB에 이미 올린 파일까지 함께 센다', () => {
    expect(checkFiles([{ name: 'big.png', size: 6 * MB, type: 'image/png' }])).toContain('이미지는 5.0MB');
    expect(checkFiles([{ name: 'a.pdf', size: 15 * MB, type: 'application/pdf' }], DEFAULT_FILE_LIMITS)).toContain('최대 10.0MB');
    expect(checkFiles([{ name: 'a.pdf', size: 8 * MB, type: 'application/pdf' }], DEFAULT_FILE_LIMITS, [{ size: 9 * MB }, { size: 4 * MB }])).toContain('합계');
    const existing = Array.from({ length: ATTACH_MAX_FILES }, () => ({ size: 1 }));
    expect(checkFiles([{ name: 'a.png', size: 1, type: 'image/png' }], DEFAULT_FILE_LIMITS, existing)).toContain(`${ATTACH_MAX_FILES}개`);
  });

  it('기본값에서 파일 참조만 꺼낸다', () => {
    const ref = { kind: 'file', filename: 'a', mime: 'image/png', size: 1, storage_key: 'uploads/w/a.png' };
    expect(defaultRefs(ref)).toEqual([ref]);
    expect(defaultRefs([ref, 'x', null])).toEqual([ref]);
    expect(defaultRefs(undefined)).toEqual([]);
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
