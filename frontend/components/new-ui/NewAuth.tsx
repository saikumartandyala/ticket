'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../../store/authStore';
import { API_BASE } from '../../lib/api';

// Email-only (OTP + password are configured for email).
const channel = 'email' as const;

type Step =
  | 'choose'            // pick Sign in vs Create account
  | 'signin'           // existing user: email + password
  | 'reset-otp'        // forgot password: otp + new password
  | 'register-email'   // new user: enter email -> send OTP
  | 'register-otp'     // verify OTP
  | 'register-password'// set a password
  | 'register-name';   // set display name

// Ordered steps of the Create-account flow, used for the progress bar.
const REGISTER_STEPS: Step[] = ['register-email', 'register-otp', 'register-password', 'register-name'];
const NET_ERR = 'Could not reach the server. Please check your connection and try again.';

const bri = "'Bricolage Grotesque', system-ui, sans-serif";

async function parseError(response: Response, fallback: string): Promise<string> {
  try {
    const data = await response.json();
    if (typeof data.detail === 'string') return data.detail;
    if (Array.isArray(data.detail) && data.detail[0]?.msg) return data.detail[0].msg;
  } catch {}
  return fallback;
}

export function NewAuth() {
  const router = useRouter();
  const { isAuthenticated, setAuth, token: storedToken } = useAuthStore();

  const [identifier, setIdentifier] = useState('');
  const [step, setStep] = useState<Step>('choose');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [name, setName] = useState('');
  const [pendingToken, setPendingToken] = useState<string | null>(null);

  useEffect(() => { if (isAuthenticated) router.push('/dashboard'); }, [isAuthenticated, router]);

  const validEmail = (v: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v);
  const goto = (s: Step) => { setError(''); setStep(s); };

  // ---------- Sign in (existing account) ----------
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!validEmail(identifier)) { setError('Enter a valid email address.'); return; }
    if (!password) { setError('Enter your password.'); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/login-password`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identifier, channel, password }) });
      if (!res.ok) { setError(await parseError(res, 'Incorrect email or password. New here? Create an account.')); return; }
      const data = await res.json();
      await loadProfileAndFinish(data.access_token);
    } catch { setError(NET_ERR); }
    finally { setLoading(false); }
  };

  const handleForgotPassword = async () => {
    setError('');
    if (!validEmail(identifier)) { setError('Enter your account email above first.'); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/forgot-password`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identifier, channel }) });
      if (!res.ok) { setError(await parseError(res, 'Could not send reset code.')); return; }
      setOtp(''); setPassword(''); setConfirmPassword('');
      setStep('reset-otp');
    } catch { setError(NET_ERR); }
    finally { setLoading(false); }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (otp.length !== 6) { setError('OTP must be exactly 6 digits.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/reset-password`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identifier, channel, otp, new_password: password, confirm_password: confirmPassword }) });
      if (!res.ok) { setError(await parseError(res, 'Could not reset password.')); return; }
      setOtp(''); setPassword(''); setConfirmPassword('');
      setStep('signin');
    } catch { setError(NET_ERR); }
    finally { setLoading(false); }
  };

  // ---------- Create account (new user) ----------
  const handleRegisterEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!validEmail(identifier)) { setError('Enter a valid email address.'); return; }
    setLoading(true);
    try {
      const checkRes = await fetch(`${API_BASE}/auth/check-account`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identifier, channel }) });
      if (!checkRes.ok) { setError(await parseError(checkRes, 'Something went wrong. Please try again.')); return; }
      const check = await checkRes.json();
      if (check.exists && check.has_password) { setError('An account with this email already exists. Please sign in instead.'); return; }
      const otpRes = await fetch(`${API_BASE}/auth/send-otp`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identifier, channel }) });
      if (!otpRes.ok) { setError(await parseError(otpRes, 'Could not send the code. Please try again.')); return; }
      setOtp('');
      setStep('register-otp');
    } catch { setError(NET_ERR); }
    finally { setLoading(false); }
  };

  const handleRegisterOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (otp.length !== 6) { setError('OTP must be exactly 6 digits.'); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/verify-otp`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identifier, channel, otp }) });
      if (!res.ok) { setError(await parseError(res, 'Invalid or expired OTP.')); return; }
      const data = await res.json();
      setPendingToken(data.access_token);
      // Fresh registration always sets a password next; if the account somehow
      // already had one, just finish signing in.
      if (data.has_password) { await loadProfileAndFinish(data.access_token); }
      else { setStep('register-password'); }
    } catch { setError(NET_ERR); }
    finally { setLoading(false); }
  };

  const handleRegisterPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
    const activeToken = pendingToken || storedToken;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/set-password`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${activeToken}` }, body: JSON.stringify({ password, confirm_password: confirmPassword }) });
      if (!res.ok) { setError(await parseError(res, 'Could not set password.')); return; }
      setStep('register-name');
    } catch { setError(NET_ERR); }
    finally { setLoading(false); }
  };

  const handleRegisterName = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) { setError('Please enter your full name.'); return; }
    const activeToken = pendingToken || storedToken;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/me`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${activeToken}` }, body: JSON.stringify({ name }) });
      if (!res.ok) { setError(await parseError(res, 'Could not save your name.')); return; }
      await loadProfileAndFinish(activeToken!);
    } catch { setError(NET_ERR); }
    finally { setLoading(false); }
  };

  const loadProfileAndFinish = async (accessToken: string) => {
    const userRes = await fetch(`${API_BASE}/auth/me`, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!userRes.ok) { setError('Signed in, but could not load your profile. Please try again.'); return; }
    const userProfile = await userRes.json();
    setAuth(userProfile, accessToken);
    router.push('/dashboard');
  };

  const regIndex = REGISTER_STEPS.indexOf(step);
  const isRegister = regIndex >= 0;
  const copy: Record<Step, { t: string; b: string }> = {
    'choose': { t: 'Welcome to LastMinutePass', b: 'Sign in to your account, or create a new one.' },
    'signin': { t: 'Sign in', b: 'Enter your email and password to continue.' },
    'reset-otp': { t: 'Reset your password', b: `Enter the code sent to ${identifier} and choose a new password.` },
    'register-email': { t: 'Create your account', b: 'Enter your email — we will send a 6-digit code to verify it.' },
    'register-otp': { t: 'Verify your email', b: `We sent a code to ${identifier}. It expires in 10 minutes.` },
    'register-password': { t: 'Set a password', b: 'You will use this to sign in next time. Minimum 8 characters.' },
    'register-name': { t: 'What should we call you?', b: 'This name appears on your listings and chats.' },
  };

  return (
    <section style={{ maxWidth: 480, margin: '0 auto', padding: '70px 20px 100px' }}>
      <div
        className="anim-rise"
        style={{
          position: 'relative',
          padding: 34,
          borderRadius: 28,
          border: '1px solid rgba(37,99,235,.24)',
          background: 'linear-gradient(160deg,#ffffff,#fbfcfe)',
          backdropFilter: 'blur(22px)',
          WebkitBackdropFilter: 'blur(22px)',
          boxShadow: 'inset 0 0 80px rgba(37,99,235,.07), 0 30px 70px rgba(15,23,42,.14)',
        }}
      >
        {isRegister && (
          <>
            <div style={{ display: 'flex', gap: 8, marginBottom: 26 }}>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} style={{ flex: 1, height: 4, borderRadius: 99, background: i <= regIndex ? 'linear-gradient(90deg,#1e40af,#60a5fa)' : 'rgba(15,23,42,.1)', boxShadow: i <= regIndex ? '0 0 14px rgba(37,99,235,.7)' : 'none' }} />
              ))}
            </div>
            <div style={{ fontSize: 12, letterSpacing: '.2em', textTransform: 'uppercase', color: '#2563eb' }}>Step {regIndex + 1} of 4</div>
          </>
        )}
        <h1 style={{ fontFamily: bri, fontWeight: 700, fontSize: 29, color: '#0f172a', letterSpacing: '-.03em', margin: `${isRegister ? 12 : 0}px 0 8px` }}>{copy[step].t}</h1>
        <p style={{ color: '#6b7488', fontSize: 14.5, lineHeight: 1.6, margin: '0 0 24px' }}>{copy[step].b}</p>

        {error && <div style={{ marginBottom: 18, padding: '11px 14px', fontSize: 13, background: 'rgba(244,63,94,.08)', border: '1px solid rgba(244,63,94,.25)', color: '#b91c1c', borderRadius: 12 }}>{error}</div>}

        {step === 'choose' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <button onClick={() => { setPassword(''); goto('signin'); }} style={btnPrimary} {...lift}>Sign in</button>
            <button onClick={() => { setPassword(''); setConfirmPassword(''); setName(''); setOtp(''); goto('register-email'); }} style={btnGhost} {...ghostHover}>Create account</button>
          </div>
        )}

        {step === 'signin' && (
          <form onSubmit={handleSignIn} noValidate>
            <input type="email" placeholder="you@email.com" value={identifier} onChange={(e) => setIdentifier(e.target.value)} style={{ ...fieldStyle, marginBottom: 12 }} {...focusRing} required />
            <input type="password" placeholder="Your password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ ...fieldStyle, marginBottom: 16 }} {...focusRing} required />
            <button type="submit" disabled={loading} style={btnPrimary} {...lift}>{loading ? 'Signing in…' : 'Sign in'}</button>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16, fontSize: 13 }}>
              <button type="button" onClick={() => goto('choose')} style={linkBtn}>← Back</button>
              <button type="button" onClick={handleForgotPassword} style={{ ...linkBtn, color: '#2563eb' }}>Forgot password?</button>
            </div>
            <div style={{ textAlign: 'center', marginTop: 14, fontSize: 13, color: '#6b7488' }}>
              New here?{' '}
              <button type="button" onClick={() => { setPassword(''); goto('register-email'); }} style={{ ...linkBtn, color: '#2563eb' }}>Create an account</button>
            </div>
          </form>
        )}

        {step === 'register-email' && (
          <form onSubmit={handleRegisterEmail} noValidate>
            <input type="email" placeholder="you@email.com" value={identifier} onChange={(e) => setIdentifier(e.target.value)} style={{ ...fieldStyle, marginBottom: 20 }} {...focusRing} required />
            <button type="submit" disabled={loading} style={btnPrimary} {...lift}>{loading ? 'Please wait…' : 'Send code'}</button>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16, fontSize: 13 }}>
              <button type="button" onClick={() => goto('choose')} style={linkBtn}>← Back</button>
              <button type="button" onClick={() => { setPassword(''); goto('signin'); }} style={{ ...linkBtn, color: '#2563eb' }}>Already have an account?</button>
            </div>
          </form>
        )}

        {step === 'register-otp' && (
          <form onSubmit={handleRegisterOtp} noValidate>
            <OtpBoxes value={otp} onChange={setOtp} />
            <button type="submit" disabled={loading} style={{ ...btnPrimary, marginTop: 20 }} {...lift}>{loading ? 'Verifying…' : 'Verify code'}</button>
            <button type="button" onClick={() => goto('register-email')} style={{ ...linkBtn, marginTop: 16, display: 'block' }}>← Change email</button>
          </form>
        )}

        {step === 'register-password' && (
          <form onSubmit={handleRegisterPassword} noValidate>
            <input type="password" placeholder="Password (min 8 chars)" value={password} onChange={(e) => setPassword(e.target.value)} style={{ ...fieldStyle, marginBottom: 12 }} {...focusRing} required />
            <input type="password" placeholder="Retype password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} style={{ ...fieldStyle, marginBottom: 20 }} {...focusRing} required />
            <button type="submit" disabled={loading} style={btnPrimary} {...lift}>{loading ? 'Saving…' : 'Continue'}</button>
          </form>
        )}

        {step === 'register-name' && (
          <form onSubmit={handleRegisterName} noValidate>
            <input type="text" placeholder="Aarav Sharma" value={name} onChange={(e) => setName(e.target.value)} style={{ ...fieldStyle, marginBottom: 20 }} {...focusRing} required />
            <button type="submit" disabled={loading} style={btnPrimary} {...lift}>{loading ? 'Finishing…' : 'Finish setup'}</button>
          </form>
        )}

        {step === 'reset-otp' && (
          <form onSubmit={handleResetPassword} noValidate>
            <OtpBoxes value={otp} onChange={setOtp} />
            <input type="password" placeholder="New password (min 8)" value={password} onChange={(e) => setPassword(e.target.value)} style={{ ...fieldStyle, margin: '16px 0 12px' }} {...focusRing} required />
            <input type="password" placeholder="Retype new password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} style={{ ...fieldStyle, marginBottom: 20 }} {...focusRing} required />
            <button type="submit" disabled={loading} style={btnPrimary} {...lift}>{loading ? 'Saving…' : 'Reset password'}</button>
            <button type="button" onClick={() => goto('signin')} style={{ ...linkBtn, marginTop: 16, display: 'block' }}>← Back to sign in</button>
          </form>
        )}

        <div style={{ textAlign: 'center', marginTop: 18, fontSize: 13.5, color: '#6b7488' }}>Email only. Sign in with your password, or create an account in seconds.</div>
      </div>
    </section>
  );
}

const fieldStyle: React.CSSProperties = {
  width: '100%',
  padding: '15px 16px',
  borderRadius: 14,
  border: '1px solid rgba(37,99,235,.3)',
  background: '#f6f8fd',
  color: '#0f172a',
  fontSize: 15,
  fontFamily: 'inherit',
  outline: 'none',
};

const btnPrimary: React.CSSProperties = {
  width: '100%',
  padding: 15,
  borderRadius: 16,
  border: '1px solid rgba(191,219,254,.5)',
  color: '#ffffff',
  fontWeight: 600,
  fontSize: 15.5,
  cursor: 'pointer',
  background: 'linear-gradient(100deg,#1e40af,#2563eb,#60a5fa,#1e40af)',
  backgroundSize: '200% 100%',
  animation: 'lmpShimmer 6s linear infinite',
  boxShadow: '0 14px 40px rgba(30,64,175,.45)',
  transition: 'transform .18s ease',
};

const btnGhost: React.CSSProperties = {
  width: '100%',
  padding: 15,
  borderRadius: 16,
  border: '1px solid rgba(37,99,235,.3)',
  background: '#ffffff',
  color: '#1e40af',
  fontWeight: 600,
  fontSize: 15.5,
  cursor: 'pointer',
  transition: 'background .18s ease, transform .18s ease',
};

const linkBtn: React.CSSProperties = { background: 'transparent', border: 'none', color: '#5b6478', fontSize: 13, cursor: 'pointer', padding: 0 };

// Focus ring for text inputs, matching the design's blue glow.
const focusRing = {
  onFocus: (e: React.FocusEvent<HTMLInputElement>) => { e.currentTarget.style.borderColor = '#2563eb'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37,99,235,.22)'; },
  onBlur: (e: React.FocusEvent<HTMLInputElement>) => { e.currentTarget.style.borderColor = 'rgba(37,99,235,.3)'; e.currentTarget.style.boxShadow = 'none'; },
};

// Subtle lift on the primary/shimmer buttons (design: translateY(-2px) on hover).
const lift = {
  onMouseEnter: (e: React.MouseEvent<HTMLButtonElement>) => { e.currentTarget.style.transform = 'translateY(-2px)'; },
  onMouseLeave: (e: React.MouseEvent<HTMLButtonElement>) => { e.currentTarget.style.transform = 'none'; },
};

const ghostHover = {
  onMouseEnter: (e: React.MouseEvent<HTMLButtonElement>) => { e.currentTarget.style.background = 'rgba(37,99,235,.06)'; e.currentTarget.style.transform = 'translateY(-2px)'; },
  onMouseLeave: (e: React.MouseEvent<HTMLButtonElement>) => { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.transform = 'none'; },
};

function OtpBoxes({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = value.padEnd(6, ' ').slice(0, 6).split('');

  const set = (i: number, ch: string) => {
    const clean = ch.replace(/\D/g, '').slice(-1);
    const arr = value.padEnd(6, ' ').split('');
    arr[i] = clean || ' ';
    onChange(arr.join('').replace(/ /g, ''));
    if (clean && i < 5) refs.current[i + 1]?.focus();
  };
  const onKey = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[i].trim() && i > 0) refs.current[i - 1]?.focus();
  };
  const onPaste = (e: React.ClipboardEvent) => {
    const txt = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (txt) { onChange(txt); e.preventDefault(); }
  };

  return (
    <div style={{ display: 'flex', gap: 10 }}>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          maxLength={1}
          inputMode="numeric"
          value={digits[i].trim()}
          onChange={(e) => set(i, e.target.value)}
          onKeyDown={(e) => onKey(i, e)}
          onPaste={onPaste}
          style={{ flex: 1, minWidth: 0, textAlign: 'center', fontFamily: bri, fontWeight: 700, fontSize: 22, color: '#0f172a', padding: '14px 0', borderRadius: 14, border: '1px solid rgba(37,99,235,.35)', background: '#f6f8fd', outline: 'none' }}
          onFocus={(e) => { e.target.style.borderColor = '#2563eb'; e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,.25)'; }}
          onBlur={(e) => { e.target.style.borderColor = 'rgba(37,99,235,.35)'; e.target.style.boxShadow = 'none'; }}
        />
      ))}
    </div>
  );
}
