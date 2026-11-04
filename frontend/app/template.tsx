/**
 * Re-mounts on every navigation, so each page eases in (fade, rise, de-blur).
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="animate-page-in motion-reduce:animate-none">{children}</div>;
}
