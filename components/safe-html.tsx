/**
 * The only sanctioned way to render user-authored or federated HTML.
 *
 * Post bodies arrive as HTML from the local composer, the ActivityPub inbox
 * and the Mastodon API, and none of those are trustworthy. Routing every
 * render site through this component means a sink cannot be added that quietly
 * forgets to sanitise: the sanitiser is part of rendering rather than
 * something a caller has to remember.
 *
 * Reach for `dangerouslySetInnerHTML` directly only for HTML this repo builds
 * itself from non-user data, and say why at the call site.
 *
 * @see lib/sanitize-html.ts — the allowlist this applies
 */

import { sanitizeStatusHtml } from '@/lib/sanitize-html';

interface SafeHtmlProps {
  /** Untrusted HTML — a status body, federated content, a remote comment. */
  html: string | null | undefined;
  className?: string;
}

export function SafeHtml({ html, className }: SafeHtmlProps) {
  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: sanitizeStatusHtml(html) }}
    />
  );
}
