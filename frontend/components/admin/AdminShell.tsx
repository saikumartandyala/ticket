'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ArrowLeftRight, Bug, ChartLine, Database, ExternalLink, LayoutDashboard, LogOut, Megaphone, ScrollText, SearchX, Star, Tags, Ticket, Users,
} from 'lucide-react';
import { api } from '../../lib/api';
import type { User } from '../../lib/types';
import { useAuthStore } from '../../store/authStore';
import { LogoLockup } from '../site/Logo';
import { ThemeToggle } from '../site/ThemeToggle';
import { Avatar, EmptyState, Skeleton } from '../ui/misc';
import { ButtonLink, IconButton } from '../ui/Button';
import { cn } from '../../lib/cn';

const NAV = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard },
  { href: '/admin/analytics', label: 'Analytics', icon: ChartLine },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/listings', label: 'Listings', icon: Ticket },
  { href: '/admin/transfers', label: 'Transfers', icon: ArrowLeftRight },
  { href: '/admin/reviews', label: 'Reviews', icon: Star },
  { href: '/admin/categories', label: 'Categories', icon: Tags },
  { href: '/admin/broadcast', label: 'Broadcast', icon: Megaphone },
  { href: '/admin/errors', label: 'Errors', icon: Bug },
  { href: '/admin/database', label: 'Database', icon: Database },
  { href: '/admin/audit', label: 'Audit log', icon: ScrollText },
];

function active(pathname: string, href: string) {
  return href === '/admin' ? pathname === '/admin' : pathname.startsWith(href);
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '/admin';
  const router = useRouter();
  const { hydrated, isAuthenticated, user, updateUser, logout } = useAuthStore();
  const [access, setAccess] = useState<'checking' | 'ok' | 'denied'>('checking');
  const isLogin = pathname === '/admin/login';

  useEffect(() => {
    if (isLogin || !hydrated) return;
    if (!isAuthenticated) { router.replace('/admin/login'); return; }
    // Re-check with the server: the stored profile may predate a role change.
    api<User>('/auth/me')
      .then((me) => { updateUser(me); setAccess(me.is_admin ? 'ok' : 'denied'); })
      .catch((e) => { if (e?.status === 401) { logout(); router.replace('/admin/login'); } else setAccess('denied'); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, isAuthenticated, isLogin]);

  if (isLogin) return <>{children}</>;

  if (access === 'checking') {
    return (
      <div className="grid min-h-screen lg:grid-cols-[248px_1fr]">
        <div className="hidden border-r border-line lg:block" />
        <div className="space-y-4 p-8">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-lg" />)}</div>
          <Skeleton className="h-72 rounded-lg" />
        </div>
      </div>
    );
  }

  if (access === 'denied') {
    // Same as any unknown URL — don't advertise that a console exists here.
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <EmptyState
          icon={SearchX}
          title="Page not found"
          body="The page you're looking for doesn't exist or has moved."
          action={<ButtonLink href="/" variant="secondary" size="sm">Back to TickOrbit</ButtonLink>}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      {/* Sidebar */}
      <aside className="sticky top-0 hidden h-screen flex-col border-r border-line bg-surface/70 backdrop-blur-xl lg:flex">
        <div className="flex h-16 items-center gap-2.5 border-b border-line px-5">
          <LogoLockup size="sm" />
          <span className="ml-auto rounded bg-accent/10 px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-accent">Admin</span>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-3" aria-label="Admin">
          {NAV.map((n) => {
            const on = active(pathname, n.href);
            const Icon = n.icon;
            return (
              <Link
                key={n.href}
                href={n.href}
                className={cn(
                  'group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-all duration-200',
                  on ? 'bg-subtle font-medium text-ink' : 'text-ink-2 hover:bg-subtle/60 hover:text-ink',
                )}
              >
                <span className={cn('absolute inset-y-1.5 left-0 w-[3px] rounded-r-full bg-accent transition-transform duration-300 ease-out-expo', on ? 'scale-y-100' : 'scale-y-0')} />
                <Icon className={cn('h-4 w-4 transition-colors', on ? 'text-accent' : 'text-ink-3 group-hover:text-ink-2')} />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="space-y-1 border-t border-line p-3">
          <Link href="/" className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-ink-2 transition-colors hover:bg-subtle/60 hover:text-ink">
            <ExternalLink className="h-4 w-4 text-ink-3" /> View site
          </Link>
          <div className="flex items-center gap-2.5 rounded-md px-2 py-2">
            <Avatar name={user?.name || user?.email} size={30} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-medium">{user?.name || 'Admin'}</div>
              <div className="truncate text-xs text-ink-3">{user?.email}</div>
            </div>
            <ThemeToggle />
            <IconButton label="Sign out" onClick={() => { logout(); router.push('/admin/login'); }}><LogOut className="h-4 w-4" /></IconButton>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 border-b border-line bg-bg/80 backdrop-blur-xl lg:hidden">
        <div className="flex h-14 items-center gap-2 px-4">
          <LogoLockup size="sm" />
          <span className="rounded bg-accent/10 px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase text-accent">Admin</span>
          <div className="ml-auto flex items-center">
            <ThemeToggle />
            <IconButton label="View site" onClick={() => router.push('/')}><ExternalLink className="h-4 w-4" /></IconButton>
            <IconButton label="Sign out" onClick={() => { logout(); router.push('/admin/login'); }}><LogOut className="h-4 w-4" /></IconButton>
          </div>
        </div>
        <nav className="no-scrollbar flex gap-1 overflow-x-auto px-3 pb-2" aria-label="Admin">
          {NAV.map((n) => {
            const on = active(pathname, n.href);
            const Icon = n.icon;
            return (
              <Link key={n.href} href={n.href} className={cn('flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] transition-colors', on ? 'border-ink bg-inverse text-inverse-ink' : 'border-line-strong text-ink-2')}>
                <Icon className="h-3.5 w-3.5" />{n.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <main className="min-w-0 px-4 py-6 sm:px-8 lg:py-8">
        <div className="mx-auto max-w-[1240px]">{children}</div>
      </main>
    </div>
  );
}
