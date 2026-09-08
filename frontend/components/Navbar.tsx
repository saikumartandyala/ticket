'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '../store/authStore';

const NAV = [
  { label: 'Home', path: '/' },
  { label: 'Browse', path: '/tickets' },
  { label: 'Dashboard', path: '/dashboard' },
];

export const Navbar: React.FC = () => {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, user, logout } = useAuthStore();

  const pill = (active: boolean): React.CSSProperties => ({
    padding: '8px 14px',
    borderRadius: 999,
    border: `1px solid ${active ? 'rgba(192,132,252,.5)' : 'transparent'}`,
    background: active ? 'rgba(168,85,247,.16)' : 'transparent',
    color: active ? '#fff' : '#a99cc0',
    fontSize: 13.5,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'color .2s ease, background .2s ease',
  });

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
        background: 'rgba(8,5,14,.72)',
        borderBottom: '1px solid rgba(168,85,247,.16)',
      }}
    >
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 18 }}>
        {/* Logo */}
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, flex: '0 0 auto' }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              background: 'linear-gradient(145deg,#c084fc,#7c3aed)',
              boxShadow: '0 6px 20px rgba(124,58,237,.55), inset 0 1px 0 rgba(255,255,255,.5)',
              display: 'grid',
              placeItems: 'center',
              fontFamily: 'Outfit',
              fontWeight: 800,
              color: '#fff',
              fontSize: 15,
            }}
          >
            L
          </div>
          <span style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: 17, letterSpacing: '-.02em', color: '#fff' }}>
            LastMinutePass
          </span>
        </Link>

        {/* Nav pills */}
        <nav className="no-scrollbar" style={{ display: 'flex', gap: 4, marginLeft: 'auto', overflowX: 'auto' }}>
          {NAV.map((n) => (
            <Link key={n.path} href={n.path} style={pill(pathname === n.path)}>
              {n.label}
            </Link>
          ))}
        </nav>

        {/* Right actions */}
        {isAuthenticated ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: '0 0 auto' }}>
            <div
              title={user?.name || 'You'}
              style={{
                width: 36,
                height: 36,
                borderRadius: 12,
                background: 'linear-gradient(145deg,#c084fc,#7c3aed)',
                display: 'grid',
                placeItems: 'center',
                fontFamily: 'Outfit',
                fontWeight: 700,
                color: '#fff',
                fontSize: 13,
                boxShadow: '0 6px 18px rgba(124,58,237,.5)',
              }}
            >
              {user?.name ? user.name.split(' ').map((x) => x[0]).join('').slice(0, 2).toUpperCase() : 'U'}
            </div>
            <button
              onClick={() => { logout(); router.push('/'); }}
              style={{ background: 'transparent', border: 'none', color: '#a99cc0', fontSize: 13, cursor: 'pointer' }}
            >
              Log out
            </button>
          </div>
        ) : (
          pathname !== '/auth' && (
            <Link href="/auth" style={pill(false)}>Sign in</Link>
          )
        )}

        {/* Shimmer CTA */}
        <Link
          href="/post"
          className="btn-shimmer"
          style={{ flex: '0 0 auto', padding: '9px 18px', fontSize: 13, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
        >
          List a ticket
        </Link>
      </div>
    </header>
  );
};
