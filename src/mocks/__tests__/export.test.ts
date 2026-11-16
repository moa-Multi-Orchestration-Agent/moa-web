import { beforeEach, describe, expect, it } from 'vitest';
import type { RunDetailRow, RunRow } from '@/entities/run/model';
import type { NodeDef } from '@/entities/workflow/model';
import { collectFileRefs, downloadUrl, type FileRef } from '@/shared/lib/attachments';
import { fakeOutput } from '../engine';
import { BLOCKS } from '../fixtures/blocks';
import { db } from '../db';
import { api, fresh, readEvents } from './helpers';

beforeEach(() => fresh());

const node = (format: string): NodeDef =>
  ({ id: 'doc', type: 'code', block: 'data.export_document', name: '문서 내보내기', config: { format, title: '3분기 보고서', filename: '' }, ports_in: [], ports_out: [] }) as unknown as NodeDef;

describe('문서 내보내기(목)', () => {
  it('블록 카탈로그에 file 출력 포트로 있다', () => {
    const b = BLOCKS.find((x) => x.id === 'data.export_document')!;
    expect(b.ports_out.map((p) => [p.name, p.type])).toEqual([['file', 'file']]);
  });

  it('형식에 맞는 파일 참조를 내고, 내려받기 경로가 파일을 돌려준다', async () => {
    const out = fakeOutput(node('pdf'), {}) as { file: FileRef };
    expect(out.file).toMatchObject({ kind: 'file', filename: '3분기 보고서.pdf', mime: 'application/pdf' });
    const png = (fakeOutput(node('png'), {}) as { file: FileRef }).file;
    expect(png.filename).toBe('3분기 보고서.png');

    const url = downloadUrl(out.file);
    expect(url).toContain('/downloads/outputs/mock/doc.pdf?name=');
    const res = await fetch(url);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/pdf');
    expect(res.headers.get('content-disposition')).toContain(encodeURIComponent('3분기 보고서.pdf'));
    expect((await res.text()).startsWith('%PDF-')).toBe(true);
    expect((await fetch(url.replace('outputs/mock', 'assets'))).status).toBe(404);
  });

  it('실행 결과 깊은 곳의 파일 참조를 한 번씩만 모은다', () => {
    const ref = (fakeOutput(node('pdf'), {}) as { file: FileRef }).file;
    expect(collectFileRefs({ result: { file: ref }, again: [ref], text: 'x' })).toEqual([ref]);
    expect(collectFileRefs('글만')).toEqual([]);
  });

  it('실행하면 만든 파일이 최종 출력으로 넘어온다(대화창 내려받기용)', async () => {
    const wf = db.workflows.find((w) => w.name === '사내 문서 Q&A')!;
    const definition = {
      nodes: [
        { id: 'in', type: 'input', name: '입력', config: { trigger: 'manual', fields: [{ name: 'topic', type: 'string', required: true }] }, ports_in: [], ports_out: [{ name: 'topic', type: 'string' }], position: { x: 0, y: 0 } },
        { ...node('pdf'), position: { x: 200, y: 0 } },
        { id: 'out', type: 'output', name: '결과', config: {}, ports_in: [{ name: 'result', type: 'any' }], ports_out: [], position: { x: 400, y: 0 } },
      ],
      edges: [
        { source: 'in', source_port: 'topic', target: 'doc', target_port: 'content' },
        { source: 'doc', source_port: 'file', target: 'out', target_port: 'result' },
      ],
    };
    const run = await api.post<RunRow>('/runs', { workflow_id: wf.id, label: '테스트', definition, input: { topic: '3분기' } });
    await readEvents(run.id, { untilEvent: (e) => e.event === 'run.status' && e.data.includes('succeeded') });
    const d = await api.get<RunDetailRow>(`/runs/${run.id}`);
    expect(collectFileRefs(d.output).map((f) => f.filename)).toEqual(['3분기 보고서.pdf']);
  });
});
