'use client';

import React, { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '../../store/authStore';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { Toaster } from '../ui/Toaster';
import { installAnalytics, trackPageView } from '../../lib/analytics';

/** Pages that are full-height tools rather than documents get no footer. */
const NO_FOOTER = [/^\/chat\//, /^\/auth/];

/**
 * Pointer position for `.spotlight` cards. One listener for the whole app
 * instead of one per card.
 */
function useSpotlight() {
  useEffect(() => {
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const el = (e.target as Element | null)?.closest?.('.spotlight') as HTMLElement | null;
        if (!el) return;
        const r = el.getBoundingClientRect();
        el.style.setProperty('--mx', `${e.clientX - r.left}px`);
        el.style.setProperty('--my', `${e.clientY - r.top}px`);
      });
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => { window.removeEventListener('pointermove', onMove); cancelAnimationFrame(raf); };
  }, []);
}

/**
 * Scroll reveal: anything with `data-reveal` fades/rises in when it enters
 * the viewport. A MutationObserver picks up elements added after navigation
 * or data loads. Set `--d` on an element to stagger it.
 */
function useReveal() {
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
    );
    const scan = (root: ParentNode) => root.querySelectorAll('[data-reveal]:not(.is-in)').forEach((el) => io.observe(el));
    scan(document);
    const mo = new MutationObserver((muts) => {
      muts.forEach((m) => m.addedNodes.forEach((n) => {
        if (n.nodeType !== 1) return;
        const el = n as Element;
        if (el.matches('[data-reveal]:not(.is-in)')) io.observe(el);
        scan(el);
      }));
    });
    mo.observe(document.body, { childList: true, subtree: true });
    return () => { io.disconnect(); mo.disconnect(); };
  }, []);
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const hydrate = useAuthStore((s) => s.hydrate);
  const pathname = usePathname() || '/';

  useEffect(() => { hydrate(); }, [hydrate]);
  useEffect(() => installAnalytics(), []);
  // One page view per route change (admin pages are excluded inside the tracker).
  useEffect(() => { trackPageView(pathname); }, [pathname]);
  useSpotlight();
  useReveal();

  const isAdmin = pathname.startsWith('/admin');
  const showFooter = !isAdmin && !NO_FOOTER.some((r) => r.test(pathname));

  if (isAdmin) {
    // The admin console brings its own chrome.
    return (
      <>
        {children}
        <Toaster />
      </>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">{children}</main>
      {showFooter && <Footer />}
      <Toaster />
    </div>
  );
}
