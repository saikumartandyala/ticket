'use client';

import { useState } from 'react';
import { ArrowDown, ArrowUp, Check, Pencil, X } from 'lucide-react';
import { AdminHeader, ErrorRow, Panel, TableSkeleton, useAdmin, useAdminAction } from '../../../components/admin/ui';
import { categoryById } from '../../../lib/categories';
import { cn } from '../../../lib/cn';

interface AdminCategory { id: number; slug: string; name: string; is_active: boolean; sort_order: number; listings: number }

function Switch({ on, onChange, label }: { on: boolean; onChange: () => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onChange}
      className={cn('relative h-6 w-11 shrink-0 rounded-full transition-colors duration-300', on ? 'bg-good' : 'bg-line-strong')}
    >
      <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-300 ease-spring', on ? 'translate-x-[22px]' : 'translate-x-0.5')} />
    </button>
  );
}

export default function AdminCategoriesPage() {
  const { data, error, loading, reload, setData } = useAdmin<AdminCategory[]>('/categories');
  const { run } = useAdminAction();
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState('');

  const patch = async (c: AdminCategory, body: Partial<AdminCategory>, msg?: string) => {
    const res = await run<AdminCategory>(String(c.id), `/categories/${c.id}`, 'PATCH', body, msg);
    if (res && data) setData(data.map((x) => (x.id === c.id ? { ...x, ...res } : x)));
    return res;
  };

  const move = async (idx: number, dir: -1 | 1) => {
    if (!data) return;
    const a = data[idx];
    const b = data[idx + dir];
    if (!b) return;
    // Swap sort orders, optimistically.
    const next = [...data];
    next[idx] = { ...b, sort_order: a.sort_order };
    next[idx + dir] = { ...a, sort_order: b.sort_order };
    setData(next);
    await Promise.all([
      run(String(a.id), `/categories/${a.id}`, 'PATCH', { sort_order: b.sort_order }),
      run(String(b.id), `/categories/${b.id}`, 'PATCH', { sort_order: a.sort_order }),
    ]);
  };

  return (
    <div className="space-y-5">
      <AdminHeader title="Categories" description="Rename, reorder or hide categories. Hidden categories stay in the database with their listings intact." />
      <Panel>
        {error ? <ErrorRow message={error} onRetry={reload} /> : loading && !data ? <TableSkeleton cols={4} /> : data && (
          <ul className="divide-y divide-line">
            {data.map((c, i) => {
              const Icon = categoryById(c.id)?.icon;
              return (
                <li key={c.id} className={cn('flex items-center gap-4 px-5 py-3.5 transition-all duration-300', !c.is_active && 'opacity-60')}>
                  <div className="flex flex-col">
                    <button aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)} className="rounded p-0.5 text-ink-3 hover:bg-subtle hover:text-ink disabled:opacity-30"><ArrowUp className="h-3.5 w-3.5" /></button>
                    <button aria-label="Move down" disabled={i === data.length - 1} onClick={() => move(i, 1)} className="rounded p-0.5 text-ink-3 hover:bg-subtle hover:text-ink disabled:opacity-30"><ArrowDown className="h-3.5 w-3.5" /></button>
                  </div>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-line bg-bg text-ink-2">
                    {Icon && <Icon className="h-5 w-5" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    {editing === c.id ? (
                      <form
                        className="flex items-center gap-2"
                        onSubmit={async (e) => { e.preventDefault(); if (draft.trim() && (await patch(c, { name: draft.trim() }, 'Category renamed'))) setEditing(null); }}
                      >
                        <input
                          autoFocus
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Escape') setEditing(null); }}
                          className="h-8 w-48 rounded-md border border-accent/60 bg-surface px-2.5 text-sm focus:outline-none focus:ring-4 focus:ring-accent/15"
                        />
                        <button type="submit" aria-label="Save" className="rounded p-1.5 text-good hover:bg-good/10"><Check className="h-4 w-4" /></button>
                        <button type="button" aria-label="Cancel" onClick={() => setEditing(null)} className="rounded p-1.5 text-ink-3 hover:bg-subtle"><X className="h-4 w-4" /></button>
                      </form>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{c.name}</span>
                        <button aria-label={`Rename ${c.name}`} onClick={() => { setEditing(c.id); setDraft(c.name); }} className="rounded p-1 text-ink-3 opacity-60 hover:bg-subtle hover:text-ink hover:opacity-100">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                    <div className="mt-0.5 font-mono text-xs text-ink-3">/{c.slug} · {c.listings} listing{c.listings === 1 ? '' : 's'}</div>
                  </div>
                  <span className={cn('hidden text-xs sm:inline', c.is_active ? 'text-good' : 'text-ink-3')}>{c.is_active ? 'Visible' : 'Hidden'}</span>
                  <Switch on={c.is_active} label={`${c.is_active ? 'Hide' : 'Show'} ${c.name}`} onChange={() => patch(c, { is_active: !c.is_active }, c.is_active ? `${c.name} hidden` : `${c.name} visible`)} />
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}
