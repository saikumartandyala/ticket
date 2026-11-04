'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '../store/authStore';

/**
 * For signed-in-only pages. Waits for the stored session to load, then sends
 * signed-out visitors to /auth with a `next` param so they come straight back.
 */
export function useRequireAuth() {
  const router = useRouter();
  const pathname = usePathname();
  const { hydrated, isAuthenticated, user } = useAuthStore();

  useEffect(() => {
    if (hydrated && !isAuthenticated) {
      router.replace(`/auth?next=${encodeURIComponent(pathname || '/')}`);
    }
  }, [hydrated, isAuthenticated, pathname, router]);

  return { ready: hydrated && isAuthenticated, user };
}
