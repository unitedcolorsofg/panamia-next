/**
 * Markdown rendering for locally-composed status bodies.
 *
 * Lives on a dedicated `Marked` instance rather than the shared `marked`
 * singleton: `marked.use()` mutates global state, so configuring it from a
 * module that happens to be imported first would silently change rendering for
 * every other caller in the app.
 *
 * Nothing here is a substitute for lib/sanitize-html.ts. Statuses already in
 * the database were written before these hooks existed, and federated content
 * never passes through markdown at all, so the render-time sanitiser remains
 * the control that actually makes a body safe. This is defence in depth for
 * new local posts: it keeps hostile markup from being written in the first
 * place.
 */

import { Marked } from 'marked';
import { escapeHtml, isSafeUrl } from '@/lib/sanitize-html';

const renderer = new Marked();

renderer.use({
  renderer: {
    /**
     * marked emits raw HTML verbatim by default, so a post containing
     * `<script>` would be stored as a live script tag. Escaping here stores
     * the literal text the author typed instead. This hook sees block-level
     * HTML and inline tags alike.
     */
    html({ text }) {
      return escapeHtml(text);
    },

    /**
     * Links get `rel`/`target` forced, which is why the renderer is overridden
     * at all. The catch is that overriding it also discards marked's own
     * scheme check, which would re-admit `[text](javascript:...)` as a live
     * link — so that check has to be reapplied by hand.
     */
    link({ href, title, text }) {
      // `text` and `title` arrive already escaped by marked's tokenizer;
      // escaping them again here would double-encode.
      if (!isSafeUrl(href)) return text;
      const titleAttr = title ? ` title="${title}"` : '';
      const safeHref = href.replace(/"/g, '&quot;');
      return `<a href="${safeHref}"${titleAttr} rel="noopener noreferrer ugc" target="_blank">${text}</a>`;
    },
  },
});

/** Render a locally-composed markdown body to HTML for storage. */
export async function renderStatusMarkdown(content: string): Promise<string> {
  return (await renderer.parse(content, { gfm: true })).trim();
}
