import { describe, expect, it } from 'vitest';
import type { InputField } from '@/entities/workflow';
import type { FileRef } from '@/shared/lib/attachments';
import { fileInputs, refsFromInput } from './extra-fields';

const fields: InputField[] = [
  { name: 'question', type: 'string', required: true },
  { name: 'doc', type: 'file', required: true },
  { name: 'pics', type: 'files' },
];
const ref = (name: string): FileRef => ({ kind: 'file', filename: name, mime: 'image/png', size: 1, storage_key: `uploads/w/${name}` });
const pdf = () => new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], 'a.pdf', { type: 'application/pdf' });

describe('대화창 첨부 입력', () => {
  it('새로 고른 파일은 base64 업로드로, file 칸은 하나만 보낸다', async () => {
    const out = await fileInputs(fields, { doc: [pdf()], pics: [] }, {});
    expect(out).toEqual({ doc: { filename: 'a.pdf', mime: 'application/pdf', data_base64: 'JVBERg==' } });
  });

  it('고른 파일이 없으면 앞 실행의 참조를 다시 쓴다', async () => {
    const out = await fileInputs(fields, {}, { doc: [ref('d.png')], pics: [ref('p1.png'), ref('p2.png')] });
    expect(out).toEqual({ doc: ref('d.png'), pics: [ref('p1.png'), ref('p2.png')] });
  });

  it('필수 첨부가 없거나 형식이 틀리면 오류', async () => {
    await expect(fileInputs(fields, {}, {})).rejects.toThrow('파일을 첨부해 주세요');
    const docx = new File(['x'], 'a.docx', { type: 'application/msword' });
    await expect(fileInputs(fields, { doc: [docx] }, {})).rejects.toThrow('a.docx');
  });

  it('실행 응답 입력에서 서버가 만든 참조만 꺼낸다', () => {
    const input = { question: 'q', doc: ref('d.png'), pics: [ref('p.png'), { filename: 'x', data_base64: 'y' }] };
    expect(refsFromInput(fields, input)).toEqual({ doc: [ref('d.png')], pics: [ref('p.png')] });
    expect(refsFromInput(fields, null)).toEqual({});
  });
});
