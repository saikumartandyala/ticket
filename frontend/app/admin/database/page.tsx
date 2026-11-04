'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, Database, Key, Link2 } from 'lucide-react';
import { AdminHeader, EmptyRow, ErrorRow, Panel, SearchBox, Table, TableSkeleton, td, th, useAdmin } from '../../../components/admin/ui';
import { Badge } from '../../../components/ui/misc';
import { cn } from '../../../lib/cn';

interface Column {
  name: string; type: string; nullable: boolean; primary_key: boolean; unique: boolean; indexed: boolean; foreign_key: string | null; comment: string | null;
}
interface Table { name: string; comment: string | null; rows: number | null; columns: Column[] }
interface Schema { dialect: string | null; tables: Table[] }

export default function AdminDatabasePage() {
  const { data, error, loading, reload } = useAdmin<Schema>('/schema');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(null);

  const tables = useMemo(() => {
    const term = q.toLowerCase();
    return (data?.tables || []).filter((t) => !term || t.name.includes(term) || (t.comment || '').toLowerCase().includes(term) || t.columns.some((c) => c.name.includes(term)));
  }, [data, q]);

  const totalRows = (data?.tables || []).reduce((s, t) => s + (t.rows || 0), 0);

  return (
    <div className="space-y-5">
      <AdminHeader
        title="Database"
        description="Every table and column, what it stores, and how many rows it holds. Timestamps are stored in UTC."
        actions={data && (
          <span className="flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-[13px] shadow-card">
            <Database className="h-4 w-4 text-ink-3" />
            <span className="capitalize">{data.dialect}</span>
            <span className="text-ink-3">· {data.tables.length} tables · {totalRows.toLocaleString('en-IN')} rows</span>
          </span>
        )}
      />
      <Panel>
        <div className="flex justify-end border-b border-line p-3">
          <SearchBox value={q} onChange={setQ} placeholder="Find a table or column" />
        </div>
        {error ? <ErrorRow message={error} onRetry={reload} /> : loading && !data ? <TableSkeleton cols={3} /> : tables.length === 0 ? <EmptyRow text="No tables match." /> : (
          <ul className="divide-y divide-line">
            {tables.map((t, i) => {
              const isOpen = open === t.name;
              return (
                <li key={t.name} style={{ animationDelay: `${i * 25}ms` }} className="animate-row-in">
                  <button onClick={() => setOpen(isOpen ? null : t.name)} className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-subtle/40" aria-expanded={isOpen}>
                    <div className="min-w-0 flex-1">
                      <div className="font-mono text-sm font-medium">{t.name}</div>
                      <div className="mt-0.5 text-[13px] text-ink-2">{t.comment || 'No description'}</div>
                    </div>
                    <span className="shrink-0 text-right">
                      <span className="block font-mono text-sm num">{t.rows?.toLocaleString('en-IN') ?? '—'}</span>
                      <span className="text-xs text-ink-3">rows · {t.columns.length} cols</span>
                    </span>
                    <ChevronDown className={cn('h-4 w-4 shrink-0 text-ink-3 transition-transform duration-300', isOpen && 'rotate-180')} />
                  </button>
                  <div className={cn('grid transition-[grid-template-rows] duration-500 ease-out-expo', isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
                    <div className="overflow-hidden">
                      <div className="border-t border-line bg-bg/50">
                        <Table minWidth={760}>
                          <thead>
                            <tr><th className={th}>Column</th><th className={th}>Type</th><th className={th}>Keys</th><th className={th}>Description</th></tr>
                          </thead>
                          <tbody>
                            {t.columns.map((c) => (
                              <tr key={c.name}>
                                <td className={cn(td, 'whitespace-nowrap font-mono text-[13px]')}>
                                  {c.name}{!c.nullable && !c.primary_key && <span className="ml-1 text-danger" title="Required">*</span>}
                                </td>
                                <td className={cn(td, 'whitespace-nowrap font-mono text-xs text-ink-2')}>{c.type}</td>
                                <td className={td}>
                                  <div className="flex flex-wrap gap-1">
                                    {c.primary_key && <Badge tone="accent"><Key className="h-3 w-3" />PK</Badge>}
                                    {c.foreign_key && <Badge><Link2 className="h-3 w-3" />{c.foreign_key}</Badge>}
                                    {c.unique && !c.primary_key && <Badge>unique</Badge>}
                                    {c.indexed && !c.primary_key && <Badge>indexed</Badge>}
                                  </div>
                                </td>
                                <td className={cn(td, 'text-[13px] text-ink-2')}>{c.comment || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </Table>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
      <p className="text-xs text-ink-3"><span className="text-danger">*</span> required column. On Postgres (Supabase) these descriptions are also stored as column comments, so they show up in the Supabase table editor.</p>
    </div>
  );
}
