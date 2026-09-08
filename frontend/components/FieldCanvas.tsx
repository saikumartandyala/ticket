'use client';

import { useEffect, useRef } from 'react';

/**
 * Interactive dot-field background — ported 1:1 from the Claude Design mockup's
 * initField(). A grid of violet dots that ripple/push away from the cursor and
 * gently wave over time. Plus two soft blurred light-beams behind everything.
 *
 * Fixed, full-viewport, behind all content (z-0), pointer-events:none.
 */
export default function FieldCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;

    let dots: { x: number; y: number; ox: number; oy: number }[] = [];
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let px = -999;
    let py = -999;
    let raf = 0;

    const resize = () => {
      c.width = window.innerWidth * dpr;
      c.height = window.innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      dots = [];
      const gap = window.innerWidth < 700 ? 44 : 34;
      for (let x = gap / 2; x < window.innerWidth; x += gap)
        for (let y = gap / 2; y < window.innerHeight; y += gap)
          dots.push({ x, y, ox: x, oy: y });
    };
    resize();
    window.addEventListener('resize', resize);

    const move = (e: MouseEvent) => {
      px = e.clientX;
      py = e.clientY;
    };
    window.addEventListener('mousemove', move);

    const loop = (t: number) => {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      const mx = px;
      const my = py;
      for (const d of dots) {
        const dx = d.ox - mx;
        const dy = d.oy - my;
        const dist = Math.hypot(dx, dy);
        const R = 150;
        let tx = d.ox;
        let ty = d.oy;
        let boost = 0;
        if (dist < R) {
          const f = 1 - dist / R;
          tx += (dx / (dist || 1)) * f * 34;
          ty += (dy / (dist || 1)) * f * 34;
          boost = f;
        }
        d.x += (tx - d.x) * 0.12;
        d.y += (ty - d.y) * 0.12;
        const wave = 0.16 + 0.1 * Math.sin(t / 900 + d.ox * 0.012 + d.oy * 0.01);
        const a = Math.min(0.85, wave + boost * 0.75);
        ctx.beginPath();
        ctx.arc(d.x, d.y, 1 + boost * 1.6, 0, 6.283);
        ctx.fillStyle = `rgba(${168 + boost * 60},${85 + boost * 90},247,${a})`;
        ctx.fill();
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', move);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <>
      <canvas
        ref={canvasRef}
        style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', zIndex: 0, pointerEvents: 'none' }}
      />
      <div
        style={{
          position: 'fixed',
          top: '-30%',
          left: '10%',
          width: '52vw',
          height: '120vh',
          background: 'linear-gradient(180deg, rgba(168,85,247,.16), rgba(124,58,237,0))',
          filter: 'blur(60px)',
          animation: 'lmpBeam 14s ease-in-out infinite',
          zIndex: 0,
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'fixed',
          top: '-20%',
          right: '4%',
          width: '34vw',
          height: '110vh',
          background: 'linear-gradient(180deg, rgba(192,132,252,.12), rgba(5,3,8,0))',
          filter: 'blur(70px)',
          animation: 'lmpBeam 19s ease-in-out infinite reverse',
          zIndex: 0,
          pointerEvents: 'none',
        }}
      />
    </>
  );
}
