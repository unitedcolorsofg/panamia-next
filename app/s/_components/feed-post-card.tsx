'use client';

import { useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { ChevronDown, ChevronUp, Eye, MapPin } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AttachmentGrid } from '@/components/social/AttachmentGrid';
import { PostActions } from '@/components/social/PostActions';
import {
  CCBadge,
  type CCLicenseValue,
} from '@/components/legal/CCLicensePicker';
import { getVisibilityFromRecipients } from '@/lib/utils/getVisibility';
import type { SocialStatusDisplay } from '@/lib/interfaces';

const PostComposer = dynamic(
  () =>
    import('@/components/social/PostComposer').then((m) => ({
      default: m.PostComposer,
    })),
  { ssr: false }
);

/* One status in the timeline, wearing the design from /mock/feed.
 *
 * This is the mock's card over real data, and the split between the two is
 * deliberate: the *layout* is ported, the *behaviour* is not reimplemented.
 * Attachments go through the existing AttachmentGrid and the action row
 * through the existing PostActions, because both already work — AttachmentGrid
 * routes an attachment carrying `peaks` to WaveformPlayer, and PostActions
 * holds the real like mutation with its optimistic update. Rebuilding either
 * to match the mock's markup would have traded working voice memos and working
 * likes for a closer pixel match, which is the wrong way round.
 *
 * Several things in the mock have no data behind them and are therefore absent
 * rather than faked: the county badge (an actor has no county), boosts
 * (`announcesCount`/`boostedBy` — there is no boost feature), the top-reply
 * preview, and link unfurls. Each would have needed an invented value to
 * render, and a feed that invents numbers is worse than one that omits them.
 */
export function FeedPostCard({ status }: { status: SocialStatusDisplay }) {
  const [cwOpen, setCwOpen] = useState(false);
  const [replyOpen, setReplyOpen] = useState(false);

  const hasCW = Boolean(status.contentWarning?.trim());

  /* The warning hides the body *and* the media. Revealing the text while
     leaving a photograph on screen would defeat the point of the warning. */
  const bodyHidden = hasCW && !cwOpen;

  const displayName = status.actor.name || status.actor.username;
  const published = status.published ? new Date(status.published) : null;

  const initials = status.actor.name
    ? status.actor.name
        .split(' ')
        .map((part) => part[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : status.actor.username.slice(0, 2).toUpperCase();

  const visibility = getVisibilityFromRecipients(
    status.recipientTo,
    status.recipientCc
  );
  const showLicense = Boolean(status.ccLicense) && visibility !== 'private';

  return (
    <article className="profile-card p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <Link
          href={`/p/${status.actor.username}`}
          className="flex-none"
          aria-label={`${displayName}'s profile`}
        >
          <Avatar className="border-pana-ink/10 h-11 w-11 border-2">
            <AvatarImage src={status.actor.iconUrl || undefined} alt="" />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
        </Link>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm leading-tight">
            <Link
              href={`/p/${status.actor.username}`}
              className="truncate font-extrabold hover:underline"
            >
              {displayName}
            </Link>
            <Link
              href={`/p/${status.actor.username}`}
              className="text-pana-ink/45 truncate font-bold hover:underline"
            >
              @{status.actor.username}
            </Link>
            {published && (
              <>
                <span aria-hidden="true" className="text-pana-ink/30">
                  ·
                </span>
                <Link
                  href={`/p/${status.actor.username}/${status.id}`}
                  className="text-pana-ink/45 flex-none font-bold hover:underline"
                >
                  <time dateTime={published.toISOString()}>
                    {formatDistanceToNow(published, { addSuffix: true })}
                  </time>
                </Link>
              </>
            )}
          </div>

          {status.inReplyTo && (
            <p className="feed-context mt-1.5">
              Replying to{' '}
              <Link
                href={`/p/${status.inReplyTo.actorUsername}`}
                className="text-pana-indigo hover:underline"
              >
                @{status.inReplyTo.actorUsername}
              </Link>
            </p>
          )}

          {hasCW && (
            <button
              type="button"
              className="cw-toggle mt-2.5"
              onClick={() => setCwOpen((open) => !open)}
              aria-expanded={cwOpen}
            >
              <span className="inline-flex items-center gap-2">
                <Eye className="h-4 w-4 flex-none" aria-hidden="true" />
                {status.contentWarning}
              </span>
              {cwOpen ? (
                <ChevronUp className="h-4 w-4 flex-none" aria-hidden="true" />
              ) : (
                <ChevronDown className="h-4 w-4 flex-none" aria-hidden="true" />
              )}
            </button>
          )}

          {!bodyHidden && (
            <>
              {/* Server-sanitised ActivityPub content, rendered the same way
                  the previous card rendered it. */}
              <div
                className="prose prose-sm dark:prose-invert mt-2 max-w-none text-[15px] leading-relaxed font-medium break-words"
                dangerouslySetInnerHTML={{ __html: status.content }}
              />

              {status.attachments && status.attachments.length > 0 && (
                <AttachmentGrid attachments={status.attachments} />
              )}
            </>
          )}

          {/* Location and licence are metadata rather than content, so they
              stay visible behind a warning — neither reveals what it covers. */}
          {(status.location || showLicense) && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {status.location && (
                <a
                  href={
                    status.location.latitude && status.location.longitude
                      ? `https://www.google.com/maps/search/?api=1&query=${status.location.latitude},${status.location.longitude}`
                      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(status.location.name || '')}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="identity-pill text-pana-ink/65 text-[11px]"
                >
                  <MapPin className="h-3 w-3" aria-hidden="true" />
                  {status.location.name ||
                    `${status.location.latitude?.toFixed(4)}, ${status.location.longitude?.toFixed(4)}`}
                  {status.location.precision === 'general' && ' (approx)'}
                </a>
              )}
              {showLicense && (
                <CCBadge license={status.ccLicense as CCLicenseValue} />
              )}
            </div>
          )}

          <div className="mt-3.5">
            <PostActions
              statusId={status.id}
              actorUsername={status.actor.username}
              liked={status.liked}
              likesCount={status.likesCount}
              repliesCount={status.repliesCount}
              onReply={() => setReplyOpen((open) => !open)}
              showReplyButton
            />
          </div>

          {replyOpen && (
            <div className="border-pana-ink/10 mt-3.5 border-l-2 pl-3">
              <PostComposer
                inReplyTo={status.id}
                replyVisibility={visibility}
                onSuccess={() => setReplyOpen(false)}
                placeholder={`Reply to @${status.actor.username}...`}
              />
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
