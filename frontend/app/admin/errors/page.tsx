'use client';

import { useCallback, useState } from 'react';
import { Bug, CircleCheck, Copy, Globe, RotateCcw, Server } from 'lucide-react';
import {
  AdminHeader, ConfirmButton, Drawer, EmptyRow, ErrorRow, Pagination, Panel, Paged, SearchBox, Segmented, TableSkeleton, useAdmin, useAdminAction,
} from '../../../components/admin/ui';
import { Badge } from '../../../components/ui/misc';
import { Button } from '../../../components/ui/Button';
import { parseUtc, relativeTime } from '../../../lib/format';
import { cn } from '../../../lib/cn';

interface ErrorItem {
  id: string; source: 'server' | 'client'; level: string; request_id: string | null; method: string | null; path: string | null;
  status_code: number | null; error_type: string | null; message: string | null; stack: string | null;
  user_id: string | null; user_agent: string | null; is_resolved: boolean; created_at: string;
}
interface ErrorsPage extends Paged<ErrorItem> { open: { server: number; client: number }; last_24h: number }

function Detail({ e, onToggle, busy }: { e: ErrorItem; onToggle: () => void; busy: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText([`${e.error_type}: ${e.message}`, e.stack || ''].join('\n\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={e.source === 'server' ? 'danger' : 'warn'}>{e.source === 'server' ? <Server className="h-3 w-3" /> : <Globe className="h-3 w-3" />}{e.source}</Badge>
        {e.status_code && <Badge>{e.status_code}</Badge>}
        {e.is_resolved ? <Badge tone="good"><CircleCheck className="h-3 w-3" />Resolved</Badge> : <Badge tone="danger">Open</Badge>}
      </div>
      <div>
        <div className="font-mono text-sm font-medium text-danger">{e.error_type}</div>
        <p className="mt-1 whitespace-pre-wrap break-words text-[15px]">{e.message}</p>
      </div>
      <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-2 rounded-lg border border-line bg-surface p-4 text-[13px]">
        <dt className="text-ink-3">When</dt><dd>{parseUtc(e.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'medium' })}</dd>
        {e.method && <><dt className="text-ink-3">Request</dt><dd className="font-mono">{e.method} {e.path}</dd></>}
        {!e.method && e.path && <><dt className="text-ink-3">Page</dt><dd className="font-mono">{e.path}</dd></>}
        {e.request_id && <><dt className="text-ink-3">Request ID</dt><dd className="font-mono">{e.request_id}</dd></>}
        {e.user_id && <><dt className="text-ink-3">User</dt><dd className="truncate font-mono">{e.user_id}</dd></>}
        {e.user_agent && <><dt className="text-ink-3">Browser</dt><dd className="break-words text-ink-2">{e.user_agent}</dd></>}
      </dl>
      {e.request_id && <p className="text-xs text-ink-3">Search the server terminal for <span className="font-mono text-ink-2">req={e.request_id}</span> to see the surrounding log lines.</p>}
      {e.stack && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-semibold">Stack trace</span>
            <button onClick={copy} className="flex items-center gap-1 text-xs text-ink-2 hover:text-ink"><Copy className="h-3.5 w-3.5" />{copied ? 'Copied' : 'Copy'}</button>
          </div>
          <pre className="max-h-[380px] overflow-auto rounded-lg border border-line bg-inverse p-4 font-mono text-[11.5px] leading-relaxed text-inverse-ink/90">{e.stack}</pre>
        </div>
      )}
      <Button variant={e.is_resolved ? 'secondary' : 'primary'} loading={busy} onClick={onToggle}>
        {e.is_resolved ? <><RotateCcw className="h-4 w-4" />Reopen</> : <><CircleCheck className="h-4 w-4" />Mark resolved</>}
      </Button>
    </div>
  );
}

export default function AdminErrorsPage() {
  const [status, setStatus] = useState<'open' | 'resolved' | 'all'>('open');
  const [source, setSource] = useState<'' | 'server' | 'client'>('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const qs = new URLSearchParams({ status, source, q, page: String(page), size: '25' }).toString();
  const { data, error, loading, reload, setData } = useAdmin<ErrorsPage>(`/errors?${qs}`);
  const { run, busy } = useAdminAction();
  const onSearch = useCallback((v: string) => { setQ(v); setPage(1); }, []);

  const current = data?.items.find((x) => x.id === openId) || null;

  const toggle = async (e: ErrorItem) => {
    const res = await run<{ is_resolved: boolean }>(e.id, `/errors/${e.id}`, 'PATCH', { is_resolved: !e.is_resolved }, e.is_resolved ? 'Reopened' : 'Marked resolved');
    if (res && data) setData({ ...data, items: data.items.map((x) => (x.id === e.id ? { ...x, is_resolved: res.is_resolved } : x)) });
  };

  const resolveAll = async () => {
    const res = await run<{ resolved: number }>('all', `/errors/resolve-all${source ? `?source=${source}` : ''}`, 'POST', undefined, 'All open errors resolved');
    if (res) reload();
  };

  return (
    <div className="space-y-5">
      <AdminHeader
        title="Errors"
        description="Crashes in the API and JavaScript errors in visitors' browsers. Each server error links to its line in the terminal log."
        actions={data && (data.open.server + data.open.client) > 0 ? (
          <ConfirmButton confirmLabel="Resolve all open" onConfirm={resolveAll} loading={busy === 'all'}><CircleCheck className="h-4 w-4" />Resolve all</ConfirmButton>
        ) : undefined}
      />

      {data && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Open server errors', value: data.open.server, icon: Server, tone: data.open.server ? 'text-danger' : '' },
            { label: 'Open browser errors', value: data.open.client, icon: Globe, tone: data.open.client ? 'text-warn' : '' },
            { label: 'Errors in last 24h', value: data.last_24h, icon: Bug, tone: '' },
          ].map((s) => (
            <div key={s.label} className="rounded-lg border border-line bg-surface p-4 shadow-card">
              <div className="flex items-center justify-between text-[13px] text-ink-3">{s.label}<s.icon className="h-4 w-4" /></div>
              <div className={cn('mt-2 font-mono text-2xl font-medium num', s.tone)}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      <Panel>
        <div className="flex flex-col gap-3 border-b border-line p-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            <Segmented value={status} onChange={(v) => { setStatus(v); setPage(1); }} options={[{ value: 'open', label: 'Open' }, { value: 'resolved', label: 'Resolved' }, { value: 'all', label: 'All' }]} />
            <Segmented value={source} onChange={(v) => { setSource(v); setPage(1); }} options={[{ value: '', label: 'Everywhere' }, { value: 'server', label: 'Server' }, { value: 'client', label: 'Browser' }]} />
          </div>
          <SearchBox value={q} onChange={onSearch} placeholder="Search message, path or type" />
        </div>
        {error ? <ErrorRow message={error} onRetry={reload} /> : loading && !data ? <TableSkeleton cols={4} /> : data && data.items.length === 0 ? (
          <EmptyRow text={status === 'open' ? 'No open errors. Everything is running smoothly.' : 'Nothing here.'} />
        ) : data && (
          <>
            <ul className={cn('divide-y divide-line transition-opacity', loading && 'opacity-50')}>
              {data.items.map((e, i) => (
                <li key={e.id}>
                  <button
                    onClick={() => setOpenId(e.id)}
                    style={{ animationDelay: `${i * 20}ms` }}
                    className="flex w-full animate-row-in items-start gap-3 px-5 py-3.5 text-left transition-colors hover:bg-subtle/40"
                  >
                    <span className={cn('mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border', e.source === 'server' ? 'border-danger/30 bg-danger/10 text-danger' : 'border-warn/30 bg-warn/10 text-warn')}>
                      {e.source === 'server' ? <Server className="h-3.5 w-3.5" /> : <Globe className="h-3.5 w-3.5" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="shrink-0 font-mono text-[13px] font-medium">{e.error_type || 'Error'}</span>
                        <span className="truncate text-sm text-ink-2">{e.message}</span>
                      </div>
                      <div className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-ink-3">
                        <span className="font-mono">{e.method ? `${e.method} ` : ''}{e.path || '—'}</span>
                        {e.request_id && <span className="font-mono">req={e.request_id}</span>}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-xs text-ink-3">{relativeTime(parseUtc(e.created_at))}</span>
                      {e.is_resolved && <Badge tone="good">Resolved</Badge>}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
            <div className="border-t border-line"><Pagination page={data.page} size={data.size} total={data.total} onPage={setPage} /></div>
          </>
        )}
      </Panel>

      {current && (
        <Drawer open onClose={() => setOpenId(null)} title="Error details" width={640}>
          <Detail e={current} busy={busy === current.id} onToggle={() => toggle(current)} />
        </Drawer>
      )}
    </div>
  );
}
