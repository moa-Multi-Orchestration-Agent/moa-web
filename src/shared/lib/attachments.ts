/**
 * 실행 입력 첨부 파일. 브라우저에서 base64로 바꿔 실행 입력에 넣으면,
 * 서버가 실행 시작 때 저장소에 넣고 파일 참조({kind:'file', storage_key, …})로 바꾼다.
 * 한도는 백엔드 app/engine/files.py와 같다.
 */
import { api } from './api-client';
import { copy } from './copy';

export const ATTACH_MAX_FILE_BYTES = 20 * 1024 * 1024;
export const ATTACH_MAX_TOTAL_BYTES = 20 * 1024 * 1024;
export const ATTACH_MAX_FILES = 10;
export const ATTACH_MIMES = ['application/pdf', 'image/png', 'image/jpeg', 'image/gif', 'image/webp'] as const;
export const ATTACH_ACCEPT = ATTACH_MIMES.join(',');
/** Anthropic API 이미지 한 장 한도. 실행 첨부·기본 첨부 모두 */
export const ATTACH_MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** 입력 노드 기본 첨부: 실행마다 모델에 같이 가므로 실행 첨부보다 작게 둔다(백엔드 DEFAULT_MAX_*와 같음) */
export const DEFAULT_FILE_LIMITS = { maxFile: 10 * 1024 * 1024, maxTotal: ATTACH_MAX_TOTAL_BYTES, maxFiles: ATTACH_MAX_FILES, maxPdfPages: 100 } as const;
export const RUN_FILE_LIMITS = { maxFile: ATTACH_MAX_FILE_BYTES, maxTotal: ATTACH_MAX_TOTAL_BYTES, maxFiles: ATTACH_MAX_FILES, maxPdfPages: 600 } as const;
export type FileLimits = { maxFile: number; maxTotal: number; maxFiles: number; maxPdfPages: number };

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

/**
 * 고른 파일 목록 검사. 문제가 없으면 null. 형식은 사용자가 고르지 않고 파일로 판단한다
 * (브라우저 type은 참고용이고, 최종 판별은 서버가 파일 내용으로 한다). PDF 쪽수는 서버가 센다.
 * `existing`은 이미 올려 둔 크기(기본 첨부)로, 개수·합계에 함께 센다.
 */
export function checkFiles(files: { name: string; size: number; type: string }[], limits: FileLimits = RUN_FILE_LIMITS, existing: { size: number }[] = []): string | null {
  const t = copy.attachments;
  if (files.length + existing.length > limits.maxFiles) return t.tooMany(limits.maxFiles);
  for (const f of files) {
    if (!(ATTACH_MIMES as readonly string[]).includes(f.type)) return t.badType(f.name);
    if (f.size > limits.maxFile) return t.tooBig(f.name, formatBytes(limits.maxFile));
    if (f.type.startsWith('image/') && f.size > ATTACH_MAX_IMAGE_BYTES) return t.imageTooBig(f.name, formatBytes(ATTACH_MAX_IMAGE_BYTES));
  }
  const total = [...files, ...existing].reduce((s, f) => s + f.size, 0);
  if (total > limits.maxTotal) return t.totalTooBig(formatBytes(limits.maxTotal));
  return null;
}

/** 입력 필드 기본값에서 파일 참조만 꺼낸다(file은 참조 하나, files는 목록) */
export function defaultRefs(value: unknown): FileRef[] {
  return (Array.isArray(value) ? value : [value]).filter(isFileRef);
}

/** 기본 첨부 하나를 서버 저장소에 올리고 참조를 받는다. 워크플로 정의에는 이 참조만 저장한다. */
export async function uploadDefaultFile(file: File): Promise<FileRef> {
  return api.post<FileRef>('/files', await fileToUpload(file));
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
