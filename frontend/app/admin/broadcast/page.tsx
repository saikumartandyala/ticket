'use client';

import { useState } from 'react';
import { Bell, Megaphone, Send } from 'lucide-react';
import { AdminHeader, Panel, Paged, Segmented, useAdmin, useAdminAction } from '../../../components/admin/ui';
import { Button } from '../../../components/ui/Button';
import { Field, Input, Textarea } from '../../../components/ui/Field';
import { parseUtc, relativeTime } from '../../../lib/format';

type Audience = 'all' | 'sellers' | 'buyers';
interface AuditItem { id: string; action: string; summary: string | null; created_at: string; admin: { name: string | null; email: string | null } }

const AUDIENCES: { value: Audience; label: string; hint: string }[] = [
  { value: 'all', label: 'Everyone', hint: 'All active, non-banned accounts.' },
  { value: 'sellers', label: 'Sellers', hint: 'People who have listed at least one ticket.' },
  { value: 'buyers', label: 'Buyers', hint: 'People who have requested at least one ticket.' },
];

export default function AdminBroadcastPage() {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [audience, setAudience] = useState<Audience>('all');
  const [armed, setArmed] = useState(false);
  const { run, busy } = useAdminAction();
  const history = useAdmin<Paged<AuditItem>>('/audit?size=100');
  const sent = (history.data?.items || []).filter((a) => a.action === 'broadcast.send').slice(0, 8);

  const valid = title.trim().length >= 3 && content.trim().length >= 3;

  const send = async () => {
    const res = await run<{ sent: number }>('send', '/broadcast', 'POST', { title: title.trim(), content: content.trim(), audience });
    setArmed(false);
    if (res) {
      const { toast } = await import('../../../store/toastStore');
      toast('Announcement sent', `Delivered to ${res.sent} user${res.sent === 1 ? '' : 's'}' notifications.`, 'success');
      setTitle(''); setContent('');
      history.reload();
    }
  };

  return (
    <div className="space-y-5">
      <AdminHeader title="Broadcast" description="Send an announcement to users' notification bell — maintenance windows, new features, safety reminders." />
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Panel bodyClass="space-y-5 p-5">
          <div>
            <div className="mb-1.5 text-[13px] font-medium">Audience</div>
            <Segmented value={audience} onChange={(v) => { setAudience(v); setArmed(false); }} options={AUDIENCES.map(({ value, label }) => ({ value, label }))} />
            <p className="mt-1.5 text-[13px] text-ink-3">{AUDIENCES.find((a) => a.value === audience)?.hint}</p>
          </div>
          <Field label="Title" hint={`${title.length}/120`}>
            {(p) => <Input {...p} value={title} maxLength={120} onChange={(e) => { setTitle(e.target.value); setArmed(false); }} placeholder="Scheduled maintenance tonight" />}
          </Field>
          <Field label="Message" hint={`${content.length}/500`}>
            {(p) => <Textarea {...p} value={content} maxLength={500} rows={5} onChange={(e) => { setContent(e.target.value); setArmed(false); }} placeholder="Chat may be unavailable between 1:00 and 1:30 AM IST while we upgrade our servers." />}
          </Field>
          <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
            {armed ? (
              <>
                <Button variant="accent" loading={busy === 'send'} onClick={send} className="animate-pop-in"><Send className="h-4 w-4" />Yes, send to {AUDIENCES.find((a) => a.value === audience)?.label.toLowerCase()}</Button>
                <Button variant="ghost" onClick={() => setArmed(false)}>Cancel</Button>
              </>
            ) : (
              <Button disabled={!valid} onClick={() => setArmed(true)}><Megaphone className="h-4 w-4" />Send announcement</Button>
            )}
            <span className="text-[13px] text-ink-3">This can&apos;t be unsent.</span>
          </div>
        </Panel>

        <div className="space-y-4">
          <div>
            <div className="eyebrow mb-2">Preview</div>
            <div className="overflow-hidden rounded-lg border border-line bg-surface shadow-pop">
              <div className="flex items-center gap-2 border-b border-line px-4 py-3 text-sm font-semibold"><Bell className="h-4 w-4 text-ink-3" />Notifications</div>
              <div className="flex gap-3 px-4 py-3">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                <div className="min-w-0">
                  <div className="text-sm font-medium">{title || 'Your title'}</div>
                  <div className="mt-0.5 whitespace-pre-line text-[13px] leading-snug text-ink-2">{content || 'Your message will appear here.'}</div>
                  <div className="mt-1 text-xs text-ink-3">just now</div>
                </div>
              </div>
            </div>
          </div>
          <Panel title="Recently sent" bodyClass="divide-y divide-line">
            {sent.length === 0 ? (
              <p className="px-5 py-6 text-center text-[13px] text-ink-3">No announcements yet.</p>
            ) : sent.map((s) => (
              <div key={s.id} className="px-5 py-3 text-[13px]">
                <div className="text-ink">{s.summary}</div>
                <div className="mt-0.5 text-xs text-ink-3">{s.admin.name || s.admin.email} · {relativeTime(parseUtc(s.created_at))}</div>
              </div>
            ))}
          </Panel>
        </div>
      </div>
    </div>
  );
}
