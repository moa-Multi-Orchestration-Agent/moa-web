'use client';

import { useState } from 'react';
import { FileText, Image as ImageIcon, Loader2, X } from 'lucide-react';
import type { InputField } from '@/entities/workflow';
import { ATTACH_MAX_IMAGE_BYTES, DEFAULT_FILE_LIMITS, checkFiles, defaultRefs, formatBytes, uploadDefaultFile, type FileRef } from '@/shared/lib/attachments';
import { copy } from '@/shared/lib/copy';
import { Button } from '@/shared/ui/button';
import { FilePicker } from '@/shared/ui/file-picker';

/** 필드 타입 바꾸기: 파일이 아닌 타입이 되면 기본 첨부를 지우고, files → file이면 첫 파일만 남긴다. */
export function withFieldType(field: InputField, type: InputField['type']): InputField {
  const refs = defaultRefs(field.default);
  if (!refs.length) return { ...field, type };
  const { default: _old, ...rest } = field;
  if (type === 'files') return { ...rest, type, default: refs };
  if (type === 'file') return { ...rest, type, default: refs[0] };
  return { ...rest, type };
}

/**
 * 입력 필드(file·files)의 기본 첨부. 고르는 즉시 서버 저장소에 올리고 참조만 기본값에 넣는다.
 * 형식은 고르지 않는다(PDF·이미지 판별은 서버가 파일 내용으로 한다). 2개 이상이면 타입을 files로 바꾼다.
 */
export function DefaultFiles({ field, onChange, disabled }: { field: InputField; onChange: (next: InputField) => void; disabled?: boolean }) {
  const t = copy.attachments;
  const refs = defaultRefs(field.default);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const id = `default-files-${field.name}`;

  const save = (next: FileRef[]) => {
    const type: InputField['type'] = next.length > 1 ? 'files' : field.type;
    const { default: _old, ...rest } = field;
    if (!next.length) return onChange(rest);
    onChange({ ...rest, type, default: type === 'file' ? next[0] : next });
  };

  const add = async (picked: File[]) => {
    setError(null);
    setNote(null);
    const err = checkFiles(picked, DEFAULT_FILE_LIMITS, refs);
    if (err) return setError(err);
    setBusy(true);
    const uploaded: FileRef[] = [];
    try {
      for (const f of picked) uploaded.push(await uploadDefaultFile(f));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
    if (!uploaded.length) return;
    const next = [...refs, ...uploaded];
    if (field.type === 'file' && next.length > 1) setNote(t.switchedToFiles);
    save(next);
  };

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium">{t.defaultTitle}</p>
      <FilePicker
        id={id}
        files={[]}
        onChange={(picked) => void add(picked)}
        multiple
        compact
        disabled={disabled || busy}
        invalid={!!error}
        describedBy={`${id}-hint`}
        hint={busy ? t.uploading : t.defaultLimits(formatBytes(DEFAULT_FILE_LIMITS.maxFile), formatBytes(ATTACH_MAX_IMAGE_BYTES), DEFAULT_FILE_LIMITS.maxPdfPages)}
      />
      {busy ? <Loader2 className="text-muted size-3.5 animate-spin" aria-label={t.uploading} /> : null}
      {refs.length ? (
        <ul className="space-y-1">
          {refs.map((r, i) => (
            <li key={r.storage_key} className="bg-surface flex items-center gap-2 rounded px-2 py-1 text-xs">
              {r.mime === 'application/pdf' ? <FileText className="text-muted size-3.5 shrink-0" aria-hidden /> : <ImageIcon className="text-muted size-3.5 shrink-0" aria-hidden />}
              <span className="min-w-0 flex-1 truncate">{r.filename}</span>
              <span className="text-muted shrink-0">
                {formatBytes(r.size)}
                {r.pages ? ` · ${r.pages}쪽` : ''}
              </span>
              <Button type="button" variant="ghost" size="icon-xs" className="size-5" onClick={() => save(refs.filter((_, j) => j !== i))} disabled={disabled || busy} aria-label={t.remove(r.filename)}>
                <X aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      <p id={`${id}-hint`} className="text-muted text-xs">
        {t.defaultHint}
      </p>
      {note ? <p className="text-muted text-xs">{note}</p> : null}
      {error ? (
        <p className="text-danger text-xs" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
