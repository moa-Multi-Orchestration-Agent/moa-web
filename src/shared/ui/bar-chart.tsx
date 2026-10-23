'use client';

import { useMemo, useState } from 'react';

export interface BarDatum {
  label: string;
  value: number;
  /** 툴팁 보조 줄 */
  hint?: string;
}

/**
 * 단일 계열 막대 차트(SVG). 막대 하나 = 툴팁 대상(마우스·키보드 포커스),
 * 같은 값을 화면 낭독기용 표로도 제공한다. 색은 primary 토큰 하나만 쓴다.
 */
export function BarChart({
  data,
  height = 180,
  format = (v) => v.toLocaleString('ko-KR'),
  label,
  xLabel = (d) => d.label.slice(5),
}: {
  data: BarDatum[];
  height?: number;
  format?: (v: number) => string;
  label: string;
  xLabel?: (d: BarDatum) => string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 640;
  const pad = { l: 44, r: 8, t: 10, b: 22 };
  const max = useMemo(() => {
    const m = Math.max(1, ...data.map((d) => d.value));
    const mag = 10 ** Math.floor(Math.log10(m));
    return Math.ceil(m / mag) * mag;
  }, [data]);
  const innerW = W - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  const step = innerW / Math.max(1, data.length);
  const barW = Math.max(3, Math.min(28, step - 2));
  const ticks = [0, 0.5, 1].map((r) => r * max);
  const showX = (i: number) => data.length <= 8 || i === 0 || i === data.length - 1 || i === Math.floor(data.length / 2);

  if (!data.length) return <p className="text-muted py-8 text-center text-sm">표시할 데이터가 없어요.</p>;
  const h = hover !== null ? data[hover] : null;

  return (
    <figure className="relative" aria-label={label}>
      <svg viewBox={`0 0 ${W} ${height}`} className="h-auto w-full overflow-visible" role="img" aria-label={label}>
        {ticks.map((t) => {
          const y = pad.t + innerH - (t / max) * innerH;
          return (
            <g key={t}>
              <line x1={pad.l} x2={W - pad.r} y1={y} y2={y} stroke="var(--border)" strokeWidth={1} />
              <text x={pad.l - 6} y={y + 3} textAnchor="end" fontSize={10} fill="var(--muted)">
                {format(t)}
              </text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const bh = (d.value / max) * innerH;
          const x = pad.l + i * step + (step - barW) / 2;
          const y = pad.t + innerH - bh;
          const r = Math.min(4, barW / 2, bh);
          const path = bh <= 0 ? '' : `M${x},${y + bh} V${y + r} Q${x},${y} ${x + r},${y} H${x + barW - r} Q${x + barW},${y} ${x + barW},${y + r} V${y + bh} Z`;
          return (
            <g key={d.label}>
              {path ? <path d={path} fill="var(--primary)" opacity={hover === null || hover === i ? 1 : 0.55} /> : null}
              <rect
                x={pad.l + i * step}
                y={pad.t}
                width={step}
                height={innerH}
                fill="transparent"
                tabIndex={0}
                role="graphics-symbol"
                aria-label={`${d.label}: ${format(d.value)}`}
                onPointerEnter={() => setHover(i)}
                onPointerLeave={() => setHover(null)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                className="cursor-default outline-none"
              />
              {showX(i) ? (
                <text x={pad.l + i * step + step / 2} y={height - 6} textAnchor="middle" fontSize={10} fill="var(--muted)">
                  {xLabel(d)}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      {h ? (
        <div
          className="bg-popover pointer-events-none absolute top-0 z-10 rounded-md border px-2.5 py-1.5 text-xs shadow-md"
          style={{ left: `${((pad.l + (hover! + 0.5) * step) / W) * 100}%`, transform: 'translate(-50%, -100%)' }}
          role="status"
        >
          <p className="font-semibold tabular-nums">{format(h.value)}</p>
          <p className="text-muted">{h.label}</p>
          {h.hint ? <p className="text-muted">{h.hint}</p> : null}
        </div>
      ) : null}
      <table className="sr-only">
        <caption>{label}</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.label}>
              <th scope="row">{d.label}</th>
              <td>{format(d.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
