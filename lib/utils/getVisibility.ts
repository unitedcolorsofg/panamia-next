/**
 * Derive ActivityPub visibility from recipientTo / recipientCc arrays.
 *
 * Maps the same way Mastodon does:
 *  - `to` contains Public         -> 'public'
 *  - `cc` contains Public          -> 'unlisted'
 *  - has followers URL (no Public) -> 'private'
 *  - else                          -> 'direct'
 *
 * We only use 'public' | 'unlisted' | 'private' in the UI (direct is deferred).
 */

const PUBLIC = 'https://www.w3.org/ns/activitystreams#Public';

export type PostVisibility = 'public' | 'unlisted' | 'private';

export function getVisibilityFromRecipients(
  recipientTo: unknown,
  recipientCc: unknown
): PostVisibility {
  const to = Array.isArray(recipientTo) ? (recipientTo as string[]) : [];
  const cc = Array.isArray(recipientCc) ? (recipientCc as string[]) : [];

  if (to.includes(PUBLIC)) return 'public';
  if (cc.includes(PUBLIC)) return 'unlisted';
  return 'private';
}
