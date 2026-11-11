/**
 * 실행 입력 첨부 파일. 브라우저에서 base64로 바꿔 실행 입력에 넣으면,
 * 서버가 실행 시작 때 저장소에 넣고 파일 참조({kind:'file', storage_key, …})로 바꾼다.
 * 한도는 백엔드 app/engine/files.py와 같다.
 */
import { api, apiUrl, getWorkspaceId } from './api-client';
import { copy } from './copy';

export const ATTACH_MAX_FILE_BYTES = 20 * 1024 * 1024;
export const ATTACH_MAX_TOTAL_BYTES = 20 * 1024 * 1024;
export const ATTACH_MAX_FILES = 10;
export const ATTACH_MIMES = ['application/pdf', 'image/png', 'image/jpeg', 'image/gif', 'image/webp'] as const;
export const ATTACH_ACCEPT = ATTACH_MIMES.join(',');

/** 서버가 저장한 뒤 돌려주는 참조 */
export interface FileRef {
  kind: 'file';
  filename: string;
  mime: string;
  size: number;
  storage_key: string;
  pages?: number;
}

/** 실행 입력으로 보내는 업로드 형태 */
export interface FileUpload {
  filename: string;
  mime: string;
  data_base64: string;
}

export function isFileRef(v: unknown): v is FileRef {
  return !!v && typeof v === 'object' && (v as FileRef).kind === 'file' && typeof (v as FileRef).storage_key === 'string';
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)}KB`;
  return `${(n / (1024 * 1024)).toFixed(1)}MB`;
}

/** 고른 파일 목록 검사. 문제가 없으면 null */
export function checkFiles(files: { name: string; size: number; type: string }[]): string | null {
  const t = copy.attachments;
  if (files.length > ATTACH_MAX_FILES) return t.tooMany(ATTACH_MAX_FILES);
  for (const f of files) {
    if (!(ATTACH_MIMES as readonly string[]).includes(f.type)) return t.badType(f.name);
    if (f.size > ATTACH_MAX_FILE_BYTES) return t.tooBig(f.name, formatBytes(ATTACH_MAX_FILE_BYTES));
  }
  const total = files.reduce((s, f) => s + f.size, 0);
  if (total > ATTACH_MAX_TOTAL_BYTES) return t.totalTooBig(formatBytes(ATTACH_MAX_TOTAL_BYTES));
  return null;
}

export function fileToUpload(file: File): Promise<FileUpload> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result ?? '');
      resolve({ filename: file.name, mime: file.type, data_base64: url.slice(url.indexOf(',') + 1) });
    };
    reader.onerror = () => reject(reader.error ?? new Error(copy.attachments.readFailed(file.name)));
    reader.readAsDataURL(file);
  });
}

export function filesToUploads(files: File[]): Promise<FileUpload[]> {
  return Promise.all(files.map(fileToUpload));
}

/** 실행 결과 안의 파일 참조를 모두 찾는다(노드가 만든 문서·첨부). 같은 파일은 한 번만. */
export function collectFileRefs(value: unknown, depth = 0, out: FileRef[] = []): FileRef[] {
  if (depth > 5 || value == null || typeof value !== 'object') return out;
  if (isFileRef(value)) {
    if (!out.some((r) => r.storage_key === value.storage_key)) out.push(value);
    return out;
  }
  for (const v of Array.isArray(value) ? value : Object.values(value as Record<string, unknown>)) collectFileRefs(v, depth + 1, out);
  return out;
}

function downloadPath(ref: FileRef): string {
  return `/downloads/${ref.storage_key.split('/').map(encodeURIComponent).join('/')}`;
}

/** 인증 내려받기 주소(링크 href·새 탭용). 링크로 여는 요청은 헤더를 못 붙이므로 워크스페이스를 쿼리로 보낸다. */
export function downloadUrl(ref: FileRef): string {
  const q = new URLSearchParams({ name: ref.filename });
  const ws = getWorkspaceId();
  if (ws) q.set('workspace_id', ws);
  return apiUrl(`${downloadPath(ref)}?${q.toString()}`);
}

/**
 * 파일 내려받기(버튼 클릭이나 실행 완료 직후). api-client로 받아 저장하므로
 * 권한·만료 오류는 ApiError로 던지고(오류 JSON이 파일로 저장되지 않게), 목 API에서도 동작한다.
 */
export async function startDownload(ref: FileRef): Promise<void> {
  const blob = await api.blob(downloadPath(ref), { query: { name: ref.filename } });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = ref.filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
