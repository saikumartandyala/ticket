'use client';

import React, { useEffect, useRef, useState } from 'react';
import { API_BASE } from '../lib/api';

type Kind = 'city' | 'station';
type Theme = 'dark' | 'light';

interface Item {
  label: string;
  name: string;
  code?: string;
  city?: string | null;
  state?: string;
}

interface Props {
  value: string;
  onChange: (v: string) => void;
  kind: Kind;
  placeholder?: string;
  theme?: Theme;
  onSelect?: (item: Item) => void;
}

/**
 * Autocomplete for the List-a-ticket From/To fields. Debounced calls to the
 * backend proxy (`/lookup/cities` or `/lookup/stations`), keyboard + mouse
 * selection, click-outside close. Free typing is still allowed if nothing
 * matches. Themed for the classic (dark) and new (light) UIs.
 */
export default function Autocomplete({ value, onChange, kind, placeholder, theme = 'light', onSelect }: Props) {
  const [items, setItems] = useState<Item[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);
  const skipNext = useRef(false); // don't re-fetch on the value change caused by a pick

  useEffect(() => {
    if (skipNext.current) { skipNext.current = false; return; }
    const q = value.trim();
    if (q.length < 2) { setItems([]); setOpen(false); return; }
    const endpoint = kind === 'station' ? 'stations' : 'cities';
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE}/lookup/${endpoint}?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        if (cancelled) return;
        const list: Item[] = data?.data || [];
        setItems(list);
        setOpen(list.length > 0);
        setActive(-1);
      } catch {
        if (!cancelled) { setItems([]); setOpen(false); }
      }
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [value, kind]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const pick = (it: Item) => {
    skipNext.current = true;
    onChange(it.label);
    onSelect?.(it);
    setOpen(false);
    setItems([]);
    setActive(-1);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open || !items.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, items.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); pick(items[active]); }
    else if (e.key === 'Escape') { setOpen(false); }
  };

  const dark = theme === 'dark';
  const lightInput: React.CSSProperties = {
    width: '100%', padding: '14px 15px', borderRadius: 14, border: '1px solid rgba(37,99,235,.28)',
    background: '#f6f8fd', color: '#0f172a', fontSize: 14.5, outline: 'none',
  };
  const menu: React.CSSProperties = {
    position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 60, maxHeight: 260, overflowY: 'auto',
    borderRadius: 12, padding: 6,
    border: dark ? '1px solid rgba(168,85,247,.3)' : '1px solid rgba(37,99,235,.2)',
    background: dark ? '#161b27' : '#ffffff',
    boxShadow: dark ? '0 20px 50px rgba(0,0,0,.5)' : '0 20px 50px rgba(15,23,42,.16)',
  };
  const rowStyle = (i: number): React.CSSProperties => ({
    padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
    background: i === active ? (dark ? 'rgba(168,85,247,.18)' : 'rgba(37,99,235,.1)') : 'transparent',
  });

  return (
    <div ref={boxRef} style={{ position: 'relative' }}>
      <input
        className={dark ? 'field' : undefined}
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => { if (items.length) setOpen(true); }}
        style={dark ? { width: '100%', padding: '14px 15px', fontSize: 14.5 } : lightInput}
      />
      {open && (
        <div style={menu}>
          {items.map((it, i) => (
            <div
              key={(it.code || '') + it.label + i}
              onMouseDown={(e) => { e.preventDefault(); pick(it); }}
              onMouseEnter={() => setActive(i)}
              style={rowStyle(i)}
            >
              <div style={{ fontSize: 14, color: dark ? '#fff' : '#0f172a' }}>
                {kind === 'station' ? it.name : it.label}
                {kind === 'station' && it.code && (
                  <span style={{ marginLeft: 8, fontFamily: 'monospace', fontSize: 12, color: dark ? '#c084fc' : '#2563eb' }}>{it.code}</span>
                )}
              </div>
              {kind === 'station' && it.city && (
                <div style={{ fontSize: 12, color: dark ? '#9d90b6' : '#6b7488', marginTop: 2 }}>{it.city}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
