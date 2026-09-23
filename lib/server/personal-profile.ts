/**
 * Shaping a profile row into the personal (Pana Social) profile view.
 *
 * Kept separate from getPublicProfile because this is presentation, not
 * retrieval: it decides which stored columns a person's public page is allowed
 * to surface and what they read as. The directory listing answers that
 * question differently for the same table, which is the whole reason the two
 * designs are separate.
 */

import { countyLabel } from '@/lib/county';
import type { LegacyProfile } from '@/lib/server/profile';
import { getActorByScreenname } from '@/lib/federation';

export interface PersonalProfileView {
  name: string;
  handle: string;
  pronouns: string | null;
  fiveWords: string | null;
  bio: string | null;
  avatar: string | null;
  cover: string | null;
  /** Canonical county label, or null when none is recorded. */
  county: string | null;
  /**
   * Whether residency has actually been verified. Sourced from
   * profiles.verified_zip_code, which comes from billing data rather than user
   * input — which is exactly why the check mark in the UI sits on the county
   * and never on the self-declared neighborhoods.
   */
  verified: boolean;
  neighborhoods: string[];
  tags: string[];
  joined: string | null;
}

/**
 * Neighborhood keys have no shared label constant yet — the become-a-pana
 * rebuild notes call for lib/constants/neighborhoods.ts and it does not exist,
 * so nothing writes this column today. Rather than block on that, keys are
 * humanised: an already-readable value passes through unchanged, and a snake
 * case key becomes words. When the constant lands this should defer to it.
 */
function neighborhoodLabels(neighborhoods: unknown): string[] {
  if (!Array.isArray(neighborhoods)) return [];

  return neighborhoods
    .filter((value): value is string => typeof value === 'string')
    .map((value) =>
      value
        .replace(/[_-]+/g, ' ')
        .trim()
        .replace(/\b\w/g, (c) => c.toUpperCase())
    )
    .filter(Boolean);
}

/** descriptions.tags is stored as one comma-separated string. */
function tagList(tags: unknown): string[] {
  if (typeof tags !== 'string') return [];

  return tags
    .split(',')
    .map((tag) => tag.trim().replace(/^#/, ''))
    .filter(Boolean);
}

function joinedLabel(createdAt: unknown): string | null {
  if (!(createdAt instanceof Date) && typeof createdAt !== 'string') {
    return null;
  }

  const date = createdAt instanceof Date ? createdAt : new Date(createdAt);
  if (Number.isNaN(date.getTime())) return null;

  return `Joined ${date.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })}`;
}

export async function buildPersonalProfileView(
  handle: string,
  profile: LegacyProfile
): Promise<PersonalProfileView> {
  // The cover lives on the social actor, not the profile, because it is a
  // Pana Social concept. Absent for accounts that never enrolled, which the
  // hero handles by falling back to a flat band.
  const actor = await getActorByScreenname(handle);

  return {
    name: profile.name ?? handle,
    handle,
    pronouns: (profile.pronouns as string | null) ?? null,
    fiveWords: profile.five_words ?? null,
    bio: profile.details ?? null,
    avatar: profile.images?.primaryCDN ?? null,
    cover: actor?.headerUrl ?? null,
    county: countyLabel(profile.counties),
    verified: Boolean(profile.verifiedZipCode),
    neighborhoods: neighborhoodLabels(profile.neighborhoods),
    tags: tagList(profile.tags),
    joined: joinedLabel(profile.createdAt),
  };
}
