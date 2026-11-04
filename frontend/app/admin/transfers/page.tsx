'use client';

import { Suspense, useCallback, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ArrowRight, MessageSquareText, OctagonAlert, XCircle } from 'lucide-react';
import {
  AdminHeader, ConfirmButton, Drawer, EmptyRow, ErrorRow, Pagination, Panel, Paged, SearchBox, Segmented, StatusBadge, Table, TableSkeleton, td, th, useAdmin, useAdminAction,
} from '../../../components/admin/ui';
import { Avatar, Skeleton } from '../../../components/ui/misc';
import { money, parseUtc, relativeTime } from '../../../lib/format';
import { cn } from '../../../lib/cn';

type Status = '' | 'pending' | 'accepted' | 'contact_revealed' | 'transferred' | 'disputed' | 'declined' | 'cancelled';
interface Person { id: string; name: string | null; email: string | null }
interface AdminMatch {
  id: string; status: string; seeker_note: string | null; created_at: string; updated_at: string;
  listing: { id: string; title: string; asking_price: number; status: string } | null;
  seeker: Person | null; transferor: Person | null;
}
interface Transcript { match: AdminMatch; messages: { id: string; sender_id: string; content: string; created_at: string }[] }

function ChatDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const { data, loading } = useAdmin<Transcript>(`/matches/${id}/messages`);
  const m = data?.match;
  return (
    <Drawer open onClose={onClose} title="Conversation">
      {loading || !m ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className={cn('h-10', i % 2 ? 'ml-auto w-2/3' : 'w-3/4')} />)}</div>
      ) : (
        <div className="space-y-5">
          <div className="rounded-lg border border-line bg-surface p-4 text-sm">
            <div className="font-medium">{m.listing?.title}</div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-ink-2">
              <span>{m.transferor?.name || m.transferor?.email} <span className="text-ink-3">(seller)</span></span>
              <ArrowRight className="h-3.5 w-3.5 text-ink-3" />
              <span>{m.seeker?.name || m.seeker?.email} <span className="text-ink-3">(buyer)</span></span>
            </div>
            <div className="mt-2"><StatusBadge status={m.status} kind="match" /></div>
          </div>
          <p className="flex items-center gap-1.5 text-xs text-ink-3"><OctagonAlert className="h-3.5 w-3.5" />Private conversation — your access is recorded in the audit log.</p>
          {m.seeker_note && (
            <div className="rounded-md border border-line bg-bg px-3 py-2 text-center text-[13px] text-ink-2">
              <span className="eyebrow mb-0.5 block">Request note</span>“{m.seeker_note}”
            </div>
          )}
          {data.messages.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-3">No messages exchanged.</p>
          ) : (
            <div className="space-y-2">
              {data.messages.map((msg) => {
                const seller = msg.sender_id === m.transferor?.id;
                return (
                  <div key={msg.id} className={cn('flex', seller ? 'justify-end' : 'justify-start')}>
                    <div className={cn('max-w-[80%] rounded-2xl px-3.5 py-2 text-sm', seller ? 'rounded-br-md bg-inverse text-inverse-ink' : 'rounded-bl-md bg-subtle')}>
                      <div className="mb-0.5 text-[11px] opacity-60">{seller ? 'Seller' : 'Buyer'} · {parseUtc(msg.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
                      {msg.content}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
}

function TransfersInner() {
  const params = useSearchParams();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<Status>((params.get('status') as Status) || '');
  const [page, setPage] = useState(1);
  const [chat, setChat] = useState<string | null>(null);
  const qs = new URLSearchParams({ q, status, page: String(page), size: '20' }).toString();
  const { data, error, loading, reload, setData } = useAdmin<Paged<AdminMatch>>(`/matches?${qs}`);
  const { run } = useAdminAction();
  const onSearch = useCallback((v: string) => { setQ(v); setPage(1); }, []);

  const setMatchStatus = async (m: AdminMatch, s: string, msg: string) => {
    const updated = await run<AdminMatch>(m.id, `/matches/${m.id}`, 'PATCH', { status: s }, msg);
    if (updated && data) setData({ ...data, items: data.items.map((x) => (x.id === m.id ? updated : x)) });
  };

  return (
    <div className="space-y-5">
      <AdminHeader title="Transfers" description="Every request between a buyer and a seller, from first message to handover." />
      <Panel>
        <div className="flex flex-col gap-3 border-b border-line p-3 lg:flex-row lg:items-center lg:justify-between">
          <Segmented
            value={status}
            onChange={(v) => { setStatus(v); setPage(1); }}
            options={[
              { value: '', label: 'All' }, { value: 'pending', label: 'Pending' }, { value: 'accepted', label: 'Accepted' },
              { value: 'contact_revealed', label: 'In contact' }, { value: 'transferred', label: 'Completed' },
              { value: 'disputed', label: 'Disputed' }, { value: 'declined', label: 'Declined' }, { value: 'cancelled', label: 'Cancelled' },
            ]}
          />
          <SearchBox value={q} onChange={onSearch} placeholder="Search by ticket title" />
        </div>

        {error ? <ErrorRow message={error} onRetry={reload} /> : loading && !data ? <TableSkeleton /> : data && data.items.length === 0 ? <EmptyRow text="No transfers match." /> : data && (
          <>
            <Table>
              <thead>
                <tr>
                  <th className={th}>Ticket</th>
                  <th className={th}>Seller → Buyer</th>
                  <th className={cn(th, 'text-right')}>Price</th>
                  <th className={th}>Status</th>
                  <th className={th}>Updated</th>
                  <th className={cn(th, 'text-right')}>Actions</th>
                </tr>
              </thead>
              <tbody className={cn('transition-opacity', loading && 'opacity-50')}>
                {data.items.map((m, i) => (
                  <tr key={m.id} style={{ animationDelay: `${i * 25}ms` }} className="animate-row-in transition-colors hover:bg-subtle/40">
                    <td className={td}>
                      <div className="max-w-[260px] truncate font-medium">{m.listing?.title || '—'}</div>
                      {m.seeker_note && <div className="max-w-[260px] truncate text-xs text-ink-3">“{m.seeker_note}”</div>}
                    </td>
                    <td className={td}>
                      <div className="flex items-center gap-2">
                        <Avatar name={m.transferor?.name || m.transferor?.email} size={24} />
                        <ArrowRight className="h-3.5 w-3.5 text-ink-3" />
                        <Avatar name={m.seeker?.name || m.seeker?.email} size={24} />
                        <span className="max-w-[160px] truncate text-xs text-ink-2">{m.transferor?.name || '—'} → {m.seeker?.name || '—'}</span>
                      </div>
                    </td>
                    <td className={cn(td, 'text-right font-mono num')}>{m.listing ? money(m.listing.asking_price) : '—'}</td>
                    <td className={td}><StatusBadge status={m.status} kind="match" /></td>
                    <td className={cn(td, 'whitespace-nowrap text-ink-2')}>{relativeTime(parseUtc(m.updated_at))}</td>
                    <td className={cn(td, 'text-right')}>
                      <div className="flex justify-end gap-1">
                        <button onClick={() => setChat(m.id)} title="View conversation" className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-[13px] text-ink-2 transition-colors hover:bg-subtle hover:text-ink">
                          <MessageSquareText className="h-4 w-4" />Chat
                        </button>
                        {!['transferred', 'cancelled', 'declined', 'disputed'].includes(m.status) && (
                          <ConfirmButton variant="ghost" danger confirmLabel="Mark disputed" onConfirm={() => setMatchStatus(m, 'disputed', 'Marked as disputed')}>
                            <OctagonAlert className="h-4 w-4" />
                          </ConfirmButton>
                        )}
                        {!['transferred', 'cancelled', 'declined'].includes(m.status) && (
                          <ConfirmButton variant="ghost" danger confirmLabel="Cancel transfer" onConfirm={() => setMatchStatus(m, 'cancelled', 'Transfer cancelled')}>
                            <XCircle className="h-4 w-4" />
                          </ConfirmButton>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pagination page={data.page} size={data.size} total={data.total} onPage={setPage} />
          </>
        )}
      </Panel>
      {chat && <ChatDrawer id={chat} onClose={() => setChat(null)} />}
    </div>
  );
}

export default function AdminTransfersPage() {
  return <Suspense fallback={null}><TransfersInner /></Suspense>;
}
