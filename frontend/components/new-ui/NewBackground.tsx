'use client';

import React, { useEffect, useRef } from 'react';

/**
 * Light-theme animated background for the new UI: a blue dot-field that ripples
 * away from the cursor, plus two soft drifting light beams. Fixed behind all
 * content (z-index 0). Ported from the LastMinutePass design canvas.
 */
export default function NewBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;

    let dots: { x: number; y: number; ox: number; oy: number }[] = [];
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let px = -999, py = -999;
    let raf = 0;

    const resize = () => {
      c.width = innerWidth * dpr;
      c.height = innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      dots = [];
      const gap = innerWidth < 700 ? 44 : 34;
      for (let x = gap / 2; x < innerWidth; x += gap)
        for (let y = gap / 2; y < innerHeight; y += gap)
          dots.push({ x, y, ox: x, oy: y });
    };

    const onMove = (e: MouseEvent) => { px = e.clientX; py = e.clientY; };

    const loop = (t: number) => {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      for (const d of dots) {
        const dx = d.ox - px, dy = d.oy - py;
        const dist = Math.hypot(dx, dy);
        const R = 150;
        let tx = d.ox, ty = d.oy, boost = 0;
        if (dist < R) {
          const f = 1 - dist / R;
          tx += (dx / (dist || 1)) * f * 34;
          ty += (dy / (dist || 1)) * f * 34;
          boost = f;
        }
        d.x += (tx - d.x) * 0.12;
        d.y += (ty - d.y) * 0.12;
        const wave = 0.1 + 0.07 * Math.sin(t / 900 + d.ox * 0.012 + d.oy * 0.01);
        const a = Math.min(0.5, wave + boost * 0.42);
        ctx.beginPath();
        ctx.arc(d.x, d.y, 1 + boost * 1.6, 0, 6.283);
        ctx.fillStyle = `rgba(${Math.round(37 + boost * 20)},${Math.round(99 + boost * 40)},235,${a})`;
        ctx.fill();
      }
      raf = requestAnimationFrame(loop);
    };

    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', onMove);
    raf = requestAnimationFrame(loop);
    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <>
      <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', zIndex: 0, pointerEvents: 'none' }} />
      <div style={{ position: 'fixed', top: '-30%', left: '10%', width: '52vw', height: '120vh', background: 'linear-gradient(180deg, rgba(37,99,235,.16), rgba(30,64,175,0))', filter: 'blur(60px)', animation: 'lmpBeam 14s ease-in-out infinite', zIndex: 0, pointerEvents: 'none' }} />
      <div style={{ position: 'fixed', top: '-20%', right: '4%', width: '34vw', height: '110vh', background: 'linear-gradient(180deg, rgba(147,197,253,.12), rgba(255,255,255,0))', filter: 'blur(70px)', animation: 'lmpBeam 19s ease-in-out infinite reverse', zIndex: 0, pointerEvents: 'none' }} />
    </>
  );
}
