'use client';

import { Download, FileText, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { collectFileRefs, downloadUrl, formatBytes, startDownload, type FileRef } from '@/shared/lib/attachments';
import { copy } from '@/shared/lib/copy';
import { cn } from '@/shared/lib/utils';

/** 실행 결과에 들어 있는 파일(문서 내보내기 노드 결과 등)을 내려받기 링크로 보여 준다. 파일이 없으면 아무것도 안 그린다. */
export function FileDownloads({ value, refs, className }: { value?: unknown; refs?: FileRef[]; className?: string }) {
  const files = refs ?? collectFileRefs(value);
  if (!files.length) return null;
  return (
    <ul className={cn('space-y-1.5', className)} aria-label={copy.attachments.downloads}>
      {files.map((f) => (
        <li key={f.storage_key}>
          <a
            href={downloadUrl(f)}
            download={f.filename}
            onClick={(e) => {
              e.preventDefault();
              startDownload(f).catch((err: Error) => toast.error(copy.attachments.downloadFailed(err.message)));
            }}
            className="bg-surface hover:border-primary flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors"
            aria-label={copy.attachments.download(f.filename)}
          >
            {f.mime === 'application/pdf' ? <FileText className="text-muted size-4 shrink-0" aria-hidden /> : <ImageIcon className="text-muted size-4 shrink-0" aria-hidden />}
            <span className="min-w-0 flex-1 truncate font-medium">{f.filename}</span>
            <span className="text-muted shrink-0 text-xs">
              {f.mime === 'application/pdf' ? 'PDF' : 'PNG'} · {formatBytes(f.size)}
              {f.pages ? ` · ${f.pages}쪽` : ''}
            </span>
            <Download className="text-primary size-4 shrink-0" aria-hidden />
          </a>
        </li>
      ))}
    </ul>
  );
}
