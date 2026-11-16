import { beforeEach, describe, expect, it } from 'vitest';
import type { RunRow } from '@/entities/run/model';
import { inputSchemaOf, isAssignable, type WorkflowDefinition } from '@/entities/workflow';
import { withCatalogPorts } from '@/features/editor/convert';
import type { FileRef } from '@/shared/lib/attachments';
import { BLOCKS } from '../fixtures/blocks';
import { db } from '../db';
import { WS1 } from '../fixtures';
import { api, fail, fresh } from './helpers';

beforeEach(() => fresh());

const PDF_B64 = 'JVBERi0xLjQK';
const PNG_B64 = 'iVBORw0KGgoAAAANSUhEUg==';

describe('실행 첨부(목 API)', () => {
  it('base64 첨부를 참조로 바꿔 run 입력에 base64를 남기지 않는다', async () => {
    const wf = db.workflows.find((w) => w.name === '사내 문서 Q&A')!;
    const run = await api.post<RunRow>('/runs', {
      workflow_id: wf.id,
      input: { question: '요약', files: [{ filename: '계약서.pdf', data_base64: PDF_B64 }, { filename: '사진.png', data_base64: PNG_B64 }] },
    });
    const files = (run.input as { files: FileRef[] }).files;
    expect(files.map((f) => [f.kind, f.filename, f.mime])).toEqual([
      ['file', '계약서.pdf', 'application/pdf'],
      ['file', '사진.png', 'image/png'],
    ]);
    expect(files[0]!.storage_key.startsWith(`uploads/${WS1}/`)).toBe(true);
    expect(JSON.stringify(db.runs.find((r) => r.id === run.id)!.input)).not.toContain('data_base64');

    // 다시 실행: 참조를 그대로 받는다
    const again = await api.post<RunRow>('/runs', { workflow_id: wf.id, input: run.input });
    expect((again.input as { files: FileRef[] }).files).toEqual(files);
  });

  it('지원하지 않는 형식은 415, 다른 워크스페이스 참조는 422', async () => {
    const wf = db.workflows.find((w) => w.name === '사내 문서 Q&A')!;
    const bad = await fail(api.post('/runs', { workflow_id: wf.id, input: { f: { filename: 'a.docx', data_base64: 'UEsDBA==' } } }));
    expect(bad.status).toBe(415);
    const forged = { kind: 'file', filename: 'x.pdf', mime: 'application/pdf', size: 1, storage_key: 'uploads/other/x.pdf' };
    expect((await fail(api.post('/runs', { workflow_id: wf.id, input: { f: forged } }))).status).toBe(422);
  });
});

describe('첨부 포트·스키마', () => {
  it('이미지↔파일 포트는 연결되고 문자열과는 안 된다', () => {
    expect(isAssignable('file', 'file')).toBe(true);
    expect(isAssignable('image', 'file')).toBe(true);
    expect(isAssignable('file', 'image')).toBe(true);
    expect(isAssignable('file', 'string')).toBe(false);
  });

  it('file·files 필드는 moa-file 형식 스키마가 된다', () => {
    const schema = inputSchemaOf({ nodes: [{ id: 'in', type: 'input', name: '', config: { fields: [{ name: 'doc', type: 'file' }, { name: 'pics', type: 'files' }] }, ports_in: [], ports_out: [] }] }) as { properties: Record<string, unknown> };
    expect(schema.properties.doc).toEqual({ type: 'object', format: 'moa-file' });
    expect(schema.properties.pics).toEqual({ type: 'array', items: { type: 'object', format: 'moa-file' } });
  });

  it('예전에 저장한 LLM 노드에도 카탈로그의 첨부 포트를 붙인다', () => {
    const defn: Pick<WorkflowDefinition, 'nodes'> = {
      nodes: [{ id: 'llm1', type: 'llm', block: 'llm.generate', name: 'LLM', config: {}, ports_in: [{ name: 'query', type: 'string' }], ports_out: [] }],
    };
    const out = withCatalogPorts(defn, BLOCKS);
    expect(out.nodes[0]!.ports_in.map((p) => p.name)).toEqual(['query', 'context', 'attachments']);
    expect(withCatalogPorts(out, BLOCKS)).toBe(out); // 이미 있으면 그대로
  });

  it('기본 첨부를 올리면 assets 경로의 참조를 돌려주고, 실행 때 그 참조를 받는다', async () => {
    const ref = await api.post<FileRef>('/files', { filename: '규정.pdf', data_base64: PDF_B64 });
    expect([ref.kind, ref.filename, ref.mime]).toEqual(['file', '규정.pdf', 'application/pdf']);
    expect(ref.storage_key.startsWith(`uploads/${WS1}/assets/`)).toBe(true);
    expect((await fail(api.post('/files', { filename: 'a.docx', data_base64: 'UEsDBA==' }))).status).toBe(415);

    const wf = db.workflows.find((w) => w.name === '사내 문서 Q&A')!;
    const run = await api.post<RunRow>('/runs', { workflow_id: wf.id, input: { question: 'q', files: [ref] } });
    expect((run.input as { files: FileRef[] }).files).toEqual([ref]);
  });

  it('배포 입력 스키마에는 기본 첨부의 저장 경로 대신 파일 이름만 나온다', () => {
    const ref = { kind: 'file', filename: '규정.pdf', mime: 'application/pdf', size: 1, storage_key: 'uploads/w/assets/a.pdf' };
    const schema = inputSchemaOf({ nodes: [{ id: 'in', type: 'input', name: '', config: { fields: [{ name: 'guide', type: 'files', default: [ref] }, { name: 'n', type: 'number', default: 3 }] }, ports_in: [], ports_out: [] }] }) as { properties: Record<string, Record<string, unknown>> };
    expect(schema.properties.guide).toMatchObject({ 'x-moa-default-files': ['규정.pdf'] });
    expect(schema.properties.guide).not.toHaveProperty('default');
    expect(schema.properties.n).toMatchObject({ default: 3 });
  });
});
