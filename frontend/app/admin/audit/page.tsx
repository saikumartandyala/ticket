'use client';

import { useState } from 'react';
import { ArrowLeftRight, Eye, Megaphone, ScrollText, Star, Tags, Ticket, User } from 'lucide-react';
import { AdminHeader, EmptyRow, ErrorRow, Pagination, Panel, Paged, TableSkeleton, useAdmin } from '../../../components/admin/ui';
import { parseUtc, relativeTime } from '../../../lib/format';
import { cn } from '../../../lib/cn';

interface AuditItem {
  id: string; action: string; target_type: string; target_id: string | null; summary: string | null; created_at: string;
  admin: { id: string | null; name: string | null; email: string | null };
}

const ICON: Record<string, typeof User> = {
  user: User, listing: Ticket, match: ArrowLeftRight, review: Star, category: Tags, broadcast: Megaphone,
};

export default function AdminAuditPage() {
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useAdmin<Paged<AuditItem>>(`/audit?page=${page}&size=30`);

  return (
    <div className="space-y-5">
      <AdminHeader title="Audit log" description="Every change made from this console, and every time a private chat was opened. Newest first." />
      <Panel>
        {error ? <ErrorRow message={error} onRetry={reload} /> : loading && !data ? <TableSkeleton cols={3} /> : data && data.items.length === 0 ? (
          <EmptyRow text="No admin actions yet. Changes you make in this console will appear here." />
        ) : data && (
          <>
            <ol className={cn('relative px-5 py-4 transition-opacity', loading && 'opacity-50')}>
              <span aria-hidden className="absolute bottom-6 left-[37px] top-6 w-px bg-line" />
              {data.items.map((a, i) => {
                const Icon = a.action === 'match.view_chat' ? Eye : ICON[a.target_type] || ScrollText;
                const sensitive = a.action === 'match.view_chat' || a.action.includes('ban') || (a.summary || '').includes('banned');
                return (
                  <li key={a.id} style={{ animationDelay: `${i * 25}ms` }} className="relative flex animate-row-in gap-4 py-2.5">
                    <span className={cn('relative z-[1] flex h-9 w-9 shrink-0 items-center justify-center rounded-full border bg-surface', sensitive ? 'border-accent/40 text-accent' : 'border-line-strong text-ink-3')}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1 pt-1">
                      <p className="text-sm text-ink">{a.summary || a.action}</p>
                      <p className="mt-0.5 text-xs text-ink-3">
                        <span className="text-ink-2">{a.admin.name || a.admin.email || 'Deleted admin'}</span>
                        {' · '}<span className="font-mono">{a.action}</span>
                        {' · '}<span title={parseUtc(a.created_at).toLocaleString('en-IN')}>{relativeTime(parseUtc(a.created_at))}</span>
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
            <div className="border-t border-line"><Pagination page={data.page} size={data.size} total={data.total} onPage={setPage} /></div>
          </>
        )}
      </Panel>
    </div>
  );
}
