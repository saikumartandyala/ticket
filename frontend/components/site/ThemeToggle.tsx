'use client';

import { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import { Moon, Sun } from 'lucide-react';
import { getTheme, setTheme, type Theme } from '../../lib/theme';
import { IconButton } from '../ui/Button';
import { prefersReducedMotion } from '../motion';
import { cn } from '../../lib/cn';

export function ThemeToggle() {
  const [theme, setLocal] = useState<Theme | null>(null);
  useEffect(() => setLocal(getTheme()), []);

  const next: Theme = theme === 'dark' ? 'light' : 'dark';

  const toggle = (e: React.MouseEvent) => {
    const apply = () => { setTheme(next); setLocal(next); };
    const doc = document as Document & { startViewTransition?: (cb: () => void) => { ready: Promise<void> } };
    if (!doc.startViewTransition || prefersReducedMotion()) { apply(); return; }

    // Circular wipe expanding from the button.
    const x = e.clientX || window.innerWidth - 40;
    const y = e.clientY || 28;
    const r = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
    const t = doc.startViewTransition(() => flushSync(apply));
    t.ready.then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
        { duration: 650, easing: 'cubic-bezier(.16,1,.3,1)', pseudoElement: '::view-transition-new(root)' } as KeyframeAnimationOptions,
      );
    }).catch(() => {});
  };

  return (
    <IconButton label={`Switch to ${next} theme`} onClick={toggle} className="overflow-hidden">
      <Sun className={cn('absolute h-[18px] w-[18px] transition-all duration-500 ease-out-expo', theme === 'dark' ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-50 opacity-0')} />
      <Moon className={cn('absolute h-[18px] w-[18px] transition-all duration-500 ease-out-expo', theme === 'dark' ? 'rotate-90 scale-50 opacity-0' : 'rotate-0 scale-100 opacity-100')} />
    </IconButton>
  );
}
