'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, LogOut, Menu, Plus, X } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { Logo } from './Logo';
import { ThemeToggle } from './ThemeToggle';
import { NotificationsMenu } from './NotificationsMenu';
import { usePopover } from './usePopover';
import { Avatar } from '../ui/misc';
import { ButtonLink, IconButton } from '../ui/Button';
import { cn } from '../../lib/cn';

function useNav(isAuthenticated: boolean) {
  return [
    { href: '/tickets', label: 'Browse' },
    { href: '/post', label: 'Sell a ticket' },
    ...(isAuthenticated ? [{ href: '/dashboard', label: 'Dashboard' }] : []),
  ];
}

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + '/');
}

function UserMenu() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { open, setOpen, ref } = usePopover();

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label="Account menu"
        className="flex h-9 items-center rounded-full pl-0.5 pr-0.5 transition-colors hover:bg-subtle"
      >
        <Avatar name={user?.name || user?.email} size={30} />
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-50 w-60 origin-top-right animate-pop-in overflow-hidden rounded-lg border border-line bg-surface/95 shadow-pop backdrop-blur-xl">
          <div className="border-b border-line px-4 py-3">
            <div className="truncate text-sm font-medium">{user?.name || 'Your account'}</div>
            {user?.email && <div className="truncate text-[13px] text-ink-3">{user.email}</div>}
          </div>
          <div className="p-1">
            <Link href="/dashboard" onClick={() => setOpen(false)} className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-ink-2 hover:bg-subtle hover:text-ink">
              <LayoutDashboard className="h-4 w-4" /> Dashboard
            </Link>
            <Link href="/post" onClick={() => setOpen(false)} className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-ink-2 hover:bg-subtle hover:text-ink">
              <Plus className="h-4 w-4" /> Sell a ticket
            </Link>
            <button
              onClick={() => { setOpen(false); logout(); router.push('/'); }}
              className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm text-ink-2 hover:bg-subtle hover:text-ink"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function Navbar() {
  const pathname = usePathname() || '/';
  const router = useRouter();
  const { isAuthenticated, hydrated, user, logout } = useAuthStore();
  const nav = useNav(isAuthenticated);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const [bar, setBar] = useState<{ left: number; width: number; visible: boolean }>({ left: 0, width: 0, visible: false });

  useEffect(() => setMobileOpen(false), [pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Sliding active-link indicator.
  const activeHref = nav.find((n) => isActive(pathname, n.href))?.href;
  useLayoutEffect(() => {
    const measure = () => {
      const el = navRef.current?.querySelector<HTMLElement>(`a[data-href="${activeHref}"]`);
      if (!el) { setBar((b) => ({ ...b, visible: false })); return; }
      setBar({ left: el.offsetLeft, width: el.offsetWidth, visible: true });
    };
    measure();
    document.fonts?.ready.then(measure);
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [activeHref, nav.length]);

  return (
    <header
      className={cn(
        'sticky top-0 z-40 border-b transition-[background-color,border-color,box-shadow,backdrop-filter] duration-300',
        scrolled || mobileOpen
          ? 'border-line bg-bg/70 shadow-[0_8px_30px_-12px_rgb(0_0_0/0.12)] backdrop-blur-xl backdrop-saturate-150'
          : 'border-transparent bg-transparent',
      )}
    >
      <div className="container-page flex h-14 items-center gap-8">
        <Logo />

        <nav ref={navRef} className="relative hidden h-full items-center gap-1 md:flex" aria-label="Main">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              data-href={n.href}
              className={cn(
                'relative rounded-md px-3 py-1.5 text-sm transition-colors duration-200',
                isActive(pathname, n.href) ? 'text-ink' : 'text-ink-2 hover:bg-subtle/70 hover:text-ink',
              )}
            >
              {n.label}
            </Link>
          ))}
          <span
            aria-hidden
            className="pointer-events-none absolute -bottom-px h-[2px] rounded-full bg-accent transition-[left,width,opacity] duration-500 ease-out-expo"
            style={{ left: bar.left + 12, width: Math.max(0, bar.width - 24), opacity: bar.visible ? 1 : 0 }}
          />
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle />
          {hydrated && isAuthenticated && <NotificationsMenu />}
          {hydrated && (
            isAuthenticated ? (
              <div className="ml-1 hidden md:block"><UserMenu /></div>
            ) : (
              pathname !== '/auth' && (
                <ButtonLink href="/auth" variant="ghost" size="sm" className="ml-1 hidden md:inline-flex">
                  Sign in
                </ButtonLink>
              )
            )
          )}
          {pathname !== '/post' && (
            <ButtonLink href="/post" size="sm" className="ml-2 hidden sm:inline-flex">
              <Plus className="h-4 w-4" /> List a ticket
            </ButtonLink>
          )}
          <IconButton label={mobileOpen ? 'Close menu' : 'Open menu'} className="md:hidden" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </IconButton>
        </div>
      </div>

      {mobileOpen && (
        <div className="origin-top animate-pop-in border-t border-line md:hidden">
          <nav className="container-page flex flex-col py-2" aria-label="Mobile">
            {nav.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={cn('rounded-md px-2 py-3 text-[15px]', isActive(pathname, n.href) ? 'font-medium text-ink' : 'text-ink-2')}
              >
                {n.label}
              </Link>
            ))}
            <div className="my-2 border-t border-line" />
            {isAuthenticated ? (
              <>
                <div className="px-2 py-2 text-[13px] text-ink-3">Signed in as {user?.name || user?.email}</div>
                <button
                  onClick={() => { logout(); router.push('/'); }}
                  className="rounded-md px-2 py-3 text-left text-[15px] text-ink-2"
                >
                  Sign out
                </button>
              </>
            ) : (
              <Link href="/auth" className="rounded-md px-2 py-3 text-[15px] text-ink-2">Sign in</Link>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
