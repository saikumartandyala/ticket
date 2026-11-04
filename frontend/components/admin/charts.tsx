'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '../../lib/cn';

function niceMax(v: number) {
  if (v <= 4) return 4;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * p;
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, w };
}

/**
 * Single-series area chart over time. One y-axis, recessive grid,
 * 2px line, crosshair + tooltip on hover.
 */
export function AreaChart({
  data,
  height = 220,
  unit = '',
  formatX = (s: string) => s,
}: {
  data: { x: string; y: number }[];
  height?: number;
  unit?: string;
  formatX?: (s: string) => string;
}) {
  const { ref, w } = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const pad = { t: 12, r: 12, b: 26, l: 32 };
  const innerW = Math.max(0, w - pad.l - pad.r);
  const innerH = height - pad.t - pad.b;
  const max = niceMax(Math.max(0, ...data.map((d) => d.y)));
  const x = (i: number) => pad.l + (data.length <= 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const y = (v: number) => pad.t + innerH - (v / max) * innerH;

  const { line, area } = useMemo(() => {
    if (!w || data.length === 0) return { line: '', area: '' };
    const pts = data.map((d, i) => [x(i), y(d.y)] as const);
    // Smooth with a monotone-ish cubic.
    let dLine = `M${pts[0][0]},${pts[0][1]}`;
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1];
      const [x1, y1] = pts[i];
      const cx = (x0 + x1) / 2;
      dLine += ` C${cx},${y0} ${cx},${y1} ${x1},${y1}`;
    }
    const base = pad.t + innerH;
    return { line: dLine, area: `${dLine} L${pts[pts.length - 1][0]},${base} L${pts[0][0]},${base} Z` };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w, data, max]);

  // Whole-number ticks that divide the axis evenly.
  const parts = max % 4 === 0 ? 4 : max % 5 === 0 ? 5 : 2;
  const ticks = Array.from({ length: parts + 1 }, (_, k) => (max / parts) * k);
  const every = Math.ceil(data.length / 7);

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left - pad.l;
    const i = Math.round((px / innerW) * (data.length - 1));
    setHover(Math.max(0, Math.min(data.length - 1, i)));
  };

  const h = hover !== null ? data[hover] : null;

  return (
    <div ref={ref} className="relative w-full" style={{ height }}>
      {w > 0 && (
        <svg width={w} height={height} onPointerMove={onMove} onPointerLeave={() => setHover(null)} className="block touch-none" role="img" aria-label="Activity over time">
          <defs>
            <linearGradient id="areaFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="rgb(var(--accent))" stopOpacity="0.22" />
              <stop offset="100%" stopColor="rgb(var(--accent))" stopOpacity="0" />
            </linearGradient>
          </defs>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={w - pad.r} y1={y(t)} y2={y(t)} stroke="rgb(var(--line))" strokeDasharray={t === 0 ? undefined : '2 4'} />
              <text x={pad.l - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-ink-3 font-mono text-[10px]">{t}</text>
            </g>
          ))}
          {data.map((d, i) =>
            i % every === 0 || i === data.length - 1 ? (
              <text key={d.x} x={x(i)} y={height - 6} textAnchor={i === data.length - 1 ? 'end' : i === 0 ? 'start' : 'middle'} className="fill-ink-3 font-mono text-[10px]">{formatX(d.x)}</text>
            ) : null,
          )}
          <path d={area} fill="url(#areaFill)" className="transition-[d] duration-500" />
          <path d={line} fill="none" stroke="rgb(var(--accent))" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          {hover !== null && h && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + innerH} stroke="rgb(var(--ink-3))" strokeDasharray="3 3" />
              <circle cx={x(hover)} cy={y(h.y)} r="5" fill="rgb(var(--accent))" stroke="rgb(var(--surface))" strokeWidth="2" />
            </g>
          )}
        </svg>
      )}
      {hover !== null && h && (
        <div
          className="pointer-events-none absolute top-1 z-10 -translate-x-1/2 animate-pop-in rounded-md border border-line bg-surface px-3 py-2 text-xs shadow-pop"
          style={{ left: Math.min(Math.max(x(hover), 70), w - 70) }}
        >
          <div className="text-ink-3">{formatX(h.x)}</div>
          <div className="mt-0.5 font-mono text-sm font-medium text-ink num">{h.y.toLocaleString('en-IN')}{unit}</div>
        </div>
      )}
    </div>
  );
}

/** Horizontal labelled bars, one hue (magnitude). */
export function BarList({ items, format = (n: number) => n.toLocaleString('en-IN') }: { items: { label: string; value: number; hint?: string }[]; format?: (n: number) => string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  const [shown, setShown] = useState(false);
  useEffect(() => { const t = requestAnimationFrame(() => setShown(true)); return () => cancelAnimationFrame(t); }, []);
  return (
    <ul className="space-y-3">
      {items.map((it, idx) => (
        <li key={it.label} className="group" title={`${it.label}: ${format(it.value)}`}>
          <div className="mb-1.5 flex items-baseline justify-between gap-3 text-[13px]">
            <span className="truncate text-ink-2 transition-colors group-hover:text-ink">{it.label}</span>
            <span className="font-mono text-ink num">{format(it.value)}{it.hint && <span className="ml-1.5 text-ink-3">{it.hint}</span>}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-subtle">
            <div
              className={cn('h-full rounded-full bg-accent transition-[width,opacity] duration-700 ease-out-expo group-hover:opacity-80')}
              style={{ width: shown ? `${(it.value / max) * 100}%` : '0%', transitionDelay: `${idx * 60}ms` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
