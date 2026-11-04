'use client';

import { useState } from 'react';
import { ArrowRight, Star, Trash2 } from 'lucide-react';
import { AdminHeader, ConfirmButton, EmptyRow, ErrorRow, Pagination, Panel, Paged, TableSkeleton, useAdmin, useAdminAction } from '../../../components/admin/ui';
import { Avatar } from '../../../components/ui/misc';
import { parseUtc, relativeTime } from '../../../lib/format';
import { cn } from '../../../lib/cn';

interface Person { id: string; name: string | null; email: string | null }
interface AdminReview { id: string; match_id: string; rating: number; comment: string | null; created_at: string; reviewer: Person | null; reviewee: Person | null }

export default function AdminReviewsPage() {
  const [page, setPage] = useState(1);
  const { data, error, loading, reload, setData } = useAdmin<Paged<AdminReview>>(`/reviews?page=${page}&size=20`);
  const { run, busy } = useAdminAction();

  const remove = async (r: AdminReview) => {
    const ok = await run(r.id, `/reviews/${r.id}`, 'DELETE', undefined, 'Review removed and rating recalculated');
    if (ok && data) setData({ ...data, total: data.total - 1, items: data.items.filter((x) => x.id !== r.id) });
  };

  return (
    <div className="space-y-5">
      <AdminHeader title="Reviews" description="Ratings people leave after a completed transfer. Remove abusive or fake ones — the user's average updates automatically." />
      <Panel>
        {error ? <ErrorRow message={error} onRetry={reload} /> : loading && !data ? <TableSkeleton cols={4} /> : data && data.items.length === 0 ? <EmptyRow text="No reviews yet." /> : data && (
          <>
            <ul className={cn('divide-y divide-line transition-opacity', loading && 'opacity-50')}>
              {data.items.map((r, i) => (
                <li key={r.id} style={{ animationDelay: `${i * 30}ms` }} className="flex animate-row-in flex-col gap-3 px-5 py-4 transition-colors hover:bg-subtle/40 sm:flex-row sm:items-start">
                  <div className="flex shrink-0 items-center gap-0.5 sm:w-28 sm:pt-0.5">
                    {Array.from({ length: 5 }).map((_, k) => (
                      <Star key={k} className={cn('h-4 w-4', k < r.rating ? 'fill-accent text-accent' : 'text-line-strong')} />
                    ))}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={cn('text-sm leading-relaxed', r.comment ? 'text-ink' : 'italic text-ink-3')}>{r.comment || 'No comment'}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-ink-3">
                      <Avatar name={r.reviewer?.name || r.reviewer?.email} size={20} />
                      <span className="text-ink-2">{r.reviewer?.name || r.reviewer?.email}</span>
                      <ArrowRight className="h-3 w-3" />
                      <Avatar name={r.reviewee?.name || r.reviewee?.email} size={20} />
                      <span className="text-ink-2">{r.reviewee?.name || r.reviewee?.email}</span>
                      <span>· {relativeTime(parseUtc(r.created_at))}</span>
                    </div>
                  </div>
                  <ConfirmButton variant="ghost" danger confirmLabel="Delete review" loading={busy === r.id} onConfirm={() => remove(r)}>
                    <Trash2 className="h-4 w-4" />
                  </ConfirmButton>
                </li>
              ))}
            </ul>
            <div className="border-t border-line"><Pagination page={data.page} size={data.size} total={data.total} onPage={setPage} /></div>
          </>
        )}
      </Panel>
    </div>
  );
}
