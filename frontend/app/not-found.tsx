import { SearchX } from 'lucide-react';
import { ButtonLink } from '../components/ui/Button';

export default function NotFound() {
  return (
    <div className="container-page flex min-h-[60vh] flex-col items-center justify-center py-16 text-center">
      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full border border-line-strong text-ink-3">
        <SearchX className="h-6 w-6" />
      </div>
      <div className="font-mono text-sm text-ink-3">404</div>
      <h1 className="mt-1 text-2xl font-semibold tracking-[-0.02em]">Page not found</h1>
      <p className="mt-2 max-w-md text-[15px] text-ink-2">The page you&apos;re looking for doesn&apos;t exist or has moved.</p>
      <div className="mt-6 flex gap-2">
        <ButtonLink href="/">Go home</ButtonLink>
        <ButtonLink href="/tickets" variant="secondary">Browse tickets</ButtonLink>
      </div>
    </div>
  );
}
