'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { api, errorMessage } from '../../../lib/api';
import type { User } from '../../../lib/types';
import { useAuthStore } from '../../../store/authStore';
import { Button } from '../../../components/ui/Button';
import { Field, Input } from '../../../components/ui/Field';
import { Notice } from '../../../components/ui/misc';
import { LogoFull } from '../../../components/site/Logo';
import { ThemeToggle } from '../../../components/site/ThemeToggle';

export default function AdminLoginPage() {
  const router = useRouter();
  const { hydrated, isAuthenticated, user, setAuth } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Already signed in as an admin: go straight in.
  useEffect(() => {
    if (hydrated && isAuthenticated && user?.is_admin) router.replace('/admin');
  }, [hydrated, isAuthenticated, user?.is_admin, router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password) { setError('Enter your admin email and password.'); return; }
    setLoading(true);
    try {
      await api('/auth/login-password', {
        method: 'POST',
        body: { identifier: email.trim(), channel: 'email', password },
        fallbackError: 'Incorrect email or password.',
      });
      const me = await api<User>('/auth/me');
      if (!me.is_admin) {
        // Don't sign a regular user into the site from here: end that session again.
        await api('/auth/logout', { method: 'POST' }).catch(() => {});
        setError('This account doesn’t have admin access.');
        return;
      }
      setAuth(me);
      router.replace('/admin');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      <div className="aurora opacity-60" aria-hidden />
      <div className="grid-fade" aria-hidden />
      <div className="absolute right-4 top-4"><ThemeToggle /></div>

      <div className="relative w-full max-w-[400px] animate-page-in">
        <div className="mb-8 flex flex-col items-center justify-center gap-3">
          <LogoFull className="h-24" />
          <span className="rounded bg-accent/10 px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-accent">Admin</span>
        </div>

        <form onSubmit={submit} noValidate className="rounded-xl border border-line bg-surface/90 p-7 shadow-lift backdrop-blur-xl">
          <div className="mb-6 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-md border border-accent/30 bg-accent/10 text-accent">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-lg font-semibold tracking-[-0.02em]">Admin sign in</h1>
              <p className="text-[13px] text-ink-3">Restricted to TickOrbit staff.</p>
            </div>
          </div>

          <div className="space-y-4">
            {error && <Notice tone="error">{error}</Notice>}
            <Field label="Email">
              {(p) => <Input {...p} type="email" autoComplete="username" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@tickorbit.in" />}
            </Field>
            <Field label="Password">
              {(p) => (
                <div className="relative">
                  <Input {...p} type={show ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="pr-11" />
                  <button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'} className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-2 text-ink-3 hover:text-ink">
                    {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              )}
            </Field>
            <Button type="submit" size="lg" className="w-full" loading={loading}>Sign in to console</Button>
          </div>
        </form>
        <p className="mt-5 text-center text-xs text-ink-3">All admin activity is recorded in the audit log.</p>
      </div>
    </div>
  );
}
