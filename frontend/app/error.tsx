'use client';

import { useEffect } from 'react';
import { RotateCcw, TriangleAlert } from 'lucide-react';
import { reportError } from '../lib/analytics';
import { Button, ButtonLink } from '../components/ui/Button';

/** Shown when a page crashes while rendering. The error is reported to the admin console. */
export default function PageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
    reportError(`${error.name}: ${error.message}`, error.stack, 'react');
  }, [error]);

  return (
    <div className="container-page flex min-h-[60vh] flex-col items-center justify-center py-16 text-center">
      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full border border-danger/30 bg-danger/10 text-danger">
        <TriangleAlert className="h-6 w-6" />
      </div>
      <h1 className="text-2xl font-semibold tracking-[-0.02em]">Something went wrong</h1>
      <p className="mt-2 max-w-md text-[15px] text-ink-2">This page hit an unexpected error. It&apos;s been reported to our team. Try again, or head back home.</p>
      <div className="mt-6 flex gap-2">
        <Button onClick={reset}><RotateCcw className="h-4 w-4" />Try again</Button>
        <ButtonLink href="/" variant="secondary">Go home</ButtonLink>
      </div>
    </div>
  );
}
