'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../../store/authStore';
import { API_BASE } from '../../lib/api';

// Email-only (MSG91/Gmail SMTP is configured for email OTP only).
const channel = 'email' as const;
type Step = 'select' | 'password' | 'otp' | 'set-password' | 'full-name' | 'reset-otp';

async function parseError(response: Response, fallback: string): Promise<string> {
  try {
    const data = await response.json();
    if (typeof data.detail === 'string') return data.detail;
    if (Array.isArray(data.detail) && data.detail[0]?.msg) return data.detail[0].msg;
  } catch {}
  return fallback;
}

const STEP_INDEX: Record<Step, number> = { select: 0, password: 1, otp: 1, 'set-password': 2, 'reset-otp': 2, 'full-name': 3 };

export default function AuthPage() {
  const router = useRouter();
  const { isAuthenticated, setAuth, token: storedToken } = useAuthStore();

  const [identifier, setIdentifier] = useState('');
  const [step, setStep] = useState<Step>('select');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [name, setName] = useState('');
  const [pendingToken, setPendingToken] = useState<string | null>(null);

  useEffect(() => { if (isAuthenticated) router.push('/dashboard'); }, [isAuthenticated, router]);

  const handleContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(identifier)) { setError('Enter a valid email address.'); return; }
    setLoading(true);
    try {
      const checkRes = await fetch(`${API_BASE}/auth/check-account`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identifier, channel }) });
      if (!checkRes.ok) { setError(await parseError(checkRes, 'Something went wrong. Please try again.')); return; }
      const check = await checkRes.json();
      if (check.exists && check.has_password) { setStep('password'); return; }
      const otpRes = await fetch(`${API_BASE}/auth/send-otp`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identifier, channel }) });
      if (!otpRes.ok) { setError(await parseError(otpRes, 'Could not send OTP. Please try again.')); return; }
      setStep('otp');
    } catch { setError('Could not reach the server. Please check your connection and try again.'); }
    finally { setLoading(false); }
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/login-password`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identifier, channel, password }) });
      if (!res.ok) { setError(await parseError(res, 'Invalid credentials.')); return; }
      const data = await res.json();
      await loadProfileAndFinish(data.access_token);
    } catch { setError('Could not reach the server. Please check your connection and try again.'); }
    finally { setLoading(false); }
  };

  const handleForgotPassword = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/forgot-password`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identifier, channel }) });
      if (!res.ok) { setError(await parseError(res, 'Could not send reset code.')); return; }
      setOtp('');
      setStep('reset-otp');
    } catch { setError('Could not reach the server. Please check your connection and try again.'); }
    finally { setLoading(false); }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (otp.length !== 6) { setError('OTP must be exactly 6 digits.'); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/verify-otp`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identifier, channel, otp }) });
      if (!res.ok) { setError(await parseError(res, 'Invalid or expired OTP.')); return; }
      const data = await res.json();
      setPendingToken(data.access_token);
      if (data.is_new_user || !data.has_password) { setStep('set-password'); }
      else { await loadProfileAndFinish(data.access_token); }
    } catch { setError('Could not reach the server. Please check your connection and try again.'); }
    finally { setLoading(false); }
  };

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
    const activeToken = pendingToken || storedToken;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/set-password`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${activeToken}` }, body: JSON.stringify({ password, confirm_password: confirmPassword }) });
      if (!res.ok) { setError(await parseError(res, 'Could not set password.')); return; }
      setStep('full-name');
    } catch { setError('Could not reach the server. Please check your connection and try again.'); }
    finally { setLoading(false); }
  };

  const handleSetName = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) { setError('Please enter your full name.'); return; }
    const activeToken = pendingToken || storedToken;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/me`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${activeToken}` }, body: JSON.stringify({ name }) });
      if (!res.ok) { setError(await parseError(res, 'Could not save your name.')); return; }
      await loadProfileAndFinish(activeToken!);
    } catch { setError('Could not reach the server. Please check your connection and try again.'); }
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
      setStep('password');
    } catch { setError('Could not reach the server. Please check your connection and try again.'); }
    finally { setLoading(false); }
  };

  const loadProfileAndFinish = async (accessToken: string) => {
    const userRes = await fetch(`${API_BASE}/auth/me`, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!userRes.ok) { setError('Logged in, but could not load your profile. Please try again.'); return; }
    const userProfile = await userRes.json();
    setAuth(userProfile, accessToken);
    router.push('/dashboard');
  };

  const stepNum = STEP_INDEX[step] + 1;
  const copy: Record<Step, { t: string; b: string }> = {
    'select': { t: 'Enter your email', b: 'We will send a 6-digit code. No password needed yet.' },
    'password': { t: 'Welcome back', b: `Enter the password for ${identifier}.` },
    'otp': { t: 'Check your inbox', b: `We sent a code to ${identifier}. It expires in 10 minutes.` },
    'set-password': { t: 'Set a password', b: 'Faster next time. Minimum 8 characters.' },
    'reset-otp': { t: 'Reset your password', b: `Enter the code sent to ${identifier} and choose a new password.` },
    'full-name': { t: 'What should we call you?', b: 'This name appears on your listings and chats.' },
  };

  return (
    <section style={{ maxWidth: 480, margin: '0 auto', padding: '70px 20px 100px' }}>
      <div className="glass-strong" style={{ position: 'relative', padding: 34 }}>
        {/* progress bars */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 26 }}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} style={{ flex: 1, height: 4, borderRadius: 99, background: i <= STEP_INDEX[step] ? 'linear-gradient(90deg,#7c3aed,#c084fc)' : 'rgba(255,255,255,.1)', boxShadow: i <= STEP_INDEX[step] ? '0 0 14px rgba(168,85,247,.7)' : 'none' }} />
          ))}
        </div>
        <div style={{ fontSize: 12, letterSpacing: '.2em', textTransform: 'uppercase', color: '#c084fc' }}>Step {stepNum} of 4</div>
        <h1 className="font-display" style={{ fontWeight: 700, fontSize: 29, color: '#fff', letterSpacing: '-.03em', margin: '12px 0 8px' }}>{copy[step].t}</h1>
        <p style={{ color: '#9d90b6', fontSize: 14.5, lineHeight: 1.6, margin: '0 0 24px' }}>{copy[step].b}</p>

        {error && <div style={{ marginBottom: 18, padding: '11px 14px', fontSize: 13, background: 'rgba(244,63,94,.1)', border: '1px solid rgba(244,63,94,.25)', color: '#fda4af', borderRadius: 12 }}>{error}</div>}

        {step === 'select' && (
          <form onSubmit={handleContinue} noValidate>
            <input className="field" type="email" placeholder="you@email.com" value={identifier} onChange={(e) => setIdentifier(e.target.value)} style={{ marginBottom: 20 }} required />
            <button type="submit" disabled={loading} className="btn-shimmer" style={{ width: '100%', padding: 15, borderRadius: 16, fontSize: 15.5 }}>{loading ? 'Please wait…' : 'Send code'}</button>
          </form>
        )}

        {step === 'password' && (
          <form onSubmit={handlePasswordLogin} noValidate>
            <input className="field" type="password" placeholder="Your password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ marginBottom: 16 }} required />
            <button type="submit" disabled={loading} className="btn-shimmer" style={{ width: '100%', padding: 15, borderRadius: 16, fontSize: 15.5 }}>{loading ? 'Logging in…' : 'Log in'}</button>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16, fontSize: 13 }}>
              <button type="button" onClick={() => setStep('select')} style={linkBtn}>← Back</button>
              <button type="button" onClick={handleForgotPassword} style={{ ...linkBtn, color: '#c084fc' }}>Forgot password?</button>
            </div>
          </form>
        )}

        {step === 'otp' && (
          <form onSubmit={handleVerifyOtp} noValidate>
            <OtpBoxes value={otp} onChange={setOtp} />
            <button type="submit" disabled={loading} className="btn-shimmer" style={{ width: '100%', marginTop: 20, padding: 15, borderRadius: 16, fontSize: 15.5 }}>{loading ? 'Verifying…' : 'Verify code'}</button>
            <button type="button" onClick={() => setStep('select')} style={{ ...linkBtn, marginTop: 16, display: 'block' }}>← Change email</button>
          </form>
        )}

        {step === 'set-password' && (
          <form onSubmit={handleSetPassword} noValidate>
            <input className="field" type="password" placeholder="Password (min 8 chars)" value={password} onChange={(e) => setPassword(e.target.value)} style={{ marginBottom: 12 }} required />
            <input className="field" type="password" placeholder="Retype password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} style={{ marginBottom: 20 }} required />
            <button type="submit" disabled={loading} className="btn-shimmer" style={{ width: '100%', padding: 15, borderRadius: 16, fontSize: 15.5 }}>{loading ? 'Saving…' : 'Continue'}</button>
          </form>
        )}

        {step === 'full-name' && (
          <form onSubmit={handleSetName} noValidate>
            <input className="field" type="text" placeholder="Aarav Sharma" value={name} onChange={(e) => setName(e.target.value)} style={{ marginBottom: 20 }} required />
            <button type="submit" disabled={loading} className="btn-shimmer" style={{ width: '100%', padding: 15, borderRadius: 16, fontSize: 15.5 }}>{loading ? 'Finishing…' : 'Finish setup'}</button>
          </form>
        )}

        {step === 'reset-otp' && (
          <form onSubmit={handleResetPassword} noValidate>
            <OtpBoxes value={otp} onChange={setOtp} />
            <input className="field" type="password" placeholder="New password (min 8)" value={password} onChange={(e) => setPassword(e.target.value)} style={{ margin: '16px 0 12px' }} required />
            <input className="field" type="password" placeholder="Retype new password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} style={{ marginBottom: 20 }} required />
            <button type="submit" disabled={loading} className="btn-shimmer" style={{ width: '100%', padding: 15, borderRadius: 16, fontSize: 15.5 }}>{loading ? 'Saving…' : 'Reset password'}</button>
            <button type="button" onClick={() => setStep('password')} style={{ ...linkBtn, marginTop: 16, display: 'block' }}>← Back to login</button>
          </form>
        )}

        <div style={{ textAlign: 'center', marginTop: 18, fontSize: 13.5, color: '#8b7fa3' }}>Email only. No passwords to remember until you want one.</div>
      </div>
    </section>
  );
}

const linkBtn: React.CSSProperties = { background: 'transparent', border: 'none', color: '#a99cc0', fontSize: 13, cursor: 'pointer', padding: 0 };

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
          style={{ flex: 1, minWidth: 0, textAlign: 'center', fontFamily: 'Outfit', fontWeight: 700, fontSize: 22, color: '#fff', padding: '14px 0', borderRadius: 14, border: '1px solid rgba(168,85,247,.35)', background: 'rgba(255,255,255,.05)', outline: 'none' }}
          onFocus={(e) => { e.target.style.borderColor = '#c084fc'; e.target.style.boxShadow = '0 0 0 3px rgba(168,85,247,.25)'; }}
          onBlur={(e) => { e.target.style.borderColor = 'rgba(168,85,247,.35)'; e.target.style.boxShadow = 'none'; }}
        />
      ))}
    </div>
  );
}
