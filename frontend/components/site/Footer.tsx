import Link from 'next/link';
import { Logo } from './Logo';

export function Footer() {
  return (
    <footer className="mt-16 border-t border-line">
      <div className="container-page grid gap-8 py-10 sm:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-ink-2">
            <span className="block font-medium text-ink">Every ticket deserves a destination.</span>
            A peer-to-peer board for tickets people can&apos;t use, and the people who need one today.
          </p>
        </div>
        <div>
          <div className="eyebrow mb-3">Marketplace</div>
          <ul className="space-y-2 text-sm">
            <li><Link className="link-u text-ink-2 hover:text-ink" href="/tickets">Browse tickets</Link></li>
            <li><Link className="link-u text-ink-2 hover:text-ink" href="/post">Sell a ticket</Link></li>
            <li><Link className="link-u text-ink-2 hover:text-ink" href="/dashboard?tab=alerts">Ticket alerts</Link></li>
          </ul>
        </div>
        <div>
          <div className="eyebrow mb-3">Account</div>
          <ul className="space-y-2 text-sm">
            <li><Link className="link-u text-ink-2 hover:text-ink" href="/auth">Sign in</Link></li>
            <li><Link className="link-u text-ink-2 hover:text-ink" href="/dashboard">Dashboard</Link></li>
            <li><Link className="link-u text-ink-2 hover:text-ink" href="/#how">How it works</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-line">
        <div className="container-page flex flex-col gap-2 py-5 text-xs text-ink-3 sm:flex-row sm:justify-between">
          <span>© {new Date().getFullYear()} TickOrbit</span>
          <span>We never handle payments. Buyers and sellers settle directly.</span>
        </div>
      </div>
    </footer>
  );
}
