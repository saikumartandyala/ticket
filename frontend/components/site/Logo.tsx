/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import { cn } from '../../lib/cn';

/**
 * TickOrbit brand artwork (public/brand/). Each asset has a light-theme file
 * and a "-dark" file where the navy parts are light, so it reads on both
 * backgrounds. `onInverse` flips that for panels with the inverse surface.
 */
const ASSETS = {
  mark: { w: 120, h: 96 },
  wordmark: { w: 286, h: 64 },
  logo: { w: 480, h: 346 },
} as const;

type Asset = keyof typeof ASSETS;

function BrandImage({ asset, className, onInverse = false, alt = '' }: { asset: Asset; className?: string; onInverse?: boolean; alt?: string }) {
  const { w, h } = ASSETS[asset];
  const light = `/brand/tickorbit-${asset}.png`;
  const dark = `/brand/tickorbit-${asset}-dark.png`;
  return (
    <>
      <img src={onInverse ? dark : light} width={w} height={h} alt={alt} draggable={false}
        className={cn('w-auto select-none dark:hidden', className)} />
      <img src={onInverse ? light : dark} width={w} height={h} alt={alt} draggable={false}
        className={cn('hidden w-auto select-none dark:block', className)} />
    </>
  );
}

/** The orbit "t" with the ticket — the favicon mark. */
export function LogoMark({ className, onInverse }: { className?: string; onInverse?: boolean }) {
  return <BrandImage asset="mark" onInverse={onInverse} className={cn('h-7', className)} />;
}

/** Mark + "tickorbit" wordmark side by side, for headers. */
export function LogoLockup({ className, size = 'md', onInverse }: { className?: string; size?: 'sm' | 'md'; onInverse?: boolean }) {
  return (
    <span className={cn('flex items-center gap-1.5', className)}>
      <BrandImage asset="mark" onInverse={onInverse} className={size === 'sm' ? 'h-6' : 'h-8'} />
      <BrandImage asset="wordmark" onInverse={onInverse} alt="TickOrbit" className={size === 'sm' ? 'h-[17px]' : 'h-[21px]'} />
    </span>
  );
}

/** The full stacked logo (mark above the wordmark). */
export function LogoFull({ className, onInverse }: { className?: string; onInverse?: boolean }) {
  return <BrandImage asset="logo" onInverse={onInverse} alt="TickOrbit" className={cn('h-28', className)} />;
}

export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn('flex items-center', className)} aria-label="TickOrbit home">
      <LogoLockup />
    </Link>
  );
}
