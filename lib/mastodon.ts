/**
 * Mastodon API Utilities
 *
 * Fetches comments from Mastodon posts using the public API.
 * No authentication required for public posts.
 *
 * UPSTREAM REFERENCE: https://docs.joinmastodon.org/methods/statuses/
 */

export interface MastodonAccount {
  id: string;
  username: string;
  acct: string; // username@instance or just username if local
  display_name: string;
  avatar: string;
  url: string;
}

export interface MastodonStatus {
  id: string;
  created_at: string;
  content: string; // HTML content
  account: MastodonAccount;
  url: string;
  in_reply_to_id: string | null;
  replies_count: number;
  reblogs_count: number;
  favourites_count: number;
  sensitive: boolean;
  spoiler_text: string;
}

export interface MastodonContext {
  ancestors: MastodonStatus[];
  descendants: MastodonStatus[];
}

export interface ParsedPostUrl {
  instance: string;
  statusId: string;
}

export interface MastodonComment {
  id: string;
  author: {
    username: string;
    displayName: string;
    avatar: string;
    url: string;
    instance: string;
  };
  content: string; // HTML
  createdAt: string;
  url: string;
  repliesCount: number;
  inReplyToId: string | null;
}

/**
 * Parse a Mastodon post URL to extract instance and status ID
 *
 * Supports formats:
 * - https://mastodon.social/@user/123456789
 * - https://mastodon.social/users/user/statuses/123456789
 * - https://instance.tld/@user/123456789
 */
export function parseMastodonUrl(url: string): ParsedPostUrl | null {
  try {
    const parsed = new URL(url);
    const instance = parsed.hostname;

    // Format: /@user/123456789
    const atMatch = parsed.pathname.match(/^\/@[^/]+\/(\d+)$/);
    if (atMatch) {
      return { instance, statusId: atMatch[1] };
    }

    // Format: /users/user/statuses/123456789
    const usersMatch = parsed.pathname.match(
      /^\/users\/[^/]+\/statuses\/(\d+)$/
    );
    if (usersMatch) {
      return { instance, statusId: usersMatch[1] };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Validate a Mastodon post URL format
 */
export function isValidMastodonUrl(url: string): boolean {
  return parseMastodonUrl(url) !== null;
}

/**
 * Fetch the context (ancestors and descendants) of a Mastodon status
 * Uses the public API - no authentication required for public posts
 */
export async function fetchMastodonContext(
  instance: string,
  statusId: string
): Promise<MastodonContext | null> {
  try {
    const response = await fetch(
      `https://${instance}/api/v1/statuses/${statusId}/context`,
      {
        headers: {
          Accept: 'application/json',
        },
        // Cache for 5 minutes
        next: { revalidate: 300 },
      }
    );

    if (!response.ok) {
      console.error(
        `Mastodon API error: ${response.status} ${response.statusText}`
      );
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Failed to fetch Mastodon context:', error);
    return null;
  }
}

/**
 * Fetch the original status to verify it exists and is public
 */
export async function fetchMastodonStatus(
  instance: string,
  statusId: string
): Promise<MastodonStatus | null> {
  try {
    const response = await fetch(
      `https://${instance}/api/v1/statuses/${statusId}`,
      {
        headers: {
          Accept: 'application/json',
        },
        next: { revalidate: 300 },
      }
    );

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Failed to fetch Mastodon status:', error);
    return null;
  }
}

/**
 * Extract instance from a Mastodon account's acct field
 */
function getInstanceFromAcct(acct: string, defaultInstance: string): string {
  if (acct.includes('@')) {
    return acct.split('@')[1];
  }
  return defaultInstance;
}

/**
 * Transform Mastodon statuses into a simpler comment format
 */
export function transformToComments(
  descendants: MastodonStatus[],
  sourceInstance: string
): MastodonComment[] {
  return descendants.map((status) => ({
    id: status.id,
    author: {
      username: status.account.username,
      displayName: status.account.display_name || status.account.username,
      avatar: status.account.avatar,
      url: status.account.url,
      instance: getInstanceFromAcct(status.account.acct, sourceInstance),
    },
    content: status.content,
    createdAt: status.created_at,
    url: status.url,
    repliesCount: status.replies_count,
    inReplyToId: status.in_reply_to_id,
  }));
}

/**
 * Fetch comments for an article from Mastodon
 * Main entry point for the comments feature
 */
export async function fetchArticleComments(
  postUrl: string
): Promise<{ comments: MastodonComment[]; postUrl: string } | null> {
  const parsed = parseMastodonUrl(postUrl);
  if (!parsed) {
    console.error('Invalid Mastodon URL:', postUrl);
    return null;
  }

  const context = await fetchMastodonContext(parsed.instance, parsed.statusId);
  if (!context) {
    return null;
  }

  const comments = transformToComments(context.descendants, parsed.instance);

  return {
    comments,
    postUrl,
  };
}
