'use client';

import React, { useEffect } from 'react';
import { useUiStore } from '../store/uiStore';
import { Navbar } from './Navbar';
import FieldCanvas from './FieldCanvas';
import { NewNavbar } from './new-ui/NewNavbar';
import NewBackground from './new-ui/NewBackground';

/**
 * Client shell that renders the chrome (background + navbar) for whichever UI
 * mode is active, and paints the <body> to match. The pages themselves render
 * only their screen content; they switch their own body between the new and
 * classic layouts via useUiStore.
 */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const { mode, setMode } = useUiStore();

  // Apply the saved preference after mount (server + first client render use the
  // 'new' default, so hydration matches; then we switch if the user chose classic).
  useEffect(() => {
    try {
      const v = localStorage.getItem('ui_mode');
      if (v === 'classic' || v === 'new') setMode(v);
    } catch {}
  }, [setMode]);

  useEffect(() => {
    document.body.style.background = mode === 'new' ? '#f4f6fb' : '#050308';
    document.body.style.color = mode === 'new' ? '#131a2b' : '';
  }, [mode]);

  if (mode === 'new') {
    return (
      <>
        <NewBackground />
        <div style={{ position: 'relative', zIndex: 10, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
          <NewNavbar />
          <main style={{ flexGrow: 1, position: 'relative' }}>{children}</main>
        </div>
      </>
    );
  }

  return (
    <>
      <FieldCanvas />
      <div style={{ position: 'relative', zIndex: 10, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Navbar />
        <main style={{ flexGrow: 1, position: 'relative' }}>{children}</main>
      </div>
    </>
  );
}
