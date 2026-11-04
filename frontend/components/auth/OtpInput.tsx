'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '../../lib/cn';

export type OtpStatus = 'idle' | 'verifying' | 'error' | 'success';

const LENGTH = 6;

/**
 * One real (transparent) input captures typing, paste and SMS/email
 * one-time-code autofill; six boxes render on top of it.
 *
 * States:
 *  - idle:      boxes fill with a springy pop, caret blinks in the active box
 *  - verifying: a wave runs across the boxes
 *  - error:     row shakes, boxes turn red (parent clears the value after)
 *  - success:   boxes turn green one by one, collapse, and a check draws in
 */
export function OtpInput({
  value,
  onChange,
  onComplete,
  status = 'idle',
  autoFocus,
  label = 'Verification code',
}: {
  value: string;
  onChange: (v: string) => void;
  onComplete?: (code: string) => void;
  status?: OtpStatus;
  autoFocus?: boolean;
  label?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const locked = status === 'verifying' || status === 'success';

  useEffect(() => { if (autoFocus) ref.current?.focus(); }, [autoFocus]);

  // Re-focus after an error clears so the user can retype straight away.
  useEffect(() => {
    if (status === 'idle' && value === '' && autoFocus) ref.current?.focus();
  }, [status, value, autoFocus]);

  useEffect(() => {
    if (status !== 'success') { setCollapsed(false); return; }
    const t = setTimeout(() => setCollapsed(true), 520);
    return () => clearTimeout(t);
  }, [status]);

  const handle = (raw: string) => {
    if (locked) return;
    const digits = raw.replace(/\D/g, '').slice(0, LENGTH);
    onChange(digits);
    if (digits.length === LENGTH && digits !== value) onComplete?.(digits);
  };

  const active = Math.min(value.length, LENGTH - 1);

  return (
    <div className="relative">
      {/* Success mark (sits where the boxes were) */}
      {status === 'success' && collapsed && (
        <div className="absolute inset-0 flex items-center justify-center gap-3" role="status">
          <SuccessMark />
          <span className="animate-scale-in text-[15px] font-semibold text-good [animation-delay:350ms]">Verified</span>
        </div>
      )}

      <div
        className={cn('relative flex gap-2 sm:gap-2.5', status === 'error' && 'animate-shake')}
        onClick={() => ref.current?.focus()}
      >
        <input
          ref={ref}
          value={value}
          onChange={(e) => handle(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={LENGTH}
          aria-label={label}
          disabled={locked}
          className="absolute inset-0 z-10 h-full w-full cursor-text opacity-0"
        />
        {Array.from({ length: LENGTH }).map((_, i) => {
          const ch = value[i] || '';
          const isActive = focused && !locked && i === active && status !== 'error';
          return (
            <div
              key={i}
              style={{
                animationDelay: status === 'verifying' ? `${i * 90}ms` : undefined,
                transitionDelay: status === 'success' ? `${i * 60}ms` : '0ms',
              }}
              className={cn(
                'relative flex h-14 flex-1 items-center justify-center rounded-md border bg-surface font-mono text-[22px] font-medium transition-[border-color,background-color,box-shadow,color] duration-300 sm:h-[60px]',
                status === 'idle' && (isActive
                  ? 'border-accent shadow-[0_0_0_4px_rgb(var(--accent)/0.14)]'
                  : ch ? 'border-ink/60 text-ink' : 'border-line-strong text-ink'),
                status === 'verifying' && 'animate-otp-wave border-line-strong text-ink',
                status === 'error' && 'border-danger bg-danger/[0.06] text-danger',
                status === 'success' && 'border-good bg-good/[0.08] text-good',
                status === 'success' && collapsed && 'animate-otp-collapse',
              )}
            >
              {ch ? (
                <span key={`${i}-${ch}`} className="animate-digit-in">{ch}</span>
              ) : isActive ? (
                <span className="h-6 w-[2px] animate-caret-blink rounded-full bg-accent" />
              ) : (
                <span className="h-1 w-1 rounded-full bg-line-strong" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Circle draws, check draws, a soft ring bursts outward. */
export function SuccessMark({ size = 44 }: { size?: number }) {
  return (
    <span className="relative inline-flex" style={{ width: size, height: size }}>
      <span className="absolute inset-0 animate-burst rounded-full bg-good/40" />
      <svg viewBox="0 0 52 52" className="relative" style={{ width: size, height: size }} aria-hidden>
        <circle cx="26" cy="26" r="24" className="fill-good/10 stroke-good" strokeWidth="2.5"
          strokeDasharray="151" strokeDashoffset="151">
          <animate attributeName="stroke-dashoffset" from="151" to="0" dur="0.6s" fill="freeze" calcMode="spline" keySplines=".65 0 .35 1" keyTimes="0;1" />
        </circle>
        <path d="M15 27 l7 7 l15 -15" fill="none" className="stroke-good" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"
          strokeDasharray="36" strokeDashoffset="36">
          <animate attributeName="stroke-dashoffset" from="36" to="0" begin="0.45s" dur="0.4s" fill="freeze" calcMode="spline" keySplines=".65 0 .35 1" keyTimes="0;1" />
        </path>
      </svg>
    </span>
  );
}
