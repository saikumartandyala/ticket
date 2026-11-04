'use client';

import React, { useEffect, useRef, useState } from 'react';
import { API_BASE } from '../lib/api';
import { controlClass } from './ui/Field';
import { cn } from '../lib/cn';

type Kind = 'city' | 'station';

interface Item {
  label: string;
  name: string;
  code?: string;
  city?: string | null;
  state?: string;
}

interface Props {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  kind: Kind;
  placeholder?: string;
  onSelect?: (item: Item) => void;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
}

/**
 * City / station autocomplete. Debounced calls to the backend proxy
 * (`/lookup/cities` or `/lookup/stations`), keyboard + mouse selection,
 * click-outside close. Free typing is still allowed if nothing matches.
 */
export default function Autocomplete({ id, value, onChange, kind, placeholder, onSelect, ...aria }: Props) {
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

  const listId = id ? `${id}-list` : undefined;

  return (
    <div ref={boxRef} className="relative">
      <input
        id={id}
        className={cn(controlClass, 'h-11')}
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => { if (items.length) setOpen(true); }}
        {...aria}
      />
      {open && (
        <div id={listId} role="listbox" className="absolute inset-x-0 top-[calc(100%+4px)] z-30 max-h-64 overflow-y-auto rounded-md border border-line bg-surface p-1 shadow-[0_12px_32px_rgb(0_0_0/0.12)]">
          {items.map((it, i) => (
            <div
              key={(it.code || '') + it.label + i}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => { e.preventDefault(); pick(it); }}
              onMouseEnter={() => setActive(i)}
              className={cn('cursor-pointer rounded px-3 py-2', i === active && 'bg-subtle')}
            >
              <div className="flex items-baseline justify-between gap-3 text-sm text-ink">
                <span className="truncate">{kind === 'station' ? it.name : it.label}</span>
                {kind === 'station' && it.code && <span className="font-mono text-xs text-ink-3">{it.code}</span>}
              </div>
              {kind === 'station' && it.city && <div className="mt-0.5 text-xs text-ink-3">{it.city}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
