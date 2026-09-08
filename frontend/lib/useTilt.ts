'use client';

import { useEffect, useRef } from 'react';

/**
 * 3D mouse-tilt — ported from the design's mousemove handler.
 * Rotates the target element based on cursor position across the viewport.
 * hero uses (11, 8); detail uses (7, 5).
 */
export function useTilt<T extends HTMLElement>(ry = 11, rx = 8) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const move = (e: MouseEvent) => {
      const mx = (e.clientX / window.innerWidth) * 2 - 1;
      const my = (e.clientY / window.innerHeight) * 2 - 1;
      el.style.transform = `rotateY(${mx * ry}deg) rotateX(${-my * rx}deg)`;
    };
    window.addEventListener('mousemove', move);
    return () => window.removeEventListener('mousemove', move);
  }, [ry, rx]);

  return ref;
}
