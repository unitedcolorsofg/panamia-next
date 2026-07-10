// Human-readable names for Nostr event kinds, so abuse-report UIs and emails
// can show "Long-form Article (kind 30023)" instead of bare numeric jargon.
//
// Curated for the kinds this relay actually carries / is likely to see in a
// report subject. Unknown kinds fall back to a range-based label or "kind N".
// Pure + dependency-free so it is safe to import from both client and server.

const KIND_NAMES: Record<number, string> = {
  0: 'Profile Metadata',
  1: 'Short Text Note',
  2: 'Recommend Relay',
  3: 'Contacts / Follow List',
  4: 'Encrypted Direct Message',
  5: 'Event Deletion',
  6: 'Repost',
  7: 'Reaction',
  8: 'Badge Award',
  9: 'Group Chat Message',
  10: 'Group Chat Reply',
  11: 'Thread',
  12: 'Thread Reply',
  13: 'Seal',
  14: 'Direct Message',
  16: 'Generic Repost',
  40: 'Channel Creation',
  41: 'Channel Metadata',
  42: 'Channel Message',
  43: 'Channel Hide Message',
  44: 'Channel Mute User',
  1059: 'Gift Wrap',
  1063: 'File Metadata',
  1311: 'Live Chat Message',
  1984: 'Report',
  1985: 'Label',
  9734: 'Zap Request',
  9735: 'Zap Receipt',
  9802: 'Highlight',
  10000: 'Mute List',
  10002: 'Relay List Metadata',
  10050: 'DM Relay List',
  30000: 'Follow Set',
  30008: 'Profile Badges',
  30009: 'Badge Definition',
  30023: 'Long-form Article',
  30024: 'Long-form Draft',
  30311: 'Live Event',
  30402: 'Classified Listing',
  31922: 'Date-Based Calendar Event',
  31923: 'Time-Based Calendar Event',
  34550: 'Community Definition',
  39000: 'Group Metadata',
};

function rangeLabel(kind: number): string | null {
  if (kind >= 1000 && kind <= 9999) return 'Regular Event';
  if (kind >= 10000 && kind <= 19999) return 'Replaceable Event';
  if (kind >= 20000 && kind <= 29999) return 'Ephemeral Event';
  if (kind >= 30000 && kind <= 39999) return 'Addressable Event';
  return null;
}

/**
 * Returns a human-readable label for a Nostr kind, always including the number
 * for precision, e.g. "Long-form Article (kind 30023)" or "kind 27235".
 */
export function kindName(kind: number | null | undefined): string {
  if (kind == null || !Number.isFinite(kind)) return 'unknown kind';
  const known = KIND_NAMES[kind];
  if (known) return `${known} (kind ${kind})`;
  const range = rangeLabel(kind);
  return range ? `${range} (kind ${kind})` : `kind ${kind}`;
}
