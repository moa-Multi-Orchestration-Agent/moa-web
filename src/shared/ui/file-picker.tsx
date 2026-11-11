'use client';

import { useRef, useState } from 'react';
import { FileText, Image as ImageIcon, Paperclip, X } from 'lucide-react';
import { ATTACH_ACCEPT, ATTACH_MAX_FILES, ATTACH_MAX_TOTAL_BYTES, formatBytes } from '@/shared/lib/attachments';
import { copy } from '@/shared/lib/copy';
import { cn } from '@/shared/lib/utils';
import { Button } from './button';

interface FilePickerProps {
  id: string;
  files: File[];
  onChange: (files: File[]) => void;
  multiple?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
  compact?: boolean;
}

/** PDF·이미지 첨부 고르기(끌어다 놓기 지원). 검사는 부르는 쪽에서 checkFiles로 한다. */
export function FilePicker({ id, files, onChange, multiple = true, disabled, invalid, describedBy, compact }: FilePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const t = copy.attachments;

  const add = (list: FileList | null) => {
    const picked = Array.from(list ?? []);
    if (!picked.length) return;
    onChange(multiple ? [...files, ...picked] : picked.slice(0, 1));
  };

  return (
    <div className="space-y-1.5">
      <div
        className={cn(
          'flex items-center gap-2 rounded-md border border-dashed px-3 transition-colors',
          compact ? 'py-1.5' : 'py-2.5',
          over ? 'border-primary bg-primary/5' : invalid ? 'border-danger' : 'border-border',
          disabled && 'opacity-50',
        )}
        onDragOver={(e) => {
          if (disabled) return;
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          if (!disabled) add(e.dataTransfer.files);
        }}
      >
        <Button type="button" variant="outline" size="xs" onClick={() => inputRef.current?.click()} disabled={disabled} aria-describedby={describedBy}>
          <Paperclip aria-hidden /> {t.pick}
        </Button>
        <span className="text-muted min-w-0 truncate text-xs">
          {compact ? t.limits(ATTACH_MAX_FILES, formatBytes(ATTACH_MAX_TOTAL_BYTES)) : `${t.dropHint} · ${t.limits(ATTACH_MAX_FILES, formatBytes(ATTACH_MAX_TOTAL_BYTES))}`}
        </span>
        <input
          ref={inputRef}
          id={id}
          type="file"
          className="sr-only"
          accept={ATTACH_ACCEPT}
          multiple={multiple}
          disabled={disabled}
          aria-invalid={invalid}
          onChange={(e) => {
            add(e.target.files);
            e.target.value = ''; // 같은 파일을 다시 고를 수 있게
          }}
        />
      </div>
      {files.length ? (
        <ul className="space-y-1">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="bg-surface flex items-center gap-2 rounded px-2 py-1 text-xs">
              {f.type === 'application/pdf' ? <FileText className="text-muted size-3.5 shrink-0" aria-hidden /> : <ImageIcon className="text-muted size-3.5 shrink-0" aria-hidden />}
              <span className="min-w-0 flex-1 truncate">{f.name}</span>
              <span className="text-muted shrink-0">{formatBytes(f.size)}</span>
              <Button type="button" variant="ghost" size="icon-xs" className="size-5" onClick={() => onChange(files.filter((_, j) => j !== i))} disabled={disabled} aria-label={t.remove(f.name)}>
                <X aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
