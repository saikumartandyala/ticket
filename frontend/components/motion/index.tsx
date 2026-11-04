'use client';

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { cn } from '../../lib/cn';

export function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Fires once when the element first scrolls into view. */
export function useInView<T extends Element>(options: IntersectionObserverInit = { threshold: 0.2 }) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || inView) return;
    if (typeof IntersectionObserver === 'undefined') { setInView(true); return; }
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setInView(true); io.disconnect(); }
    }, options);
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView]);
  return { ref, inView };
}

/* ------------------------------------------------------------------ */
/* Rotating word: slides + blurs between words, container width eases. */
/* ------------------------------------------------------------------ */
export function RotatingWord({ words, interval = 2600, className }: { words: string[]; interval?: number; className?: string }) {
  const [i, setI] = useState(0);
  const [width, setWidth] = useState<number | undefined>();
  const refs = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const t = setInterval(() => setI((x) => (x + 1) % words.length), interval);
    return () => clearInterval(t);
  }, [words.length, interval]);

  useLayoutEffect(() => {
    const measure = () => { const el = refs.current[i]; if (el) setWidth(el.offsetWidth); };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [i]);

  // Font swap can change widths after first paint.
  useEffect(() => {
    document.fonts?.ready.then(() => { const el = refs.current[i]; if (el) setWidth(el.offsetWidth); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const prev = (i - 1 + words.length) % words.length;
  return (
    <span
      className={cn('relative inline-block whitespace-nowrap align-bottom transition-[width] duration-700 ease-out-expo', className)}
      style={{ width, height: '1.06em' }}
    >
      <span className="sr-only">{words[i]}</span>
      {words.map((w, k) => (
        <span
          key={w}
          aria-hidden
          ref={(el) => { refs.current[k] = el; }}
          className={cn(
            'absolute left-0 top-0 whitespace-nowrap transition-[opacity,transform,filter] duration-700 ease-out-expo',
            k === i ? 'translate-y-0 opacity-100 blur-0' : k === prev ? '-translate-y-[0.55em] opacity-0 blur-[6px]' : 'translate-y-[0.55em] opacity-0 blur-[6px]',
          )}
        >
          {w}
        </span>
      ))}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Split-flap text: characters shuffle before landing, like a          */
/* departure board. Use with a monospace font to avoid width jitter.  */
/* ------------------------------------------------------------------ */
const DIGITS = '0123456789';
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function FlipText({
  text,
  className,
  delay = 0,
  speed = 34,
  whenVisible = true,
}: {
  text: string;
  className?: string;
  delay?: number;
  speed?: number;
  whenVisible?: boolean;
}) {
  const { ref, inView } = useInView<HTMLSpanElement>({ threshold: 0.1 });
  const [shown, setShown] = useState(text);
  const started = useRef(false);

  useEffect(() => {
    if (whenVisible && !inView) return;
    if (prefersReducedMotion()) { setShown(text); return; }
    const chars = text.split('');
    let frame = 0;
    let raf = 0;
    let last = 0;
    const settleAt = (idx: number) => 5 + idx * 2;
    const total = settleAt(chars.length);
    const startAt = performance.now() + (started.current ? 0 : delay);
    started.current = true;

    const tick = (now: number) => {
      if (now < startAt) { raf = requestAnimationFrame(tick); return; }
      if (now - last >= speed) {
        last = now;
        frame += 1;
        setShown(
          chars
            .map((c, idx) => {
              if (frame >= settleAt(idx)) return c;
              if (/\d/.test(c)) return DIGITS[Math.floor(Math.random() * 10)];
              if (/[A-Za-z]/.test(c)) return LETTERS[Math.floor(Math.random() * 26)];
              return c;
            })
            .join(''),
        );
      }
      if (frame < total) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [text, inView, whenVisible, delay, speed]);

  return (
    <span ref={ref} className={className} aria-label={text}>
      <span aria-hidden>{shown}</span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Count up to a number when it scrolls into view.                     */
/* ------------------------------------------------------------------ */
export function CountUp({
  value,
  decimals = 0,
  duration = 1100,
  prefix = '',
  suffix = '',
  className,
}: {
  value: number;
  decimals?: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}) {
  const { ref, inView } = useInView<HTMLSpanElement>({ threshold: 0.3 });
  const [n, setN] = useState(0);
  const from = useRef(0);

  useEffect(() => {
    if (!inView) return;
    if (prefersReducedMotion()) { setN(value); return; }
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 4);
      setN(a + (value - a) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, value, duration]);

  return (
    <span ref={ref} className={className}>
      {prefix}
      {n.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
      {suffix}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Infinite marquee. Children are rendered twice for a seamless loop.  */
/* ------------------------------------------------------------------ */
export function Marquee({ children, seconds = 40, className }: { children: React.ReactNode; seconds?: number; className?: string }) {
  return (
    <div className={cn('fade-x group relative flex overflow-hidden', className)}>
      <div
        className="flex shrink-0 animate-marquee items-center group-hover:[animation-play-state:paused] motion-reduce:animate-none"
        style={{ ['--marquee-duration' as any]: `${seconds}s` }}
      >
        <div className="flex shrink-0 items-center">{children}</div>
        <div className="flex shrink-0 items-center" aria-hidden>{children}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 3D tilt with a light glare that follows the pointer.                */
/* ------------------------------------------------------------------ */
export function Tilt({ children, max = 6, className }: { children: React.ReactNode; max?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  const onMove = (e: React.PointerEvent) => {
    const el = ref.current;
    if (!el || e.pointerType !== 'mouse' || prefersReducedMotion()) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    el.style.setProperty('--ry', `${(px - 0.5) * max * 2}deg`);
    el.style.setProperty('--rx', `${(0.5 - py) * max * 2}deg`);
    el.style.setProperty('--gx', `${px * 100}%`);
    el.style.setProperty('--gy', `${py * 100}%`);
    el.style.setProperty('--glare', '1');
  };
  const onLeave = () => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty('--rx', '0deg');
    el.style.setProperty('--ry', '0deg');
    el.style.setProperty('--glare', '0');
  };

  return (
    <div className={cn('[perspective:1200px]', className)}>
      <div
        ref={ref}
        onPointerMove={onMove}
        onPointerLeave={onLeave}
        className="relative transition-transform duration-500 ease-out-expo will-change-transform [transform-style:preserve-3d]"
        style={{ transform: 'rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg))' }}
      >
        {children}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-lg transition-opacity duration-500"
          style={{
            opacity: 'var(--glare, 0)',
            background: 'radial-gradient(600px circle at var(--gx, 50%) var(--gy, 50%), rgb(255 255 255 / 0.16), transparent 40%)',
            mixBlendMode: 'overlay',
          }}
        />
      </div>
    </div>
  );
}
