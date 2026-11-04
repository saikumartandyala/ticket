'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ImageUp, LoaderCircle, X } from 'lucide-react';
import { api, assetUrl, errorMessage } from '../../lib/api';
import type { Listing } from '../../lib/types';
import { CATEGORIES, type CategoryDef } from '../../lib/categories';
import { useCategories } from '../../lib/useCategories';
import { money, stationName, todayISO, toNumber } from '../../lib/format';
import { useRequireAuth } from '../../lib/useRequireAuth';
import { toast } from '../../store/toastStore';
import Autocomplete from '../../components/Autocomplete';
import { TicketStub } from '../../components/tickets/TicketStub';
import { Button } from '../../components/ui/Button';
import { Field, Input, Textarea } from '../../components/ui/Field';
import { Notice, PageHeader, Skeleton } from '../../components/ui/misc';
import { cn } from '../../lib/cn';

type Errors = Partial<Record<string, string>>;

function Section({ n, title, desc, children }: { n: string; title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section data-reveal className="grid gap-5 border-t border-line py-8 first:border-t-0 first:pt-0 md:grid-cols-[200px_1fr] md:gap-8">
      <div>
        <div className="flex h-7 w-7 items-center justify-center rounded-full border border-line-strong bg-surface font-mono text-[11px] text-ink-2 num">{n}</div>
        <h2 className="mt-3 text-[15px] font-semibold">{title}</h2>
        {desc && <p className="mt-1 text-[13px] leading-relaxed text-ink-3">{desc}</p>}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

export default function PostPage() {
  const router = useRouter();
  const { ready } = useRequireAuth();

  const categories = useCategories();
  const [cat, setCat] = useState<CategoryDef>(CATEGORIES[0]);
  // If the default category was hidden by an admin, fall back to the first visible one.
  useEffect(() => {
    if (categories.length && !categories.some((c) => c.id === cat.id)) setCat(categories[0]);
  }, [categories, cat.id]);
  const isRoute = cat.kind === 'route';

  // Route fields
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [operator, setOperator] = useState('');
  const [code, setCode] = useState('');
  const [coach, setCoach] = useState('');
  const [pnr, setPnr] = useState('');
  const [arrival, setArrival] = useState('');
  // Venue fields
  const [eventName, setEventName] = useState('');
  const [venue, setVenue] = useState('');
  const [city, setCity] = useState('');
  const [section, setSection] = useState('');
  const [row, setRow] = useState('');
  // Shared
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [seat, setSeat] = useState('');
  const [seats, setSeats] = useState('1');
  const [face, setFace] = useState('');
  const [asking, setAsking] = useState('');
  const [notes, setNotes] = useState('');
  const [photo, setPhoto] = useState('');
  const [uploading, setUploading] = useState(false);

  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const faceN = toNumber(face);
  const askN = toNumber(asking);
  const band = faceN > 0 ? { min: Math.ceil(faceN * 0.3), max: Math.floor(faceN * 0.9) } : null;
  const priceIssue =
    band && askN > 0 ? (askN > band.max ? `Max ${money(band.max)} — 90% of face value.` : askN < band.min ? `Min ${money(band.min)} — 30% of face value.` : '') : '';

  const seatText = isRoute
    ? [coach, seat && `Seat ${seat}`].filter(Boolean).join(' · ')
    : [section, row && `Row ${row}`, seat && `Seat ${seat}`].filter(Boolean).join(' · ');

  const preview = useMemo(
    () => ({
      category: cat,
      title: eventName,
      operator: isRoute ? operator : null,
      operatorCode: isRoute ? code : null,
      from, to, venue, city,
      date: date || null,
      departure: time || null,
      arrival: arrival || null,
      seat: seatText || null,
      seats: Math.max(1, parseInt(seats) || 1),
      pnrLast4: isRoute ? pnr || null : null,
      asking: askN || null,
      face: faceN || null,
    }),
    [cat, eventName, isRoute, operator, code, from, to, venue, city, date, time, arrival, seatText, seats, pnr, askN, faceN],
  );

  const uploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setErrors((x) => ({ ...x, photo: 'That file is over 5 MB.' })); return; }
    setUploading(true);
    setErrors((x) => ({ ...x, photo: undefined }));
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api<{ url: string }>('/listings/upload-photo', { method: 'POST', form: fd, fallbackError: 'Upload failed. Try a different image.' });
      setPhoto(res.url);
    } catch (err) {
      setErrors((x) => ({ ...x, photo: errorMessage(err) }));
    } finally {
      setUploading(false);
    }
  };

  const validate = (): Errors => {
    const e: Errors = {};
    if (isRoute) {
      if (!from.trim()) e.from = 'Where does the journey start?';
      if (!to.trim()) e.to = 'Where does it end?';
      if (pnr && !/^\d{4}$/.test(pnr)) e.pnr = 'Enter exactly 4 digits.';
    } else {
      if (!eventName.trim()) e.eventName = 'What’s the event called?';
      if (!venue.trim() && !city.trim()) e.venue = 'Add the venue or at least the city.';
    }
    if (!date) e.date = 'Pick the date.';
    else if (date < todayISO()) e.date = 'That date has already passed.';
    else if (date === todayISO() && time) {
      const [h, m] = time.split(':').map(Number);
      const now = new Date();
      if (h * 60 + m <= now.getHours() * 60 + now.getMinutes()) e.time = 'That time has already passed today.';
    }
    const n = parseInt(seats);
    if (!n || n < 1 || n > 10) e.seats = 'Between 1 and 10.';
    if (!(faceN > 0)) e.face = 'Enter the price printed on the ticket.';
    if (!(askN > 0)) e.asking = 'Enter your asking price.';
    else if (priceIssue) e.asking = priceIssue;
    return e;
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setFormError('');
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) {
      setFormError('A few details need attention before you can publish.');
      requestAnimationFrame(() => {
        const el = document.querySelector<HTMLElement>('form [aria-invalid="true"]');
        el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
        el?.focus({ preventScroll: true });
      });
      return;
    }
    const seatDetails: Record<string, string> = {};
    if (isRoute && coach.trim()) seatDetails.coach = coach.trim();
    if (seat.trim()) seatDetails.seat = seat.trim();

    const payload = {
      category_id: cat.id,
      title: isRoute ? `${stationName(from)} → ${stationName(to)}` : eventName.trim(),
      description: notes.trim() || null,
      origin_city: isRoute ? from.trim() : null,
      destination_city: isRoute ? to.trim() : null,
      operator_name: isRoute ? operator.trim() || null : null,
      operator_code: isRoute ? code.trim() || null : null,
      event_name: isRoute ? null : eventName.trim(),
      venue_name: isRoute ? null : venue.trim() || null,
      venue_city: isRoute ? null : city.trim() || null,
      section: isRoute ? null : section.trim() || null,
      row_number: isRoute ? null : row.trim() || null,
      seat_count: parseInt(seats) || 1,
      seat_details: Object.keys(seatDetails).length ? seatDetails : null,
      event_date: date,
      departure_time: time ? `${time}:00` : null,
      arrival_time: isRoute && arrival ? `${arrival}:00` : null,
      original_price: faceN,
      asking_price: askN,
      pnr_last_four: isRoute && pnr ? pnr : null,
      ticket_photos: photo ? [photo] : [],
    };

    setSubmitting(true);
    try {
      const created = await api<Listing>('/listings', { method: 'POST', body: payload, fallbackError: 'Couldn’t publish your listing. Check the details and try again.' });
      toast('Your ticket is live', 'People with matching alerts have been notified.', 'success');
      router.push(`/tickets/${created.id}`);
    } catch (err) {
      setFormError(errorMessage(err));
      setSubmitting(false);
    }
  };

  if (!ready) {
    return (
      <div className="container-page pt-10">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="mt-8 h-[420px] rounded-lg" />
      </div>
    );
  }

  const quick = faceN > 0 ? [10, 25, 40].map((p) => ({ p, v: Math.round(faceN * (1 - p / 100)) })) : [];

  return (
    <div className="container-page pt-10">
      <PageHeader
        eyebrow="Sell"
        title="List a ticket"
        description="Free to list. Your listing closes automatically at the departure or start time."
      />

      <div className="mt-8 grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_400px]">
        <form onSubmit={submit} noValidate className="min-w-0">
          <Section n="01" title="Category" desc="What kind of ticket is it?">
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6 lg:grid-cols-3 xl:grid-cols-6" role="radiogroup" aria-label="Category">
              {categories.map((c) => {
                const Icon = c.icon;
                const on = c.id === cat.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => { setCat(c); setErrors({}); }}
                    className={cn(
                      'spotlight group flex flex-col items-start gap-3 rounded-md border p-3 text-left transition-all duration-300 ease-out-expo active:scale-[0.97]',
                      on
                        ? 'border-accent bg-surface shadow-[0_0_0_3px_rgb(var(--accent)/0.15),0_10px_24px_-12px_rgb(var(--accent)/0.5)]'
                        : 'border-line-strong bg-surface/60 text-ink-2 hover:-translate-y-0.5 hover:border-ink-3 hover:text-ink hover:shadow-card',
                    )}
                  >
                    <Icon className={cn('h-[18px] w-[18px] transition-all duration-500 ease-spring', on ? 'scale-110 text-accent' : 'group-hover:scale-110')} />
                    <span className="text-sm font-medium">{c.name}</span>
                  </button>
                );
              })}
            </div>
          </Section>

          <Section n="02" title={isRoute ? 'Journey' : 'Event'} desc={isRoute ? 'Start typing to pick a station or city.' : 'Where and when it’s happening.'}>
            <div className="grid gap-4 sm:grid-cols-2">
              {isRoute ? (
                <>
                  <Field label="From" error={errors.from}>
                    {(p) => <Autocomplete {...p} kind={cat.slug === 'train' ? 'station' : 'city'} value={from} onChange={setFrom} placeholder={cat.slug === 'train' ? 'New Delhi (NDLS)' : 'Bengaluru'} />}
                  </Field>
                  <Field label="To" error={errors.to}>
                    {(p) => <Autocomplete {...p} kind={cat.slug === 'train' ? 'station' : 'city'} value={to} onChange={setTo} placeholder={cat.slug === 'train' ? 'Mumbai Central (BCT)' : 'Hyderabad'} />}
                  </Field>
                  <Field label={cat.slug === 'train' ? 'Train name' : 'Operator'} optional>
                    {(p) => <Input {...p} value={operator} onChange={(e) => setOperator(e.target.value)} placeholder={cat.slug === 'train' ? 'Rajdhani Express' : 'VRL Travels'} />}
                  </Field>
                  <Field label={cat.slug === 'train' ? 'Train number' : 'Bus number'} optional>
                    {(p) => <Input {...p} value={code} onChange={(e) => setCode(e.target.value)} placeholder={cat.slug === 'train' ? '12951' : 'KA-01-AB-1234'} className="font-mono" />}
                  </Field>
                </>
              ) : (
                <>
                  <Field label="Event name" error={errors.eventName} className="sm:col-span-2">
                    {(p) => <Input {...p} value={eventName} onChange={(e) => setEventName(e.target.value)} placeholder={cat.slug === 'concert' ? 'Prateek Kuhad — Silhouettes Tour' : cat.slug === 'event' ? 'Bengaluru Tech Summit' : 'MI vs CSK'} />}
                  </Field>
                  <Field label="Venue" error={errors.venue}>
                    {(p) => <Input {...p} value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="Wankhede Stadium" />}
                  </Field>
                  <Field label="City">
                    {(p) => <Autocomplete {...p} kind="city" value={city} onChange={setCity} placeholder="Mumbai" />}
                  </Field>
                </>
              )}
              <Field label="Date" error={errors.date}>
                {(p) => <Input {...p} type="date" min={todayISO()} value={date} onChange={(e) => setDate(e.target.value)} className="font-mono" />}
              </Field>
              <Field label={isRoute ? 'Departure time' : 'Start time'} error={errors.time} hint={!errors.time ? 'Your listing closes at this time.' : undefined}>
                {(p) => <Input {...p} type="time" value={time} onChange={(e) => setTime(e.target.value)} className="font-mono" />}
              </Field>
              {isRoute && (
                <Field label="Arrival time" optional>
                  {(p) => <Input {...p} type="time" value={arrival} onChange={(e) => setArrival(e.target.value)} className="font-mono" />}
                </Field>
              )}
            </div>
          </Section>

          <Section n="03" title="Seat" desc="Helps buyers know exactly what they’re getting.">
            <div className="grid gap-4 sm:grid-cols-2">
              {isRoute ? (
                <Field label={cat.slug === 'train' ? 'Class / coach' : 'Seat type'} optional>
                  {(p) => <Input {...p} value={coach} onChange={(e) => setCoach(e.target.value)} placeholder={cat.slug === 'train' ? '3A · B4' : 'Sleeper, lower'} />}
                </Field>
              ) : (
                <Field label="Stand / section" optional>
                  {(p) => <Input {...p} value={section} onChange={(e) => setSection(e.target.value)} placeholder="North Stand, Level 2" />}
                </Field>
              )}
              {!isRoute && (
                <Field label="Row" optional>
                  {(p) => <Input {...p} value={row} onChange={(e) => setRow(e.target.value)} placeholder="K" />}
                </Field>
              )}
              <Field label="Seat number(s)" optional>
                {(p) => <Input {...p} value={seat} onChange={(e) => setSeat(e.target.value)} placeholder={isRoute ? '42' : '14, 15'} />}
              </Field>
              <Field label="Number of seats" error={errors.seats}>
                {(p) => <Input {...p} type="number" inputMode="numeric" min={1} max={10} value={seats} onChange={(e) => setSeats(e.target.value)} className="font-mono" />}
              </Field>
              {isRoute && (
                <Field label="Last 4 of PNR / booking ID" optional error={errors.pnr} hint={!errors.pnr ? 'Lets the buyer verify it. Never share the full number publicly.' : undefined}>
                  {(p) => <Input {...p} inputMode="numeric" maxLength={4} value={pnr} onChange={(e) => setPnr(e.target.value.replace(/\D/g, ''))} placeholder="4821" className="font-mono" />}
                </Field>
              )}
            </div>
          </Section>

          <Section n="04" title="Price" desc="Asking price must be 30–90% of face value. It keeps the board fair.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Face value (₹)" error={errors.face} hint={!errors.face ? 'Total printed on the ticket.' : undefined}>
                {(p) => <Input {...p} type="number" inputMode="decimal" min={1} value={face} onChange={(e) => setFace(e.target.value)} placeholder="2450" className="font-mono" />}
              </Field>
              <Field
                label="Your asking price (₹)"
                error={errors.asking || priceIssue || undefined}
                hint={band ? `Allowed range ${money(band.min)} – ${money(band.max)}` : 'Enter the face value first.'}
              >
                {(p) => <Input {...p} type="number" inputMode="decimal" min={1} value={asking} onChange={(e) => setAsking(e.target.value)} placeholder="1850" className="font-mono" />}
              </Field>
            </div>
            {quick.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px]">
                <span className="text-ink-3">Quick set</span>
                {quick.map((q) => (
                  <button
                    key={q.p}
                    type="button"
                    onClick={() => setAsking(String(q.v))}
                    className={cn(
                      'rounded-full border px-2.5 py-1 font-mono text-xs transition-colors num',
                      askN === q.v ? 'border-ink bg-inverse text-inverse-ink' : 'border-line-strong text-ink-2 hover:border-ink-3 hover:text-ink',
                    )}
                  >
                    −{q.p}% · {money(q.v)}
                  </button>
                ))}
              </div>
            )}
          </Section>

          <Section n="05" title="Extras" desc="Optional, but listings with a note get more requests.">
            <div className="space-y-4">
              <Field label="Note for buyers" optional>
                {(p) => (
                  <Textarea
                    {...p}
                    value={notes}
                    maxLength={500}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Why you’re selling, where you can meet, how the transfer works for this ticket…"
                  />
                )}
              </Field>
              <div>
                <div className="mb-1.5 flex items-baseline justify-between text-[13px] font-medium">
                  Ticket photo <span className="text-xs font-normal text-ink-3">Optional</span>
                </div>
                {photo ? (
                  <div className="flex items-center gap-3 rounded-md border border-line bg-surface p-2 pr-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={assetUrl(photo)} alt="Uploaded ticket" className="h-14 w-20 rounded object-cover" />
                    <span className="flex-1 text-sm text-ink-2">Photo attached</span>
                    <button type="button" onClick={() => setPhoto('')} className="flex items-center gap-1 text-[13px] text-ink-2 hover:text-danger">
                      <X className="h-3.5 w-3.5" /> Remove
                    </button>
                  </div>
                ) : (
                  <label className="flex cursor-pointer items-center gap-3 rounded-md border border-dashed border-line-strong bg-surface/60 px-4 py-4 transition-colors hover:border-ink-3">
                    {uploading ? <LoaderCircle className="h-5 w-5 animate-spin text-ink-3" /> : <ImageUp className="h-5 w-5 text-ink-3" />}
                    <span>
                      <span className="block text-sm font-medium">{uploading ? 'Uploading…' : 'Upload a photo'}</span>
                      <span className="block text-[13px] text-ink-3">PNG or JPG, up to 5 MB. Cover barcodes if you prefer.</span>
                    </span>
                    <input type="file" accept="image/*" className="sr-only" onChange={uploadPhoto} disabled={uploading} />
                  </label>
                )}
                {errors.photo && <p className="mt-1.5 text-[13px] text-danger">{errors.photo}</p>}
              </div>
            </div>
          </Section>

          <div className="sticky bottom-0 z-10 -mx-4 mt-2 border-t border-line bg-bg/80 px-4 py-4 backdrop-blur-xl sm:mx-0 sm:px-0 md:pl-[232px]">
            {formError && <Notice tone="error" className="mb-3">{formError}</Notice>}
            <div className="flex items-center gap-3">
              <Button type="submit" size="lg" variant="accent" loading={submitting} disabled={uploading}>Publish listing</Button>
              <span className="text-[13px] text-ink-3">You can cancel it any time.</span>
            </div>
          </div>
        </form>

        {/* Preview */}
        <aside className="hidden lg:sticky lg:top-20 lg:block">
          <div className="eyebrow mb-3 flex items-center gap-2"><span className="h-1.5 w-1.5 animate-blink rounded-full bg-accent" />Live preview</div>
          <TicketStub data={preview} placeholder stacked />
          <div className="mt-6 rounded-lg border border-line bg-surface/60 p-5 shadow-card">
            <div className="text-sm font-semibold">What happens next</div>
            <ol className="mt-3 space-y-3 text-[13px] leading-relaxed text-ink-2">
              <li className="grid grid-cols-[24px_1fr]"><span className="font-mono text-ink-3">01</span>Your ticket appears on the board instantly; people with matching alerts are notified.</li>
              <li className="grid grid-cols-[24px_1fr]"><span className="font-mono text-ink-3">02</span>Buyers send requests. You accept the one that suits you.</li>
              <li className="grid grid-cols-[24px_1fr]"><span className="font-mono text-ink-3">03</span>Chat, meet, get paid directly, then mark it transferred.</li>
            </ol>
          </div>
        </aside>
      </div>
    </div>
  );
}
