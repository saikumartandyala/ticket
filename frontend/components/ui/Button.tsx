import React from 'react';
import Link from 'next/link';
import { LoaderCircle } from 'lucide-react';
import { cn } from '../../lib/cn';

type Variant = 'primary' | 'accent' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const base =
  'group relative inline-flex items-center justify-center gap-2 overflow-hidden whitespace-nowrap rounded-md font-medium transition-[background-color,border-color,color,transform,box-shadow] duration-200 ease-out-expo active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 select-none [&_svg]:transition-transform [&_svg]:duration-300 [&_svg]:ease-out-expo';

const variants: Record<Variant, string> = {
  primary:
    'sheen bg-inverse text-inverse-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.14),0_1px_2px_rgb(0_0_0/0.2)] hover:-translate-y-px hover:shadow-[inset_0_1px_0_rgb(255_255_255/0.14),0_8px_20px_-6px_rgb(0_0_0/0.35)]',
  accent:
    'sheen bg-accent text-accent-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.25),0_1px_2px_rgb(0_0_0/0.15)] hover:-translate-y-px hover:shadow-[inset_0_1px_0_rgb(255_255_255/0.25),0_10px_24px_-8px_rgb(var(--accent)/0.6)]',
  secondary: 'border border-line-strong bg-surface text-ink shadow-[0_1px_2px_rgb(0_0_0/0.04)] hover:-translate-y-px hover:border-ink-3 hover:shadow-card',
  ghost: 'text-ink-2 hover:bg-subtle hover:text-ink',
  danger: 'border border-danger/30 bg-transparent text-danger hover:bg-danger/10',
};

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px]',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-5 text-[15px]',
};

export function buttonClass(variant: Variant = 'primary', size: Size = 'md', className?: string) {
  return cn(base, variants[variant], sizes[size], className);
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button ref={ref} type={type} disabled={disabled || loading} className={buttonClass(variant, size, className)} {...rest}>
      {loading && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});

type LinkProps = React.ComponentProps<typeof Link> & { variant?: Variant; size?: Size };

export function ButtonLink({ variant = 'primary', size = 'md', className, ...rest }: LinkProps) {
  return <Link className={buttonClass(variant, size, className)} {...rest} />;
}

export function IconButton({
  label,
  className,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'relative inline-flex h-9 w-9 items-center justify-center rounded-md text-ink-2 transition-[background-color,color,transform] duration-200 hover:bg-subtle hover:text-ink active:scale-90',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
