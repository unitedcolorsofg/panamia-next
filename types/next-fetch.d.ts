// Augment fetch's RequestInit to support Next.js ISR options.
// Used in lib/mastodon.ts and similar files that pass `next: { revalidate }`.
interface RequestInit {
  next?: {
    revalidate?: number | false;
    tags?: string[];
  };
}
