'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, ArrowUp, Check, Copy, Mail, PanelRight, Phone, Star, X } from 'lucide-react';
import { api, errorMessage, wsBase } from '../../../lib/api';
import type { Match, Message, User } from '../../../lib/types';
import { categoryFor } from '../../../lib/categories';
import { dayLabel, hhmm, money, parseUtc } from '../../../lib/format';
import { useRequireAuth } from '../../../lib/useRequireAuth';
import { toast } from '../../../store/toastStore';
import { Button, ButtonLink, IconButton } from '../../../components/ui/Button';
import { Textarea } from '../../../components/ui/Field';
import { Avatar, Badge, EmptyState, Notice, Skeleton } from '../../../components/ui/misc';
import { cn } from '../../../lib/cn';

type Conn = 'connecting' | 'open' | 'closed';

const SAFETY = [
  'Verify the PNR or barcode with the operator before paying.',
  'Meet somewhere public, close to the station or venue.',
  'Never share an OTP — no genuine transfer needs one.',
  'Pay only the agreed amount, once the ticket is yours.',
];

function sameDay(a: Date, b: Date) {
  return a.toDateString() === b.toDateString();
}

function dayHeading(d: Date) {
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return dayLabel(iso);
}

function CopyRow({ icon: Icon, value }: { icon: typeof Phone; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-3 rounded-md border border-line bg-bg px-3 py-2.5">
      <Icon className="h-4 w-4 shrink-0 text-ink-3" />
      <span className="min-w-0 flex-1 truncate font-mono text-sm num">{value}</span>
      <button
        onClick={() => { navigator.clipboard?.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1600); }}
        className="flex items-center gap-1 text-xs text-ink-2 hover:text-ink"
      >
        {copied ? <><Check className="h-3.5 w-3.5" />Copied</> : <><Copy className="h-3.5 w-3.5" />Copy</>}
      </button>
    </div>
  );
}

function Step({ n, title, state, children }: { n: number; title: string; state: 'done' | 'current' | 'todo'; children?: React.ReactNode }) {
  return (
    <li className="group relative grid grid-cols-[28px_1fr] gap-3 pb-6 last:pb-0">
      <span className="absolute left-[13px] top-7 h-[calc(100%-28px)] w-px bg-line group-last:hidden" aria-hidden />
      <span
        className={cn(
          'relative z-[1] flex h-7 w-7 items-center justify-center rounded-full border font-mono text-xs transition-all duration-500 ease-spring',
          state === 'done' && 'border-ink bg-inverse text-inverse-ink',
          state === 'current' && 'border-accent bg-surface text-accent ring-4 ring-accent/15',
          state === 'todo' && 'border-line-strong bg-surface text-ink-3',
        )}
      >
        {state === 'done' ? <Check className="h-3.5 w-3.5" /> : n}
      </span>
      <div className="min-w-0 pt-1">
        <div className={cn('text-sm font-medium', state === 'todo' && 'text-ink-3')}>{title}</div>
        {children && <div className="mt-2 space-y-2.5">{children}</div>}
      </div>
    </li>
  );
}

export default function ChatPage() {
  const { matchId } = useParams<{ matchId: string }>();
  const router = useRouter();
  const { ready, user } = useRequireAuth();

  const [match, setMatch] = useState<Match | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'ok' | 'error'>('loading');
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [conn, setConn] = useState<Conn>('connecting');
  const [busy, setBusy] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [reviewed, setReviewed] = useState(false);
  const [reviewError, setReviewError] = useState('');

  const wsRef = useRef<WebSocket | null>(null);
  const initialCount = useRef<number | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const loadMatch = useCallback(async () => {
    try {
      setMatch(await api<Match>(`/matches/${matchId}`));
      setLoadState('ok');
    } catch {
      setLoadState('error');
    }
  }, [matchId]);

  useEffect(() => {
    if (!ready) return;
    loadMatch();
    api<Message[]>(`/matches/${matchId}/messages`)
      .then((m) => { initialCount.current = m.length; setMessages(m); })
      .catch(() => { initialCount.current = 0; });
  }, [ready, loadMatch, matchId]);

  // Live socket with simple backoff reconnect.
  useEffect(() => {
    if (!ready) return;
    let stopped = false;
    let attempt = 0;
    let timer: ReturnType<typeof setTimeout>;

    const base = wsBase();
    // Only ever connect over TLS (wss://). The session cookie authenticates it.
    if (!base.startsWith('wss://')) { setConn('closed'); return; }

    const connect = () => {
      setConn('connecting');
      const ws = new WebSocket(`${base}/ws/chat/${encodeURIComponent(matchId)}`);
      wsRef.current = ws;
      ws.onopen = () => { attempt = 0; setConn('open'); };
      ws.onmessage = (e) => {
        try {
          const m: Message = JSON.parse(e.data);
          if (!m || !m.id) return; // server notices (e.g. rate limit) aren't messages
          setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
        } catch {}
      };
      ws.onclose = (e) => {
        setConn('closed');
        if (stopped || e.code === 4003 || e.code === 4001) return;
        attempt += 1;
        timer = setTimeout(connect, Math.min(10000, 1000 * 2 ** (attempt - 1)));
      };
    };
    connect();
    return () => { stopped = true; clearTimeout(timer); wsRef.current?.close(); };
  }, [ready, matchId]);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, loadState]);

  // Auto-grow composer.
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 140) + 'px';
  }, [draft]);

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    if (wsRef.current?.readyState !== WebSocket.OPEN) {
      toast('Not connected', 'Your message wasn’t sent. We’re reconnecting — try again in a moment.', 'error');
      return;
    }
    wsRef.current.send(JSON.stringify({ content: text }));
    setDraft('');
  };

  const run = async (key: string, path: string, success?: string) => {
    setBusy(key);
    try {
      setMatch(await api<Match>(path, { method: 'POST' }));
      if (success) toast(success, undefined, 'success');
    } catch (e) {
      toast('That didn’t work', errorMessage(e), 'error');
    } finally {
      setBusy(null);
      setConfirming(false);
    }
  };

  const submitReview = async () => {
    if (!rating) { setReviewError('Choose a rating from 1 to 5.'); return; }
    setBusy('review');
    setReviewError('');
    try {
      await api(`/reviews/${matchId}`, { method: 'POST', body: { rating, comment: comment.trim() || null } });
      setReviewed(true);
      toast('Thanks for the rating', undefined, 'success');
    } catch (e) {
      const msg = errorMessage(e);
      if (/already/i.test(msg)) setReviewed(true);
      else setReviewError(msg);
    } finally {
      setBusy(null);
    }
  };

  if (!ready || loadState === 'loading') {
    return (
      <div className="container-page grid gap-6 pt-6 lg:grid-cols-[1fr_340px]">
        <Skeleton className="h-[calc(100dvh-7rem)] rounded-lg" />
        <Skeleton className="hidden h-96 rounded-lg lg:block" />
      </div>
    );
  }

  if (loadState === 'error' || !match) {
    return (
      <div className="container-page pt-16">
        <EmptyState
          title="This conversation isn’t available"
          body="It may belong to another account, or the link is wrong."
          action={<ButtonLink href="/dashboard?tab=requests" variant="secondary" size="sm">Back to requests</ButtonLink>}
        />
      </div>
    );
  }

  const isSeller = match.transferor_id === user?.id;
  const other: User | null | undefined = isSeller ? match.seeker : match.transferor;
  const otherName = other?.name || (isSeller ? 'Buyer' : 'Seller');
  const listing = match.listing;
  const status = match.status;
  const accepted = ['accepted', 'contact_revealed', 'transferred'].includes(status);
  const revealed = ['contact_revealed', 'transferred'].includes(status);
  const done = status === 'transferred';
  const closed = ['declined', 'cancelled', 'expired'].includes(status);
  const cat = listing ? categoryFor(listing) : null;

  const panel = (
    <div className="space-y-5">
      {listing && cat && (
        <Link href={`/tickets/${listing.id}`} className="spotlight block rounded-lg border border-line bg-surface p-4 shadow-card transition-[transform,box-shadow] duration-500 ease-out-expo hover:-translate-y-0.5 hover:shadow-lift">
          <div className="eyebrow">{cat.name}{isSeller ? ' · your listing' : ''}</div>
          <div className="mt-1.5 truncate text-[15px] font-medium">{listing.title}</div>
          <div className="mt-1 flex items-center justify-between text-[13px] text-ink-2">
            <span>{dayLabel(listing.event_date)}{listing.departure_time ? ` · ${hhmm(listing.departure_time)}` : ''}</span>
            <span className="font-mono font-medium text-ink num">{money(listing.asking_price)}</span>
          </div>
        </Link>
      )}

      <div className="rounded-lg border border-line bg-surface p-4 shadow-card">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-sm font-semibold">Handover</span>
          {done && <Badge tone="solid">Completed</Badge>}
          {closed && <Badge>{status === 'declined' ? 'Declined' : 'Closed'}</Badge>}
        </div>

        {closed ? (
          <Notice>{status === 'declined' ? (isSeller ? 'You declined this request.' : 'The seller declined this request.') : 'This conversation is closed.'}</Notice>
        ) : (
          <ol>
            <Step n={1} title={isSeller ? 'Accept the request' : 'Seller accepts'} state={accepted ? 'done' : 'current'}>
              {!accepted && (isSeller ? (
                <div className="flex gap-2">
                  <Button size="sm" loading={busy === 'accept'} onClick={() => run('accept', `/matches/${matchId}/accept`, 'Request accepted')}>Accept</Button>
                  <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => run('decline', `/matches/${matchId}/decline`, 'Request declined')}>Decline</Button>
                </div>
              ) : (
                <p className="text-[13px] text-ink-3">Waiting for {otherName.split(' ')[0]} to respond.</p>
              ))}
            </Step>

            <Step n={2} title="Swap contact details" state={revealed ? 'done' : accepted ? 'current' : 'todo'}>
              {accepted && !revealed && (
                <>
                  <p className="text-[13px] leading-relaxed text-ink-3">Shares your number and email with {otherName.split(' ')[0]}, and theirs with you.</p>
                  <Button size="sm" variant="secondary" loading={busy === 'reveal'} onClick={() => run('reveal', `/matches/${matchId}/reveal`, 'Contact details shared')}>Share contact details</Button>
                </>
              )}
              {revealed && (
                other?.phone || other?.email ? (
                  <>
                    {other?.phone && <CopyRow icon={Phone} value={other.phone} />}
                    {other?.email && <CopyRow icon={Mail} value={other.email} />}
                  </>
                ) : (
                  <p className="text-[13px] text-ink-3">{otherName} hasn’t added contact details. Arrange things in the chat.</p>
                )
              )}
            </Step>

            <Step n={3} title="Hand over & confirm" state={done ? 'done' : accepted ? 'current' : 'todo'}>
              {accepted && !done && (
                confirming ? (
                  <>
                    <p className="text-[13px] leading-relaxed text-ink-2">Only confirm once the ticket is with the buyer and payment is settled. This closes the listing.</p>
                    <div className="flex gap-2">
                      <Button size="sm" loading={busy === 'confirm'} onClick={() => run('confirm', `/matches/${matchId}/confirm`, 'Transfer complete')}>Yes, it’s done</Button>
                      <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>Not yet</Button>
                    </div>
                  </>
                ) : (
                  <Button size="sm" variant="secondary" onClick={() => setConfirming(true)}>Mark as transferred</Button>
                )
              )}
            </Step>

            {done && (
              <Step n={4} title={`Rate ${otherName.split(' ')[0]}`} state={reviewed ? 'done' : 'current'}>
                {reviewed ? (
                  <p className="text-[13px] text-ink-3">Thanks — your rating helps keep the board trustworthy.</p>
                ) : (
                  <>
                    <div className="flex gap-1" onMouseLeave={() => setHover(0)} role="radiogroup" aria-label="Rating">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          type="button"
                          role="radio"
                          aria-checked={rating === n}
                          aria-label={`${n} star${n > 1 ? 's' : ''}`}
                          onMouseEnter={() => setHover(n)}
                          onClick={() => setRating(n)}
                          className="p-0.5"
                        >
                          <Star className={cn('h-6 w-6 transition-colors', (hover || rating) >= n ? 'fill-ink text-ink' : 'text-line-strong')} />
                        </button>
                      ))}
                    </div>
                    <Textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={300} placeholder="Anything others should know? (optional)" className="min-h-[64px] text-sm" />
                    {reviewError && <p className="text-[13px] text-danger">{reviewError}</p>}
                    <Button size="sm" loading={busy === 'review'} onClick={submitReview}>Submit rating</Button>
                  </>
                )}
              </Step>
            )}
          </ol>
        )}
      </div>

      <details className="group rounded-lg border border-line bg-surface p-4">
        <summary className="flex cursor-pointer items-center justify-between text-sm font-semibold">
          Staying safe
          <span className="text-xs font-normal text-ink-3 group-open:hidden">Show</span>
          <span className="hidden text-xs font-normal text-ink-3 group-open:inline">Hide</span>
        </summary>
        <ul className="mt-3 space-y-2 text-[13px] leading-relaxed text-ink-2">
          {SAFETY.map((s) => <li key={s} className="grid grid-cols-[14px_1fr]"><span className="text-ink-3">–</span>{s}</li>)}
        </ul>
      </details>
    </div>
  );

  let lastDay: Date | null = null;

  return (
    <div className="container-page grid gap-6 py-4 sm:py-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      {/* Conversation */}
      <section className="flex h-[calc(100dvh-5.5rem)] min-h-[440px] flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-card sm:h-[calc(100dvh-6.5rem)]">
        <header className="flex items-center gap-3 border-b border-line px-3 py-2.5 sm:px-4">
          <IconButton label="Back to requests" onClick={() => router.push('/dashboard?tab=requests')}>
            <ArrowLeft className="h-[18px] w-[18px]" />
          </IconButton>
          <Avatar name={otherName} size={34} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] font-medium">{otherName}</div>
            <div className="flex items-center gap-1.5 text-xs text-ink-3">
              <span className={cn('h-1.5 w-1.5 rounded-full', conn === 'open' ? 'bg-good' : conn === 'connecting' ? 'animate-blink bg-warn' : 'bg-ink-3')} />
              {conn === 'open' ? 'Connected' : conn === 'connecting' ? 'Connecting…' : 'Reconnecting…'}
              <span className="truncate">· {isSeller ? 'Buying your ticket' : 'Selling to you'}</span>
            </div>
          </div>
          <IconButton label="Handover details" className="lg:hidden" onClick={() => setPanelOpen(true)}>
            <PanelRight className="h-[18px] w-[18px]" />
          </IconButton>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-5 sm:px-5">
          {match.seeker_note && (
            <div className="mx-auto mb-6 max-w-md rounded-md border border-line bg-bg px-4 py-3 text-center text-[13px] leading-relaxed text-ink-2">
              <span className="eyebrow mb-1 block">Request note</span>
              “{match.seeker_note}”
            </div>
          )}
          {messages.length === 0 ? (
            <div className="mx-auto mt-10 max-w-xs text-center text-sm leading-relaxed text-ink-3">
              {closed ? 'No messages.' : 'Say hello. Agree on a meeting point and double-check the ticket details before you meet.'}
            </div>
          ) : (
            <div className="space-y-1.5">
              {messages.map((m, i) => {
                const mine = m.sender_id === user?.id;
                const d = parseUtc(m.created_at);
                const prev = messages[i - 1];
                const grouped = prev && prev.sender_id === m.sender_id && d.getTime() - parseUtc(prev.created_at).getTime() < 5 * 6e4;
                const showDay = !lastDay || !sameDay(lastDay, d);
                lastDay = d;
                return (
                  <div key={m.id || i}>
                    {showDay && (
                      <div className="my-5 flex items-center gap-3">
                        <span className="h-px flex-1 bg-line" />
                        <span className="text-xs text-ink-3">{dayHeading(d)}</span>
                        <span className="h-px flex-1 bg-line" />
                      </div>
                    )}
                    <div className={cn('flex', mine ? 'justify-end' : 'justify-start', !grouped && !showDay && 'mt-3')}>
                      <div
                        className={cn(
                          'max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-[15px] leading-snug shadow-[0_1px_2px_rgb(0_0_0/0.06)] sm:max-w-[68%]',
                          mine ? 'origin-bottom-right rounded-br-md bg-inverse text-inverse-ink' : 'origin-bottom-left rounded-bl-md bg-subtle text-ink',
                          (initialCount.current === null || i >= initialCount.current) && 'animate-msg-in',
                        )}
                      >
                        {m.content}
                        <span className={cn('ml-2 inline-block translate-y-0.5 font-mono text-[10px] opacity-55')}>
                          {d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); send(); }}
          className="flex items-end gap-2 border-t border-line p-2.5 sm:p-3"
        >
          <textarea
            ref={inputRef}
            rows={1}
            value={draft}
            maxLength={500}
            disabled={closed}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder={closed ? 'This conversation is closed' : `Message ${otherName.split(' ')[0]}…`}
            className="max-h-[140px] min-h-[42px] flex-1 resize-none rounded-md border border-transparent bg-subtle px-3.5 py-2.5 text-[15px] leading-snug transition-[background-color,border-color,box-shadow] duration-200 placeholder:text-ink-3 focus:border-accent/50 focus:bg-surface focus:outline-none focus:ring-4 focus:ring-accent/10 disabled:opacity-60"
          />
          <Button type="submit" className="h-[42px] w-[42px] shrink-0 !px-0" aria-label="Send message" disabled={!draft.trim() || closed}>
            <ArrowUp className="h-[18px] w-[18px]" />
          </Button>
        </form>
      </section>

      {/* Side panel (desktop) */}
      <aside className="hidden lg:sticky lg:top-[4.5rem] lg:block lg:max-h-[calc(100dvh-6.5rem)] lg:self-start lg:overflow-y-auto">{panel}</aside>

      {/* Side panel (mobile drawer) */}
      {panelOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Handover details">
          <div className="absolute inset-0 animate-fade-in bg-black/40 backdrop-blur-sm" onClick={() => setPanelOpen(false)} />
          <div className="absolute inset-y-0 right-0 w-[min(380px,92vw)] animate-drawer-in overflow-y-auto bg-bg p-4 shadow-pop">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-[15px] font-semibold">Details</span>
              <IconButton label="Close" onClick={() => setPanelOpen(false)}><X className="h-5 w-5" /></IconButton>
            </div>
            {panel}
          </div>
        </div>
      )}
    </div>
  );
}
