import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  Heart,
  MessageCircle,
  Repeat2,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatRelativeDays, type BusinessProfile } from '../_data';

interface ProfileUpdatesProps {
  profile: BusinessProfile;
}

/**
 * Updates the business posts on Pana Social.
 *
 * This section is the reward for claiming a listing, and it only exists when a
 * personal Pana account has done so — an unclaimed listing has no author, so
 * there is nothing to show and the section is replaced by the claim prompt
 * below.
 *
 * It runs on indigo because it is the one part of the page the business writes
 * itself rather than the directory describing them. The colour change is doing
 * the work an "Updates" label alone would not: you can tell at a glance that
 * the voice has switched.
 */
export function ProfileUpdates({ profile }: ProfileUpdatesProps) {
  const claim = profile.claim;
  if (!claim) return null;

  return (
    <section className="surface-indigo py-16 md:py-24">
      <div className="container mx-auto px-4" data-rv>
        <div className="mb-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <span className="section-eyebrow text-pana-butter">
              From the business
            </span>
            <h2 className="bizprofile-h2 mt-4">Updates</h2>

            {/* Who is writing. Without this the posts read as directory copy,
                and the whole point is that they are not. */}
            <div className="mt-6 flex items-center gap-3">
              <Image
                src={claim.avatar}
                alt=""
                width={40}
                height={40}
                className="h-10 w-10 rounded-full object-cover"
                aria-hidden="true"
              />
              <p className="text-sm font-semibold text-white/85">
                Posted by{' '}
                <Link
                  href={`/p/${claim.screenname}`}
                  className="text-pana-butter font-extrabold hover:underline"
                >
                  {claim.displayName}
                </Link>
                , who claimed this listing in {claim.claimedOn}.
              </p>
            </div>
          </div>

          <Link
            href={`/p/${claim.screenname}`}
            className="link-arrow text-pana-butter shrink-0"
          >
            See all posts
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        <ul className="grid gap-5 lg:grid-cols-3">
          {profile.updates.map((update) => (
            <li key={update.id} className="bizprofile-update flex flex-col">
              <div className="mb-4 flex items-center gap-2 text-xs font-extrabold tracking-wider text-white/60 uppercase">
                <span>@{claim.screenname}</span>
                <span aria-hidden="true">·</span>
                <span>{formatRelativeDays(update.agoDays)}</span>
              </div>

              <p className="text-[15.5px] leading-relaxed font-medium text-white/90">
                {update.body}
              </p>

              {update.image && (
                <div className="media-frame mt-5 aspect-[16/10]">
                  <Image
                    src={update.image}
                    alt={update.imageAlt ?? ''}
                    fill
                    sizes="(min-width: 1024px) 33vw, 100vw"
                    className="object-cover"
                  />
                </div>
              )}

              <div className="mt-auto flex items-center gap-5 pt-6">
                <span className="bizprofile-update-action">
                  <Heart className="h-4 w-4" aria-hidden="true" />
                  {update.likes}
                </span>
                <span className="bizprofile-update-action">
                  <MessageCircle className="h-4 w-4" aria-hidden="true" />
                  {update.replies}
                </span>
                <span className="bizprofile-update-action">
                  <Repeat2 className="h-4 w-4" aria-hidden="true" />
                  {update.boosts}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/**
 * What an unclaimed listing shows in place of the updates feed.
 *
 * Kept on the same indigo surface so the page's rhythm does not change
 * depending on claim status — the slot is always there, it just holds an
 * invitation instead of posts. This is also the only honest place to say
 * "nobody from this business is answering here yet", which a visitor deciding
 * whether to message them deserves to know.
 */
export function ProfileClaimPrompt({ profile }: ProfileUpdatesProps) {
  return (
    <section className="surface-indigo py-16 md:py-24">
      <div className="container mx-auto px-4" data-rv>
        <div className="mx-auto max-w-2xl text-center">
          <span className="section-eyebrow text-pana-butter justify-center">
            Unclaimed listing
          </span>
          <h2 className="bizprofile-h2 mt-4">Is this your business?</h2>
          <p className="section-lede mx-auto mt-5 text-white/85">
            {profile.name} is listed in the directory but no pana has claimed it
            yet. Claim it to post updates, add photos, list your events, and
            reply to the {profile.recommendedCount} panas who recommend you.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Button
              size="lg"
              asChild
              className="bg-pana-flame text-pana-ink hover:bg-pana-burnt rounded-full font-extrabold"
            >
              <Link href="/form/become-a-pana">
                <UserCheck className="h-4 w-4" aria-hidden="true" />
                Claim this listing
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              asChild
              className="text-pana-cream hover:text-pana-ink hover:bg-pana-cream rounded-full border-2 border-white/40 bg-transparent font-extrabold"
            >
              <Link href="/contact-us">Report a problem</Link>
            </Button>
          </div>

          <p className="mt-8 flex items-center justify-center gap-2 text-xs font-bold tracking-wider text-white/55 uppercase">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            Claims are reviewed by Pana Mia before they go live
          </p>
        </div>
      </div>
    </section>
  );
}
