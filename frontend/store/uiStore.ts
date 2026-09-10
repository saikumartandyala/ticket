'use client';

import { create } from 'zustand';

export type UiMode = 'new' | 'classic';

interface UiState {
  mode: UiMode;
  setMode: (m: UiMode) => void;
  toggle: () => void;
}

const KEY = 'ui_mode';

function persist(m: UiMode) {
  try { localStorage.setItem(KEY, m); } catch {}
}

// Default is the NEW (light) UI. The stored preference is applied after mount
// (see AppShell) so the server render and first client render always agree on
// 'new' — avoiding a hydration mismatch — before switching to the saved mode.
export const useUiStore = create<UiState>((set, get) => ({
  mode: 'new',
  setMode: (m) => { persist(m); set({ mode: m }); },
  toggle: () => { const m: UiMode = get().mode === 'new' ? 'classic' : 'new'; persist(m); set({ mode: m }); },
}));
