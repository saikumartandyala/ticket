'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '../../store/authStore';
import { useUiStore } from '../../store/uiStore';

const NAV = [
  { label: 'Home', path: '/' },
  { label: 'Browse', path: '/tickets' },
  { label: 'Dashboard', path: '/dashboard' },
];

const bri = "'Bricolage Grotesque', system-ui, sans-serif";

export const NewNavbar: React.FC = () => {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, user, logout } = useAuthStore();
  const toggle = useUiStore((s) => s.toggle);

  const navBtn = (active: boolean): React.CSSProperties => ({
    padding: '8px 14px',
    borderRadius: 999,
    border: `1px solid ${active ? 'rgba(37,99,235,.35)' : 'transparent'}`,
    background: active ? 'rgba(37,99,235,.12)' : 'transparent',
    color: active ? '#1e40af' : '#5b6478',
    fontSize: 13.5,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    textDecoration: 'none',
  });

  const cta: React.CSSProperties = {
    flex: '0 0 auto', padding: '9px 18px', borderRadius: 999, border: '1px solid rgba(255,255,255,.55)',
    color: '#ffffff', fontWeight: 600, fontSize: 13, cursor: 'pointer', textDecoration: 'none',
    background: 'linear-gradient(100deg,#1e40af,#2563eb,#60a5fa,#1e40af)', backgroundSize: '200% 100%',
    animation: 'lmpShimmer 6s linear infinite', boxShadow: '0 8px 26px rgba(30,64,175,.45)',
    display: 'inline-flex', alignItems: 'center',
  };

  return (
    <header style={{ position: 'sticky', top: 0, zIndex: 50, backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)', background: 'rgba(255,255,255,.82)', borderBottom: '1px solid rgba(15,23,42,.08)' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
        {/* Logo */}
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, flex: '0 0 auto', textDecoration: 'none' }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: 'linear-gradient(145deg,#2563eb,#1e3a8a)', boxShadow: '0 6px 20px rgba(30,64,175,.55), inset 0 1px 0 rgba(255,255,255,.5)', display: 'grid', placeItems: 'center', fontFamily: bri, fontWeight: 800, color: '#ffffff', fontSize: 15 }}>L</div>
          <span style={{ fontFamily: bri, fontWeight: 700, fontSize: 17, letterSpacing: '-.02em', color: '#0f172a' }}>LastMinutePass</span>
        </Link>

        {/* Nav */}
        <nav className="no-scrollbar" style={{ display: 'flex', gap: 4, marginLeft: 'auto', overflowX: 'auto' }}>
          {NAV.map((n) => (
            <Link key={n.path} href={n.path} style={navBtn(pathname === n.path)}>{n.label}</Link>
          ))}
        </nav>

        {/* Switch to classic UI */}
        <button onClick={toggle} title="Switch to the classic look" style={{ flex: '0 0 auto', padding: '7px 12px', borderRadius: 999, border: '1px solid rgba(37,99,235,.28)', background: 'transparent', color: '#5b6478', fontSize: 12.5, cursor: 'pointer', whiteSpace: 'nowrap' }}>Classic UI</button>

        {isAuthenticated ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: '0 0 auto' }}>
            <Link href="/post" style={cta}>List a ticket</Link>
            <div style={{ width: 1, height: 26, background: 'rgba(15,23,42,.14)' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div title={user?.name || 'You'} style={{ width: 34, height: 34, borderRadius: 11, background: 'linear-gradient(145deg,#2563eb,#1e3a8a)', display: 'grid', placeItems: 'center', fontFamily: bri, fontWeight: 700, color: '#fff', fontSize: 13, boxShadow: '0 6px 18px rgba(30,64,175,.4)' }}>
                {user?.name ? user.name.split(' ').map((x) => x[0]).join('').slice(0, 2).toUpperCase() : 'U'}
              </div>
              <button onClick={() => { logout(); router.push('/'); }} style={{ background: 'transparent', border: 'none', color: '#5b6478', fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}>Log out</button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: '0 0 auto' }}>
            {pathname !== '/auth' && <Link href="/auth" style={navBtn(false)}>Sign in</Link>}
            <Link href="/post" style={cta}>List a ticket</Link>
          </div>
        )}
      </div>
    </header>
  );
};

export default NewNavbar;
