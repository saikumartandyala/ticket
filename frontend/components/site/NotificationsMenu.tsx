'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell } from 'lucide-react';
import { api } from '../../lib/api';
import { parseUtc, relativeTime, stripEmoji } from '../../lib/format';
import type { Notification } from '../../lib/types';
import { useAuthStore } from '../../store/authStore';
import { IconButton } from '../ui/Button';
import { usePopover } from './usePopover';
import { cn } from '../../lib/cn';

function hrefFor(n: Notification): string {
  const d = n.data || {};
  if (d.match_id) return `/chat/${d.match_id}`;
  if (n.notif_type === 'interest') return '/dashboard?tab=requests';
  if (d.listing_id) return `/tickets/${d.listing_id}`;
  return '/dashboard';
}

export function NotificationsMenu() {
  const router = useRouter();
  const { isAuthenticated: signedIn, logout } = useAuthStore();
  const { open, setOpen, ref } = usePopover();
  const [items, setItems] = useState<Notification[]>([]);

  const load = useCallback(async () => {
    if (!signedIn) return;
    try {
      setItems(await api<Notification[]>('/notifications'));
    } catch (e: any) {
      if (e?.status === 401) logout();
    }
  }, [signedIn, logout]);

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  const unread = items.filter((n) => !n.is_read).length;

  const toggle = () => {
    const willOpen = !open;
    setOpen(willOpen);
    if (willOpen && unread > 0) {
      api('/notifications/read', { method: 'POST' }).catch(() => {});
      // Keep the dots visible while the panel is open; clear them afterwards.
      setTimeout(() => setItems((xs) => xs.map((n) => ({ ...n, is_read: true }))), 1500);
    }
  };

  return (
    <div ref={ref} className="relative">
      <IconButton label={unread ? `Notifications, ${unread} unread` : 'Notifications'} onClick={toggle} aria-expanded={open}>
        <Bell className="h-[18px] w-[18px]" />
        {unread > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 font-mono text-[10px] font-semibold leading-none text-accent-ink">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </IconButton>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-[min(360px,calc(100vw-2rem))] origin-top-right animate-pop-in overflow-hidden rounded-lg border border-line bg-surface/95 shadow-pop backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <span className="text-sm font-semibold">Notifications</span>
            {unread > 0 && <span className="text-xs text-ink-3">{unread} new</span>}
          </div>
          <div className="max-h-[380px] overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-ink-3">You&apos;re all caught up.</div>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => { setOpen(false); router.push(hrefFor(n)); }}
                  className="flex w-full gap-3 border-b border-line px-4 py-3 text-left transition-colors last:border-0 hover:bg-subtle/60"
                >
                  <span className={cn('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', n.is_read ? 'bg-transparent' : 'bg-accent')} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-ink">{stripEmoji(n.title)}</span>
                    <span className="mt-0.5 block text-[13px] leading-snug text-ink-2">{stripEmoji(n.content)}</span>
                    <span className="mt-1 block text-xs text-ink-3">{relativeTime(parseUtc(n.created_at))}</span>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
