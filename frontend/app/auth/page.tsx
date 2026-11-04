'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { api, errorMessage } from '../../lib/api';
import type { User } from '../../lib/types';
import { useAuthStore } from '../../store/authStore';
import { toast } from '../../store/toastStore';
import { Button } from '../../components/ui/Button';
import { Field, Input } from '../../components/ui/Field';
import { Notice } from '../../components/ui/misc';
import { LogoLockup } from '../../components/site/Logo';
import { cn } from '../../lib/cn';
import { OtpInput, type OtpStatus } from '../../components/auth/OtpInput';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Email-only (OTP + password are configured for email).
const channel = 'email' as const;

type Step =
  | 'choose'            // pick Sign in vs Create account
  | 'signin'            // existing user: email + password
  | 'reset-otp'         // forgot password: otp + new password
  | 'register-email'    // new user: enter email -> send OTP
  | 'register-otp'      // verify OTP
  | 'register-password' // set a password
  | 'register-name';    // set display name

const REGISTER_STEPS: Step[] = ['register-email', 'register-otp', 'register-password', 'register-name'];

const validEmail = (v: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.trim());

function PasswordInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input {...props} type={show ? 'text' : 'password'} className="pr-11" />
      <button
        type="button"
        onClick={() => setShow(!show)}
        aria-label={show ? 'Hide password' : 'Show password'}
        className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-2 text-ink-3 hover:text-ink"
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

function ResendButton({ cooldown, disabled, onClick }: { cooldown: number; disabled?: boolean; onClick: () => void }) {
  if (cooldown > 0) {
    return (
      <span className="flex items-center gap-2 text-ink-3">
        <svg viewBox="0 0 20 20" className="h-4 w-4 -rotate-90" aria-hidden>
          <circle cx="10" cy="10" r="8" fill="none" className="stroke-line" strokeWidth="2" />
          <circle
            cx="10" cy="10" r="8" fill="none" className="stroke-accent transition-[stroke-dashoffset] duration-1000 ease-linear" strokeWidth="2"
            strokeDasharray="50.3" strokeDashoffset={50.3 * (1 - cooldown / 30)} strokeLinecap="round"
          />
        </svg>
        Resend in <span className="font-mono num">0:{String(cooldown).padStart(2, '0')}</span>
      </span>
    );
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="animate-fade-in font-medium text-ink underline-offset-4 hover:underline disabled:opacity-50">
      Resend code
    </button>
  );
}

function AuthInner() {
  const router = useRouter();
  const params = useSearchParams();
  const explicitNext = params.get('next');
  const rawNext = explicitNext || '/dashboard';
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/dashboard';
  const { hydrated, isAuthenticated, setAuth } = useAuthStore();

  const [step, setStep] = useState<Step>('choose');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [otp, setOtp] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const finishing = useRef(false);
  const [otpStatus, setOtpStatus] = useState<OtpStatus>('idle');
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  /** Shake the boxes, then clear them so the user can retype. */
  const otpFailed = async (msg: string) => {
    setOtpStatus('error');
    setError(msg);
    await sleep(700);
    setOtp('');
    setOtpStatus('idle');
  };

  useEffect(() => {
    if (hydrated && isAuthenticated && !finishing.current) router.replace(next);
  }, [hydrated, isAuthenticated, next, router]);

  const goto = (s: Step) => { setError(''); setInfo(''); setOtpStatus('idle'); setStep(s); };
  const identifier = email.trim();

  const wrap = async (fn: () => Promise<void>) => {
    setError('');
    setLoading(true);
    try { await fn(); } catch (e) { setError(errorMessage(e)); } finally { setLoading(false); }
  };

  /** The session cookie is already set by the API; load the profile and move on. */
  const finish = async (welcome?: string) => {
    const me = await api<User>('/auth/me', { fallbackError: 'Signed in, but we couldn’t load your profile. Please try again.' });
    finishing.current = true;
    setAuth(me);
    if (welcome) toast(welcome, undefined, 'success');
    router.replace(next.startsWith('/admin') ? '/dashboard' : next);
  };

  const signIn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validEmail(email)) { setError('Enter a valid email address.'); return; }
    if (!password) { setError('Enter your password.'); return; }
    wrap(async () => {
      await api('/auth/login-password', { method: 'POST', body: { identifier, channel, password }, fallbackError: 'Incorrect email or password.' });
      await finish();
    });
  };

  const forgot = () => {
    if (!validEmail(email)) { setError('Enter your account email first, then choose “Forgot password”.'); return; }
    wrap(async () => {
      await api('/auth/forgot-password', { method: 'POST', body: { identifier, channel }, fallbackError: 'Couldn’t send a reset code.' });
      setOtp(''); setPassword(''); setConfirm('');
      setCooldown(30);
      goto('reset-otp');
    });
  };

  const reset = (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) { setError('Enter the 6-digit code.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirm) { setError('Passwords don’t match.'); return; }
    setError('');
    setLoading(true);
    (async () => {
      try {
        await api('/auth/reset-password', { method: 'POST', body: { identifier, channel, otp, new_password: password, confirm_password: confirm }, fallbackError: 'Couldn’t reset your password.' });
        setOtpStatus('success');
        await sleep(1300);
        setOtp(''); setPassword(''); setConfirm('');
        goto('signin');
        setInfo('Password updated. Sign in with your new password.');
      } catch (err) {
        const msg = errorMessage(err);
        if (/otp|code|expired/i.test(msg)) await otpFailed(msg);
        else setError(msg);
      } finally {
        setLoading(false);
      }
    })();
  };

  const registerEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validEmail(email)) { setError('Enter a valid email address.'); return; }
    wrap(async () => {
      const check = await api<{ exists: boolean; has_password: boolean }>('/auth/check-account', { method: 'POST', body: { identifier, channel } });
      if (check.exists && check.has_password) { setError('An account with this email already exists. Sign in instead.'); return; }
      await api('/auth/send-otp', { method: 'POST', body: { identifier, channel }, fallbackError: 'Couldn’t send the code. Please try again.' });
      setOtp('');
      setCooldown(30);
      goto('register-otp');
    });
  };

  const resend = (purpose: 'register' | 'reset') => {
    if (cooldown > 0) return;
    wrap(async () => {
      await api(purpose === 'reset' ? '/auth/forgot-password' : '/auth/send-otp', { method: 'POST', body: { identifier, channel }, fallbackError: 'Couldn’t resend the code.' });
      setOtp('');
      setCooldown(30);
      setInfo(`A new code is on its way to ${identifier}.`);
    });
  };

  const verifyCode = async (code: string) => {
    if (code.length !== 6 || otpStatus === 'verifying' || otpStatus === 'success') return;
    setError('');
    setInfo('');
    setOtpStatus('verifying');
    const started = Date.now();
    try {
      const d = await api<{ has_password: boolean }>('/auth/verify-otp', { method: 'POST', body: { identifier, channel, otp: code }, fallbackError: 'That code is invalid or has expired.' });
      // Let the verifying wave play at least once so it doesn't flash.
      await sleep(Math.max(0, 650 - (Date.now() - started)));
      setOtpStatus('success');
      await sleep(1500);
      if (d.has_password) await finish();
      else goto('register-password');
    } catch (err) {
      await sleep(Math.max(0, 450 - (Date.now() - started)));
      await otpFailed(errorMessage(err));
    }
  };

  const registerOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) { otpFailed('Enter all 6 digits of the code.'); return; }
    verifyCode(otp);
  };

  const registerPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirm) { setError('Passwords don’t match.'); return; }
    wrap(async () => {
      await api('/auth/set-password', { method: 'POST', body: { password, confirm_password: confirm }, fallbackError: 'Couldn’t set your password.' });
      goto('register-name');
    });
  };

  const registerName = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Enter your name.'); return; }
    wrap(async () => {
      await api('/auth/me', { method: 'PUT', body: { name: name.trim() }, fallbackError: 'Couldn’t save your name.' });
      await finish('Welcome to TickOrbit');
    });
  };

  const regIndex = REGISTER_STEPS.indexOf(step);
  const copy: Record<Step, { t: string; b: React.ReactNode }> = {
    choose: { t: 'Welcome', b: 'Sign in, or create an account with your email. It takes under a minute.' },
    signin: { t: 'Sign in', b: 'Use the email and password you registered with.' },
    'reset-otp': { t: 'Reset your password', b: <>Enter the code we sent to <span className="font-medium text-ink">{identifier}</span> and choose a new password.</> },
    'register-email': { t: 'Create your account', b: 'We’ll email you a 6-digit code to confirm it’s you.' },
    'register-otp': { t: 'Check your inbox', b: <>Enter the code sent to <span className="font-medium text-ink">{identifier}</span>. It expires in 10 minutes.</> },
    'register-password': { t: 'Choose a password', b: 'At least 8 characters. You’ll use it to sign in next time.' },
    'register-name': { t: 'What should we call you?', b: 'Shown to people you trade with on listings and in chat.' },
  };

  return (
    <div className="grid min-h-[calc(100dvh-3.5rem)] lg:grid-cols-[1fr_minmax(0,560px)]">
      <div className="flex items-start justify-center px-4 py-12 sm:items-center sm:py-16">
        <div className="w-full max-w-[380px] animate-fade-up">
          {regIndex >= 0 && (
            <div className="mb-8">
              <div className="flex gap-1.5">
                {REGISTER_STEPS.map((s, i) => (
                  <span key={s} className="relative h-1 flex-1 overflow-hidden rounded-full bg-line">
                    <span className={cn('absolute inset-y-0 left-0 rounded-full bg-accent transition-[width] duration-700 ease-out-expo', i <= regIndex ? 'w-full' : 'w-0')} />
                  </span>
                ))}
              </div>
              <div className="mt-2.5 font-mono text-xs text-ink-3 num">Step {regIndex + 1} of 4</div>
            </div>
          )}

          <div key={step} className="animate-page-in">
          <h1 className="text-[30px] font-semibold tracking-[-0.03em]">{copy[step].t}</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{copy[step].b}</p>

          <div className="mt-8 space-y-4">
            {error && <Notice tone="error">{error}</Notice>}
            {info && !error && <Notice tone="success">{info}</Notice>}

            {step === 'choose' && (
              <div className="space-y-3">
                <Button size="lg" className="w-full" onClick={() => { setPassword(''); goto('signin'); }}>Sign in</Button>
                <Button size="lg" variant="secondary" className="w-full" onClick={() => { setPassword(''); setConfirm(''); setName(''); setOtp(''); goto('register-email'); }}>
                  Create an account
                </Button>
              </div>
            )}

            {step === 'signin' && (
              <form onSubmit={signIn} noValidate className="space-y-4">
                <Field label="Email">{(p) => <Input {...p} type="email" autoComplete="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />}</Field>
                <div>
                  <div className="mb-1.5 flex items-baseline justify-between">
                    <label htmlFor="pw" className="text-[13px] font-medium">Password</label>
                    <button type="button" onClick={forgot} className="text-[13px] text-ink-2 underline-offset-4 hover:text-ink hover:underline">Forgot password?</button>
                  </div>
                  <PasswordInput id="pw" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <Button type="submit" size="lg" className="w-full" loading={loading}>Sign in</Button>
                <p className="text-center text-sm text-ink-2">
                  New here?{' '}
                  <button type="button" onClick={() => { setPassword(''); goto('register-email'); }} className="font-medium text-ink underline-offset-4 hover:underline">Create an account</button>
                </p>
              </form>
            )}

            {step === 'register-email' && (
              <form onSubmit={registerEmail} noValidate className="space-y-4">
                <Field label="Email">{(p) => <Input {...p} type="email" autoComplete="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />}</Field>
                <Button type="submit" size="lg" className="w-full" loading={loading}>Send code</Button>
                <p className="text-center text-sm text-ink-2">
                  Already have an account?{' '}
                  <button type="button" onClick={() => { setPassword(''); goto('signin'); }} className="font-medium text-ink underline-offset-4 hover:underline">Sign in</button>
                </p>
              </form>
            )}

            {step === 'register-otp' && (
              <form onSubmit={registerOtp} noValidate className="space-y-4">
                <OtpInput value={otp} onChange={(v) => { setOtp(v); if (error) setError(''); }} onComplete={verifyCode} status={otpStatus} autoFocus />
                <Button
                  type="submit"
                  size="lg"
                  className="w-full"
                  loading={otpStatus === 'verifying'}
                  disabled={otp.length !== 6 || otpStatus === 'success'}
                >
                  {otpStatus === 'verifying' ? 'Verifying…' : otpStatus === 'success' ? 'Verified' : 'Verify'}
                </Button>
                <div className="flex items-center justify-between text-[13px]">
                  <button type="button" onClick={() => goto('register-email')} className="text-ink-2 hover:text-ink">Change email</button>
                  <ResendButton cooldown={cooldown} disabled={loading || otpStatus !== 'idle'} onClick={() => resend('register')} />
                </div>
              </form>
            )}

            {step === 'register-password' && (
              <form onSubmit={registerPassword} noValidate className="space-y-4">
                <Field label="Password" hint="At least 8 characters.">{(p) => <PasswordInput {...p} autoComplete="new-password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} />}</Field>
                <Field label="Confirm password">{(p) => <PasswordInput {...p} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />}</Field>
                <Button type="submit" size="lg" className="w-full" loading={loading}>Continue</Button>
              </form>
            )}

            {step === 'register-name' && (
              <form onSubmit={registerName} noValidate className="space-y-4">
                <Field label="Full name">{(p) => <Input {...p} autoComplete="name" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Aarav Sharma" />}</Field>
                <Button type="submit" size="lg" className="w-full" loading={loading}>Finish</Button>
              </form>
            )}

            {step === 'reset-otp' && (
              <form onSubmit={reset} noValidate className="space-y-4">
                <OtpInput value={otp} onChange={(v) => { setOtp(v); if (error) setError(''); }} status={otpStatus} autoFocus label="Reset code" />
                <div className="flex justify-end text-[13px]">
                  <ResendButton cooldown={cooldown} disabled={loading || otpStatus !== 'idle'} onClick={() => resend('reset')} />
                </div>
                <Field label="New password" hint="At least 8 characters.">{(p) => <PasswordInput {...p} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />}</Field>
                <Field label="Confirm new password">{(p) => <PasswordInput {...p} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />}</Field>
                <Button type="submit" size="lg" className="w-full" loading={loading}>Reset password</Button>
              </form>
            )}

            {step !== 'choose' && (
              <button type="button" onClick={() => goto(step === 'reset-otp' ? 'signin' : 'choose')} className="flex items-center gap-1.5 pt-2 text-[13px] text-ink-3 hover:text-ink">
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </button>
            )}
          </div>
          </div>
        </div>
      </div>

      {/* Side panel */}
      <aside className="relative isolate hidden overflow-hidden border-l border-line bg-inverse text-inverse-ink lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div aria-hidden className="absolute -right-32 -top-32 -z-10 h-96 w-96 animate-[aurora_18s_ease-in-out_infinite_alternate] rounded-full bg-accent/40 blur-[100px]" />
        <div aria-hidden className="absolute -bottom-40 -left-20 -z-10 h-96 w-96 animate-[aurora_24s_ease-in-out_infinite_alternate-reverse] rounded-full bg-warn/20 blur-[110px]" />
        <LogoLockup onInverse />
        <div>
          <p className="max-w-[420px] animate-page-in text-[34px] font-semibold leading-[1.1] tracking-[-0.035em] [animation-delay:150ms]">
            Every ticket deserves a destination.
          </p>
          <ul className="mt-10 space-y-5 text-[15px]">
            {[
              ['Free, always', 'No listing fees, no commission. We never touch the payment.'],
              ['Fair prices', 'Every listing sits between 30% and 90% of face value.'],
              ['Private by default', 'Contact details are shared only when both of you agree.'],
            ].map(([t, b]) => (
              <li key={t} className="grid grid-cols-[20px_1fr] gap-3">
                <span className="mt-2 h-px w-3 bg-current opacity-50" />
                <span>
                  <span className="font-medium">{t}</span>
                  <span className="block opacity-60">{b}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="font-mono text-xs opacity-40">TICKORBIT · P2P TICKET BOARD</div>
      </aside>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={null}>
      <AuthInner />
    </Suspense>
  );
}
