/**
 * 목 API의 첨부 처리. 백엔드 app/engine/files.py ingest_input_files와 같은 모양으로,
 * `{filename, data_base64}`를 파일 참조로 바꾼다. 목에서는 파일 내용을 보관하지 않는다.
 */
import { ATTACH_MAX_FILE_BYTES, ATTACH_MAX_FILES, ATTACH_MAX_TOTAL_BYTES, ATTACH_MIMES, isFileRef, type FileRef } from '@/shared/lib/attachments';
import { problem } from './http';
import { uuid } from './util';

const EXT: Record<string, string> = { 'application/pdf': '.pdf', 'image/png': '.png', 'image/jpeg': '.jpg', 'image/gif': '.gif', 'image/webp': '.webp' };

function sniff(b64: string): string | null {
  const head = b64.slice(0, 16);
  if (head.startsWith('JVBERi0')) return 'application/pdf';
  if (head.startsWith('iVBORw0KGgo')) return 'image/png';
  if (head.startsWith('/9j/')) return 'image/jpeg';
  if (head.startsWith('R0lGOD')) return 'image/gif';
  if (head.startsWith('UklGR')) return 'image/webp';
  return null;
}

const isUpload = (v: unknown): v is { filename?: string; data_base64: string } => !!v && typeof v === 'object' && typeof (v as { data_base64?: unknown }).data_base64 === 'string';

export function ingestMockFiles(wsId: string, input: Record<string, unknown>): Record<string, unknown> | Response {
  const items = Object.values(input).flatMap((v) => (Array.isArray(v) ? v : [v]));
  const uploads = items.filter(isUpload);
  const refs = items.filter(isFileRef);
  if (!uploads.length && !refs.length) return input;
  if (uploads.length + refs.length > ATTACH_MAX_FILES) return problem('MOA-VALIDATION', `첨부 파일은 한 번에 ${ATTACH_MAX_FILES}개까지입니다.`, {}, 422);
  if (refs.some((r) => !r.storage_key.startsWith(`uploads/${wsId}/`))) return problem('MOA-VALIDATION', '첨부를 찾을 수 없습니다. 다시 올려 주세요.', {}, 422);

  let total = refs.reduce((s, r) => s + (r.size || 0), 0);
  const convert = (u: { filename?: string; data_base64: string }): FileRef | Response => {
    const name = (u.filename ?? '').trim() || '첨부 파일';
    const data = u.data_base64.replace(/^data:[^,]*,/, '');
    const size = Math.floor((data.length * 3) / 4);
    const mime = sniff(data);
    if (!mime || !(ATTACH_MIMES as readonly string[]).includes(mime)) return problem('MOA-VALIDATION', `'${name}': PDF와 이미지(PNG·JPEG·GIF·WEBP)만 첨부할 수 있습니다.`, {}, 415);
    if (size > ATTACH_MAX_FILE_BYTES) return problem('MOA-VALIDATION', `'${name}' 파일이 너무 큽니다.`, {}, 413);
    total += size;
    return { kind: 'file', filename: name, mime, size, storage_key: `uploads/${wsId}/mock/${uuid()}${EXT[mime]}`, ...(mime === 'application/pdf' ? { pages: 1 } : {}) };
  };

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (Array.isArray(v)) {
      const next: unknown[] = [];
      for (const x of v) {
        const r = isUpload(x) ? convert(x) : x;
        if (r instanceof Response) return r;
        next.push(r);
      }
      out[k] = next;
    } else {
      const r = isUpload(v) ? convert(v) : v;
      if (r instanceof Response) return r;
      out[k] = r;
    }
  }
  if (total > ATTACH_MAX_TOTAL_BYTES) return problem('MOA-VALIDATION', '첨부 파일 합계가 너무 큽니다.', {}, 413);
  return out;
}
