'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../../store/authStore';
import { Mail, CheckCircle, ArrowRight, ArrowLeft, KeyRound, Lock, UserRound } from 'lucide-react';
import { API_BASE } from '../../lib/api';

// Email-only for now — no SMS provider is configured (MSG91 is set up for
// email OTP only), so a phone channel isn't actually usable yet.
const channel = 'email' as const;
type Step = 'select' | 'password' | 'otp' | 'set-password' | 'full-name' | 'reset-otp';

async function parseError(response: Response, fallback: string): Promise<string> {
  try {
    const data = await response.json();
    if (typeof data.detail === 'string') return data.detail;
    if (Array.isArray(data.detail) && data.detail[0]?.msg) return data.detail[0].msg;
  } catch {
    // fall through to generic message
  }
  return fallback;
}

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

  const channelLabel = 'email address';

  // Already logged in? Don't show the login form again — send them on.
  useEffect(() => {
    if (isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, router]);

  // Step 1: enter email, decide whether to show password or OTP
  const handleContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(identifier)) {
      setError('Enter a valid email address.');
      return;
    }

    setLoading(true);
    try {
      const checkRes = await fetch(`${API_BASE}/auth/check-account`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, channel }),
      });
      if (!checkRes.ok) {
        setError(await parseError(checkRes, 'Something went wrong. Please try again.'));
        return;
      }
      const check = await checkRes.json();

      if (check.exists && check.has_password) {
        setStep('password');
        return;
      }

      const otpRes = await fetch(`${API_BASE}/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, channel }),
      });
      if (!otpRes.ok) {
        setError(await parseError(otpRes, 'Could not send OTP. Please try again.'));
        return;
      }
      setStep('otp');
    } catch (err) {
      setError('Could not reach the server. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  // Existing account: password login
  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/login-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, channel, password }),
      });
      if (!res.ok) {
        setError(await parseError(res, 'Invalid credentials.'));
        return;
      }
      const data = await res.json();
      await loadProfileAndFinish(data.access_token);
    } catch (err) {
      setError('Could not reach the server. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, channel }),
      });
      if (!res.ok) {
        setError(await parseError(res, 'Could not send reset code.'));
        return;
      }
      setStep('reset-otp');
    } catch (err) {
      setError('Could not reach the server. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  // New (or password-less) account: verify OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (otp.length !== 6) {
      setError('OTP must be exactly 6 digits.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, channel, otp }),
      });
      if (!res.ok) {
        setError(await parseError(res, 'Invalid or expired OTP.'));
        return;
      }
      const data = await res.json();
      setPendingToken(data.access_token);

      if (data.is_new_user || !data.has_password) {
        // Registration isn't complete yet — hold the token privately and
        // keep going through set-password + full-name. The user is NOT
        // marked as logged in (no setAuth call) until that whole wizard
        // finishes, so an abandoned signup never looks "logged in".
        setStep('set-password');
      } else {
        await loadProfileAndFinish(data.access_token);
      }
    } catch (err) {
      setError('Could not reach the server. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  // New account: set password
  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    const activeToken = pendingToken || storedToken;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/set-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${activeToken}`,
        },
        body: JSON.stringify({ password, confirm_password: confirmPassword }),
      });
      if (!res.ok) {
        setError(await parseError(res, 'Could not set password.'));
        return;
      }
      setStep('full-name');
    } catch (err) {
      setError('Could not reach the server. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  // New account: full name, then done
  const handleSetName = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) {
      setError('Please enter your full name.');
      return;
    }

    const activeToken = pendingToken || storedToken;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${activeToken}`,
        },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        setError(await parseError(res, 'Could not save your name.'));
        return;
      }
      // Registration wizard is now fully complete (OTP verified, password
      // set, name set) — this is the one place a new account actually
      // becomes "logged in".
      await loadProfileAndFinish(activeToken!);
    } catch (err) {
      setError('Could not reach the server. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  // Forgot-password flow: verify OTP + set new password in one step
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (otp.length !== 6) {
      setError('OTP must be exactly 6 digits.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier,
          channel,
          otp,
          new_password: password,
          confirm_password: confirmPassword,
        }),
      });
      if (!res.ok) {
        setError(await parseError(res, 'Could not reset password.'));
        return;
      }
      setOtp('');
      setPassword('');
      setConfirmPassword('');
      setStep('password');
    } catch (err) {
      setError('Could not reach the server. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  // Fetches the real profile and stores it; redirects unless skipRedirect (mid-registration)
  const loadProfileAndFinish = async (accessToken: string, opts?: { skipRedirect?: boolean }) => {
    const userRes = await fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!userRes.ok) {
      setError('Logged in, but could not load your profile. Please try again.');
      return;
    }
    const userProfile = await userRes.json();
    setAuth(userProfile, accessToken);

    if (!opts?.skipRedirect) {
      router.push('/dashboard');
    }
  };

  return (
    <div className="relative">
      <div className="absolute top-0 left-0 right-0 h-[500px] hero-beam" />
      <div className="relative max-w-md mx-auto my-16 px-6">
      <div className="glow-card p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-violet-500/20 to-transparent rounded-bl-full pointer-events-none" />

        {error && (
          <div className="mb-6 p-3 text-xs bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg">
            {error}
          </div>
        )}

        {step === 'select' && (
          <form onSubmit={handleContinue} noValidate className="space-y-6">
            <div className="text-center space-y-2">
              <Mail className="w-10 h-10 text-violet-500 mx-auto" />
              <h2 className="text-2xl font-black font-display">Log In or Sign Up</h2>
              <p className="text-xs text-slate-400">Enter your email to continue.</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400">Email Address</label>
              <input
                type="email"
                placeholder="you@example.com"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="w-full input-glass text-sm"
                required
              />
            </div>

            <button type="submit" disabled={loading} className="w-full btn-primary flex items-center justify-center gap-2 text-sm py-3">
              <span>{loading ? 'Please wait...' : 'Continue'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {step === 'password' && (
          <form onSubmit={handlePasswordLogin} noValidate className="space-y-6">
            <div className="text-center space-y-2">
              <Lock className="w-10 h-10 text-violet-500 mx-auto" />
              <h2 className="text-2xl font-black font-display">Enter Password</h2>
              <p className="text-xs text-slate-400">Logging in as {identifier}</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full input-glass text-sm"
                required
              />
            </div>

            <button type="submit" disabled={loading} className="w-full btn-primary flex items-center justify-center gap-2 text-sm py-3">
              <span>{loading ? 'Logging in...' : 'Log In'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <div className="flex justify-between text-xs">
              <button type="button" onClick={() => setStep('select')} className="text-slate-400 hover:text-slate-300 flex items-center gap-1">
                <ArrowLeft className="w-3.5 h-3.5" /> Back
              </button>
              <button type="button" onClick={handleForgotPassword} className="text-violet-400 hover:text-violet-300 font-semibold">
                Forgot password?
              </button>
            </div>
          </form>
        )}

        {step === 'otp' && (
          <form onSubmit={handleVerifyOtp} noValidate className="space-y-6">
            <div className="text-center space-y-2">
              <KeyRound className="w-10 h-10 text-fuchsia-500 mx-auto" />
              <h2 className="text-2xl font-black font-display">Enter OTP</h2>
              <p className="text-xs text-slate-400">We&apos;ve sent a 6-digit code to your {channelLabel}</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400">6-Digit Code</label>
              <input
                type="text"
                placeholder="123456"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                className="w-full input-glass text-center font-bold tracking-[0.75em] text-lg placeholder:font-normal placeholder:text-slate-700"
                maxLength={6}
                required
              />
            </div>

            <button type="submit" disabled={loading} className="w-full btn-primary flex items-center justify-center gap-2 text-sm py-3">
              <CheckCircle className="w-4 h-4" />
              <span>{loading ? 'Verifying...' : 'Verify'}</span>
            </button>

            <button type="button" onClick={() => setStep('select')} className="text-xs text-slate-400 hover:text-slate-300 flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" /> Change email
            </button>
          </form>
        )}

        {step === 'set-password' && (
          <form onSubmit={handleSetPassword} noValidate className="space-y-6">
            <div className="text-center space-y-2">
              <Lock className="w-10 h-10 text-violet-500 mx-auto" />
              <h2 className="text-2xl font-black font-display">Set a Password</h2>
              <p className="text-xs text-slate-400">At least 8 characters. You&apos;ll use this to log in next time.</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full input-glass text-sm"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400">Retype Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full input-glass text-sm"
                required
              />
            </div>

            <button type="submit" disabled={loading} className="w-full btn-primary flex items-center justify-center gap-2 text-sm py-3">
              <span>{loading ? 'Saving...' : 'Continue'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {step === 'full-name' && (
          <form onSubmit={handleSetName} noValidate className="space-y-6">
            <div className="text-center space-y-2">
              <UserRound className="w-10 h-10 text-violet-500 mx-auto" />
              <h2 className="text-2xl font-black font-display">What&apos;s your name?</h2>
              <p className="text-xs text-slate-400">Shown to other users you match with.</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400">Full Name</label>
              <input
                type="text"
                placeholder="e.g. Rahul Sharma"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full input-glass text-sm"
                required
              />
            </div>

            <button type="submit" disabled={loading} className="w-full btn-primary flex items-center justify-center gap-2 text-sm py-3">
              <span>{loading ? 'Finishing up...' : 'Complete Setup'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {step === 'reset-otp' && (
          <form onSubmit={handleResetPassword} noValidate className="space-y-6">
            <div className="text-center space-y-2">
              <KeyRound className="w-10 h-10 text-fuchsia-500 mx-auto" />
              <h2 className="text-2xl font-black font-display">Reset Password</h2>
              <p className="text-xs text-slate-400">Enter the code sent to your {channelLabel} and choose a new password.</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400">6-Digit Code</label>
              <input
                type="text"
                placeholder="123456"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                className="w-full input-glass text-center font-bold tracking-[0.75em] text-lg placeholder:font-normal placeholder:text-slate-700"
                maxLength={6}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400">New Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full input-glass text-sm"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400">Retype New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full input-glass text-sm"
                required
              />
            </div>

            <button type="submit" disabled={loading} className="w-full btn-primary flex items-center justify-center gap-2 text-sm py-3">
              <span>{loading ? 'Saving...' : 'Reset Password'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button type="button" onClick={() => setStep('password')} className="text-xs text-slate-400 hover:text-slate-300 flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" /> Back to login
            </button>
          </form>
        )}
      </div>
      </div>
    </div>
  );
}
