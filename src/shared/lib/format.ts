/** 표시용 포맷 함수 (한국어 UI) */

const rtf = new Intl.RelativeTimeFormat('ko', { numeric: 'auto' });

export function relativeTime(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return '—';
  const diff = new Date(iso).getTime() - now;
  const abs = Math.abs(diff);
  const min = 60_000;
  const hour = 60 * min;
  const day = 24 * hour;
  if (abs < min) return diff <= 0 ? '방금 전' : '곧';
  if (abs < hour) return rtf.format(Math.round(diff / min), 'minute');
  if (abs < day) return rtf.format(Math.round(diff / hour), 'hour');
  if (abs < 30 * day) return rtf.format(Math.round(diff / day), 'day');
  return formatDate(iso);
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return `${formatDate(iso)} ${formatTime(iso)}`;
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function formatUsd(v: number | string | null | undefined, digits?: number): string {
  const n = Number(v ?? 0);
  const d = digits ?? (n !== 0 && Math.abs(n) < 1 ? 4 : 2);
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })}`;
}

export function formatKrw(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—';
  if (v === 0) return '무료';
  return `₩${v.toLocaleString('ko-KR')}`;
}

export function formatNumber(v: number | null | undefined): string {
  return (v ?? 0).toLocaleString('ko-KR');
}

export function formatTokens(v: number | null | undefined): string {
  const n = v ?? 0;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${(n / 1000).toFixed(1)}k`;
  return n.toLocaleString('ko-KR');
}

export function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return '—';
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}초`;
  const m = Math.floor(s / 60);
  return `${m}분 ${Math.round(s % 60)}초`;
}

export function durationBetween(a?: string | null, b?: string | null): number | null {
  if (!a) return null;
  const end = b ? new Date(b).getTime() : Date.now();
  return Math.max(0, end - new Date(a).getTime());
}

export function percent(v: number, digits = 0): string {
  return `${(v * 100).toFixed(digits)}%`;
}

/** 아주 거친 토큰 추정(한글 1자 ≈ 1토큰, 영문 4자 ≈ 1토큰) — 화면 표시용 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  const hangul = (text.match(/[ㄱ-힝]/g) ?? []).length;
  const rest = text.length - hangul;
  return Math.ceil(hangul * 1 + rest / 4);
}
