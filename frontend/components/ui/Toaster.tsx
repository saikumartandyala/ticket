'use client';

import { CircleCheck, TriangleAlert, X } from 'lucide-react';
import { useToastStore } from '../../store/toastStore';
import { cn } from '../../lib/cn';

export function Toaster() {
  const { toasts, dismiss } = useToastStore();
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:right-5 sm:items-end">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto flex w-full max-w-sm animate-toast-in items-start gap-3 rounded-lg border border-line bg-surface/95 p-3.5 pr-2.5 shadow-pop backdrop-blur-xl"
        >
          {t.tone === 'success' && <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-good" />}
          {t.tone === 'error' && <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-danger" />}
          <div className="min-w-0 flex-1">
            <div className={cn('text-sm font-medium', t.tone === 'error' ? 'text-danger' : 'text-ink')}>{t.title}</div>
            {t.body && <div className="mt-0.5 text-[13px] leading-snug text-ink-2">{t.body}</div>}
          </div>
          <button aria-label="Dismiss" onClick={() => dismiss(t.id)} className="rounded p-1 text-ink-3 hover:bg-subtle hover:text-ink">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
