'use client';

import { Lock, Users } from 'lucide-react';
import SurfaceLink from '@/components/panaverse/SurfaceLink';
import type { GroupSearchSummary } from '@/lib/query/social';

/** Topic chips shown before the rest are folded into a count. */
const TOPIC_PREVIEW_LIMIT = 3;

/**
 * One group in a list of search results.
 *
 * Shows a privacy marker, which the group card on a member's profile
 * deliberately does not: that list is filtered to public groups only, so a
 * marker there would always say the same thing. Search returns private groups
 * too -- identity fields alone -- so here the distinction is real and a member
 * needs it before clicking, not after.
 *
 * The face pile follows the same split. A public group shows a few member
 * avatars because a wall of faces is what tells a stranger this is a living
 * group rather than an empty listing, and a bare number never carries that.
 * A private group shows none: its roster is not public, and avatar URLs are
 * roster. The server decides that in SQL, so `faces` is simply empty here and
 * this component has no privacy rule of its own to get wrong.
 */
export function GroupResultCard({ group }: { group: GroupSearchSummary }) {
  const topics = Object.keys(group.topics ?? {}).filter(
    (topic) => group.topics[topic]
  );
  const shown = topics.slice(0, TOPIC_PREVIEW_LIMIT);
  const remaining = topics.length - shown.length;

  const isPrivate = group.visibility === 'private';
  const faces = group.faces ?? [];

  return (
    <SurfaceLink
      href={`/g/${group.handle}`}
      className="border-pana-ink/10 hover:border-pana-ink/25 flex items-start gap-3 rounded-2xl border bg-white p-4 transition-colors"
    >
      {/* Plain img: these are remote CDN URLs and next.config.js declares no
          remotePatterns, so the optimizer would reject them at runtime. */}
      <img
        src={group.iconUrl || '/img/bg_coconut_blue.jpg'}
        alt=""
        aria-hidden="true"
        className="h-12 w-12 shrink-0 rounded-xl object-cover"
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-pana-ink truncate text-[15px] font-extrabold">
            {group.name || group.handle}
          </span>
          {isPrivate && (
            <span
              className="text-pana-ink/45 inline-flex shrink-0 items-center gap-1 text-[11px] font-extrabold tracking-wide uppercase"
              /* The icon is decorative; this carries the meaning for anyone
                 not seeing it. */
              title="Private group"
            >
              <Lock className="h-3 w-3" aria-hidden="true" />
              Private
            </span>
          )}
        </div>

        {group.summary && (
          <p className="text-pana-ink/65 mt-0.5 line-clamp-2 text-[13px] leading-snug font-medium">
            {group.summary}
          </p>
        )}

        <div className="text-pana-ink/55 mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] font-bold">
          {/* Faces, never names. Decorative by design -- no alt text, no
              link, nothing to click through to -- so the crowd reads as real
              without becoming a list of who to go find. Matches what the
              listing and event cards already do.

              Empty for private groups; the server withholds the URLs rather
              than trusting this component to skip them. */}
          {faces.length > 0 && (
            <span className="inline-flex shrink-0" aria-hidden="true">
              {faces.map((face, index) => (
                <img
                  key={`${face}-${index}`}
                  src={face}
                  alt=""
                  className="bg-pana-butter -ml-[0.55rem] h-[26px] w-[26px] rounded-full border-2 border-white object-cover first:ml-0"
                />
              ))}
            </span>
          )}

          <span className="inline-flex items-center gap-1">
            <Users className="h-3.5 w-3.5" aria-hidden="true" />
            {group.memberCount}
            {group.memberCount === 1 ? ' member' : ' members'}
          </span>

          {shown.map((topic) => (
            <span
              key={topic}
              className="bg-pana-ink/6 text-pana-ink/70 rounded-full px-2 py-0.5"
            >
              {topic}
            </span>
          ))}
          {remaining > 0 && <span>+{remaining} more</span>}
        </div>
      </div>
    </SurfaceLink>
  );
}
