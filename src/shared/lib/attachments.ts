/**
 * 실행 입력 첨부 파일. 브라우저에서 base64로 바꿔 실행 입력에 넣으면,
 * 서버가 실행 시작 때 저장소에 넣고 파일 참조({kind:'file', storage_key, …})로 바꾼다.
 * 한도는 백엔드 app/engine/files.py와 같다.
 */
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
