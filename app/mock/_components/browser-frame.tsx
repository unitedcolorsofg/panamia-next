import { Lock } from 'lucide-react';

/* A browser window drawn around a mock. Not decoration: the switcher's whole
   job is to survive an origin change, so the address bar is part of the thing
   being reviewed.

   Used by /mock/panaverse, where surfaces are compared side by side and the
   hostname changing is the point. Deliberately NOT used by /mock/feed — there
   the goal is to stop the feed reading as a page of the main site, and a
   bordered rectangle sitting on a cream page is exactly the framing that keeps
   it reading that way. */
export function BrowserFrame({
  hostname,
  path,
  children,
}: {
  hostname: string;
  path: string;
  children: React.ReactNode;
}) {
  return (
    <div className="browser-frame mt-8">
      <div className="browser-bar">
        <span className="browser-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className="browser-url">
          <Lock className="h-3 w-3 flex-none" aria-hidden="true" />
          <span className="truncate">
            <strong>{hostname}</strong>
            <span className="text-pana-ink/40">{path === '/' ? '' : path}</span>
          </span>
        </span>
      </div>
      <div className="browser-viewport">{children}</div>
    </div>
  );
}
