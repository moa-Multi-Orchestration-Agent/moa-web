'use client';

import type { InputField } from '@/entities/workflow';
import { checkFiles, filesToUploads, isFileRef, type FileRef } from '@/shared/lib/attachments';
import { copy } from '@/shared/lib/copy';
import { FilePicker } from '@/shared/ui/file-picker';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';

export const isFileField = (f: InputField) => f.type === 'file' || f.type === 'files';

/** 대화창 위쪽의 나머지 입력 칸. 글 칸은 문자열, 첨부 칸은 파일 선택이다. */
export function ExtraFields({
  fields,
  extra,
  onExtra,
  files,
  onFiles,
  reused,
  disabled,
}: {
  fields: InputField[];
  extra: Record<string, string>;
  onExtra: (name: string, v: string) => void;
  files: Record<string, File[]>;
  onFiles: (name: string, v: File[]) => void;
  reused: Record<string, FileRef[]>;
  disabled?: boolean;
}) {
  if (!fields.length) return null;
  return (
    <div className="bg-surface grid grid-cols-2 gap-3 border-b px-5 py-3">
      {fields.map((f) => (
        <div key={f.name} className={isFileField(f) ? 'col-span-2 space-y-1' : 'space-y-1'}>
          <Label htmlFor={`wf-in-${f.name}`} className="text-xs">
            {f.description || f.name}
            {f.required ? ' *' : ''}
          </Label>
          {isFileField(f) ? (
            <>
              <FilePicker id={`wf-in-${f.name}`} files={files[f.name] ?? []} onChange={(v) => onFiles(f.name, v)} multiple={f.type === 'files'} disabled={disabled} compact />
              {!files[f.name]?.length && reused[f.name]?.length ? <p className="text-muted text-xs">{copy.attachments.reused(reused[f.name]!.length)}</p> : null}
            </>
          ) : (
            <Input
              id={`wf-in-${f.name}`}
              className="h-8 text-sm"
              value={extra[f.name] ?? ''}
              placeholder={f.default !== undefined ? `기본값: ${String(f.default)}` : f.enum?.join(' / ')}
              onChange={(e) => onExtra(f.name, e.target.value)}
              disabled={disabled}
            />
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * 첨부 칸 값 만들기: 새로 고른 파일은 base64 업로드로, 고른 게 없으면 앞 실행에서 서버가 돌려준 참조를 다시 쓴다.
 * 문제가 있으면 오류 문구를 던진다.
 */
export async function fileInputs(fields: InputField[], files: Record<string, File[]>, reused: Record<string, FileRef[]>): Promise<Record<string, unknown>> {
  const fileFields = fields.filter(isFileField);
  const picked = fileFields.flatMap((f) => files[f.name] ?? []);
  const err = picked.length ? checkFiles(picked) : null;
  if (err) throw new Error(err);
  const out: Record<string, unknown> = {};
  for (const f of fileFields) {
    const mine = files[f.name] ?? [];
    if (mine.length) {
      const uploads = await filesToUploads(mine);
      out[f.name] = f.type === 'file' ? uploads[0] : uploads;
    } else if (reused[f.name]?.length) {
      out[f.name] = f.type === 'file' ? reused[f.name]![0] : reused[f.name];
    } else if (f.required) {
      throw new Error(`${f.description || f.name}: ${copy.attachments.required}`);
    }
  }
  return out;
}

/** 실행 응답의 입력에서 서버가 만든 파일 참조를 꺼낸다(다음 메시지에서 다시 올리지 않으려고) */
export function refsFromInput(fields: InputField[], input: unknown): Record<string, FileRef[]> {
  const out: Record<string, FileRef[]> = {};
  if (!input || typeof input !== 'object') return out;
  for (const f of fields.filter(isFileField)) {
    const v = (input as Record<string, unknown>)[f.name];
    const refs = (Array.isArray(v) ? v : [v]).filter(isFileRef);
    if (refs.length) out[f.name] = refs;
  }
  return out;
}
