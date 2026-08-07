// Shapes returned by /api/relay/groups. Kept in one module so the dashboard,
// the browse list, and the group detail view agree about them — they are all
// reading the same rows through different endpoints.

export type JoinPolicy = 'invite_only' | 'open';

export interface GroupSummary {
  groupId: string;
  name: string;
  about: string | null;
  picture: string | null;
  joinPolicy: JoinPolicy;
  memberCount: number;
  // Unlocks the metadata form and the invite box. Never surfaced as a role
  // name — the UI shows the affordances, not the label.
  canManage: boolean;
  systemProvisioned: boolean;
}

export interface GroupMemberSummary {
  pubkey: string;
  joinedAt: string;
  screenname: string | null;
  name: string | null;
  isSelf: boolean;
}

export interface PendingInvite {
  id: string;
  groupId: string;
  groupName: string;
  groupAbout: string | null;
  invitedByScreenname: string | null;
  createdAt: string;
  expiresAt: string;
}

// A member whose profile no longer resolves still occupies a roster slot, so
// fall back to a truncated pubkey rather than rendering an empty row.
export function memberLabel(member: GroupMemberSummary): string {
  if (member.screenname) return `@${member.screenname}`;
  if (member.name) return member.name;
  return `${member.pubkey.slice(0, 8)}…${member.pubkey.slice(-4)}`;
}
