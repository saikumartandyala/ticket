'use client';

/**
 * DotField — interactive canvas dot-grid background with cursor bulge/glow.
 * Rebuilt from the documented react-bits props (exact upstream source was not
 * available at integration time), so behavior approximates the original.
 */
import { useEffect, useRef } from 'react';
import './DotField.css';

interface DotFieldProps {
  dotRadius?: number;
  dotSpacing?: number;
  cursorRadius?: number;
  cursorForce?: number;
  bulgeOnly?: boolean;
  bulgeStrength?: number;
  glowRadius?: number;
  sparkle?: boolean;
  waveAmplitude?: number;
  gradientFrom?: string;
  gradientTo?: string;
  glowColor?: string;
  dotColor?: string;
  className?: string;
}

export default function DotField({
  dotRadius = 1.3,
  dotSpacing = 24,
  cursorRadius = 150,
  cursorForce = 0.1,
  bulgeOnly = true,
  bulgeStrength = 67,
  glowRadius = 160,
  sparkle = false,
  waveAmplitude = 0,
  gradientFrom = 'rgba(168, 85, 247, 0.35)',
  gradientTo = 'rgba(180, 151, 207, 0.25)',
  glowColor = '#120F17',
  dotColor = 'rgba(214, 206, 250, 0.16)',
  className = '',
}: DotFieldProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const mouseRef = useRef<{ x: number; y: number; active: boolean }>({ x: -9999, y: -9999, active: false });
  const seedsRef = useRef<Float32Array | null>(null);
  // per-dot [dx, dy] displacement that eases toward its target each frame —
  // the lag between target and current position is what reads as "liquid"
  // rather than dots snapping instantly to a function of cursor position.
  const offsetsRef = useRef<Float32Array | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let width = 0;
    let height = 0;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      const rect = root.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const cols = Math.ceil(width / dotSpacing) + 1;
      const rows = Math.ceil(height / dotSpacing) + 1;
      seedsRef.current = new Float32Array(cols * rows).map(() => Math.random() * Math.PI * 2);
      offsetsRef.current = new Float32Array(cols * rows * 2);
    };

    const ro = new ResizeObserver(resize);
    ro.observe(root);
    resize();

    // Listen on window (not the root element) — the root sits *behind* the
    // hero's text/buttons/cards in stacking order, so it never receives
    // mousemove itself; window still gets the bubbled event regardless of
    // which foreground element the cursor is actually over.
    const handleMove = (e: MouseEvent) => {
      const rect = root.getBoundingClientRect();
      const withinBounds =
        e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;

      if (!withinBounds) {
        mouseRef.current.active = false;
        if (glowRef.current) glowRef.current.style.opacity = '0';
        return;
      }

      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      mouseRef.current = { x, y, active: true };
      if (glowRef.current) {
        glowRef.current.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
        glowRef.current.style.opacity = '0.45';
      }
    };
    const handleWindowLeave = (e: MouseEvent) => {
      if (e.relatedTarget !== null) return;
      mouseRef.current.active = false;
      if (glowRef.current) glowRef.current.style.opacity = '0';
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseout', handleWindowLeave);

    const start = performance.now();

    const draw = (now: number) => {
      const t = (now - start) / 1000;
      ctx.clearRect(0, 0, width, height);

      const cols = Math.ceil(width / dotSpacing) + 1;
      const rows = Math.ceil(height / dotSpacing) + 1;
      const seeds = seedsRef.current;
      const { x: mx, y: my, active } = mouseRef.current;

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const idx = row * cols + col;
          let x = col * dotSpacing;
          let y = row * dotSpacing;

          if (waveAmplitude > 0) {
            const seed = seeds ? seeds[idx] ?? 0 : 0;
            y += Math.sin(t * 0.8 + col * 0.35 + seed) * waveAmplitude;
          }

          let radius = dotRadius;
          let alpha = 0.16;

          // Target displacement for this frame — computed fresh from the
          // dot's base grid position each time (not the previous offset),
          // then eased toward below so motion trails the cursor like liquid
          // instead of snapping straight to the target.
          let targetOffsetX = 0;
          let targetOffsetY = 0;

          if (active) {
            const dx = x - mx;
            const dy = y - my;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < cursorRadius) {
              // ease the falloff so dots near the cursor pop noticeably
              // instead of a barely-perceptible linear ramp
              const proximity = Math.pow(1 - dist / cursorRadius, 1.5);
              radius = dotRadius * (1 + (bulgeStrength / 100) * proximity * 2.2);
              alpha = Math.min(0.95, 0.16 + proximity * 0.85);

              if (!bulgeOnly && dist > 0.001) {
                const push = proximity * cursorForce * dotSpacing * 3;
                targetOffsetX = (dx / dist) * push;
                targetOffsetY = (dy / dist) * push;
              }
            }
          }

          if (offsetsRef.current) {
            const oi = idx * 2;
            const offsets = offsetsRef.current;
            offsets[oi] += (targetOffsetX - offsets[oi]) * 0.14;
            offsets[oi + 1] += (targetOffsetY - offsets[oi + 1]) * 0.14;
            x += offsets[oi];
            y += offsets[oi + 1];
          }

          if (sparkle) {
            const seed = seeds ? seeds[idx] ?? 0 : 0;
            alpha *= 0.6 + 0.4 * Math.sin(t * 2 + seed * 4);
          }

          ctx.beginPath();
          ctx.arc(x, y, Math.max(0.3, radius), 0, Math.PI * 2);
          ctx.fillStyle = dotColor.replace(/[\d.]+\)$/, `${alpha})`);
          ctx.fill();
        }
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseout', handleWindowLeave);
    };
  }, [dotRadius, dotSpacing, cursorRadius, cursorForce, bulgeOnly, bulgeStrength, sparkle, waveAmplitude, dotColor]);

  return (
    <div ref={rootRef} className={`dotfield-root ${className}`}>
      <div
        className="dotfield-bg"
        style={{ background: `linear-gradient(135deg, ${gradientFrom} 0%, ${gradientTo} 100%)` }}
      />
      <canvas ref={canvasRef} className="dotfield-canvas" />
      <div
        ref={glowRef}
        className="dotfield-glow"
        style={
          {
            '--glow-color': glowColor,
            width: `${glowRadius * 2}px`,
            height: `${glowRadius * 2}px`,
          } as React.CSSProperties
        }
      />
    </div>
  );
}
