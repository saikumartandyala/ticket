import React from 'react';
import { CircleCheck, Info, TriangleAlert } from 'lucide-react';
import { cn } from '../../lib/cn';
import { initials } from '../../lib/format';

type Tone = 'neutral' | 'accent' | 'good' | 'warn' | 'danger' | 'solid';

const tones: Record<Tone, string> = {
  neutral: 'border-line-strong text-ink-2',
  accent: 'border-accent/35 bg-accent/[0.08] text-accent',
  good: 'border-good/30 bg-good/[0.08] text-good',
  warn: 'border-warn/35 bg-warn/[0.08] text-warn',
  danger: 'border-danger/30 bg-danger/[0.08] text-danger',
  solid: 'border-transparent bg-inverse text-inverse-ink',
};

export function Badge({ tone = 'neutral', className, children }: { tone?: Tone; className?: string; children: React.ReactNode }) {
  return (
    <span className={cn('inline-flex h-6 items-center gap-1 whitespace-nowrap rounded border px-2 text-xs font-medium', tones[tone], className)}>
      {children}
    </span>
  );
}

export function Avatar({ name, size = 36, className }: { name?: string | null; size?: number; className?: string }) {
  return (
    <span
      aria-hidden
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
      className={cn('inline-flex shrink-0 items-center justify-center rounded-full border border-line-strong bg-subtle font-semibold text-ink-2', className)}
    >
      {initials(name)}
    </span>
  );
}

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('rounded-lg border border-line bg-surface shadow-card', className)}>{children}</div>;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} />;
}

export function Notice({
  tone = 'info',
  title,
  children,
  className,
}: {
  tone?: 'info' | 'error' | 'success';
  title?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const Icon = tone === 'error' ? TriangleAlert : tone === 'success' ? CircleCheck : Info;
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'flex gap-2.5 rounded-md border px-3.5 py-3 text-sm leading-snug',
        tone === 'error' && 'border-danger/30 bg-danger/[0.06] text-danger',
        tone === 'success' && 'border-good/30 bg-good/[0.06] text-good',
        tone === 'info' && 'border-line bg-subtle/60 text-ink-2',
        className,
      )}
    >
      <Icon className="mt-px h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0">
        {title && <div className="font-medium">{title}</div>}
        {children && <div className={cn(title && 'mt-0.5 opacity-90')}>{children}</div>}
      </div>
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
  className,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  body?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-14 text-center', className)}>
      {Icon && (
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full border border-line-strong text-ink-3">
          <Icon className="h-5 w-5" />
        </div>
      )}
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      {body && <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-ink-2">{body}</p>}
      {action && <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 border-b border-line pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <div className="eyebrow mb-2">{eyebrow}</div>}
        <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.02em] sm:text-[34px]">{title}</h1>
        {description && <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-ink-2">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
