'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  BadgeCheck,
  Bookmark,
  BookmarkCheck,
  MapPin,
  Share2,
  ThumbsUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LINK_ICON, LINK_TITLE } from './link-icons';
import { usePanaGate } from './pana-gate';
import {
  distanceInMiles,
  formatDistance,
  type BusinessProfile,
  type Coords,
} from '../_data';

interface ProfileHeroProps {
  profile: BusinessProfile;
  certified: boolean;
  /** Null until the viewer shares their location. */
  viewerCoords: Coords | null;
  onShareLocation: () => void;
}

/**
 * Cover, logo, identity, the two social-proof counts, and the outbound links.
 *
 * The counts are the reason this section is laid out the way it is. "412 panas
 * saved this" is the strongest signal the directory has, and on the current
 * profile page it does not appear at all — so it sits directly under the name,
 * above the fold, rather than in a stats strip further down.
 *
 * Save and Recommend are two different promises and are kept as two separate
 * controls: saving is private and for later, recommending is public and
 * vouches for the business to other panas. Collapsing them into one heart
 * would lose that distinction.
 */
export function ProfileHero({
  profile,
  certified,
  viewerCoords,
  onShareLocation,
}: ProfileHeroProps) {
  // Mock-only optimistic state so the counts respond to a click. The real page
  // would take these from the viewer's own save/recommend rows.
  const [saved, setSaved] = useState(false);
  const [recommended, setRecommended] = useState(false);
  const { requirePana, showsPanaActions } = usePanaGate();

  const savedCount = profile.savedCount + (saved ? 1 : 0);
  const recommendedCount = profile.recommendedCount + (recommended ? 1 : 0);

  return (
    <section className="surface-cream">
      <div className="bizprofile-cover">
        <Image
          src={profile.coverImage}
          alt={profile.coverAlt}
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
      </div>

      {/* `relative` is load-bearing: the cover's image and scrim are absolutely
          positioned, and positioned elements paint above later static content
          no matter the DOM order. Without a positioned context here the
          business name — which sits in the overlap by design — renders
          underneath the photo. */}
      <div className="relative container mx-auto px-4 pb-14 md:pb-20">
        <div className="-mt-16 flex flex-col gap-6 md:-mt-24 md:flex-row md:items-end md:gap-8">
          <div className="bizprofile-logo">
            <Image
              src={profile.logo}
              alt={`${profile.name} logo`}
              width={220}
              height={220}
            />
          </div>

          <div className="flex-1 pb-1">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {certified && profile.certification && (
                <span
                  className="bizprofile-certified"
                  title={profile.certification.blurb}
                >
                  <BadgeCheck className="h-4 w-4" aria-hidden="true" />
                  Pana Certified
                </span>
              )}
              {profile.categories.map((category) => (
                <span key={category} className="tagpill">
                  {category}
                </span>
              ))}
            </div>

            <h1 className="bizprofile-name">{profile.name}</h1>

            <p className="mt-3 text-lg font-bold md:text-xl">
              {profile.tagline}
            </p>

            {/* Distance sits with the location because it answers the same
                question, but it is not dimmed with it: "how far" is the
                sharper signal of the two in a directory people open to find
                something nearby. */}
            <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold">
              <span className="flex items-center gap-1.5 opacity-75">
                <MapPin className="h-4 w-4" aria-hidden="true" />
                {profile.city}, {profile.county} County
              </span>

              <span className="opacity-40" aria-hidden="true">
                &middot;
              </span>

              {viewerCoords ? (
                <span className="bizprofile-distance">
                  {formatDistance(
                    distanceInMiles(viewerCoords, profile.coords)
                  )}
                </span>
              ) : (
                // Most first-time visitors are in this state, so it has to be
                // an offer rather than a blank. The live page would open the
                // browser's location prompt here.
                <button
                  type="button"
                  className="bizprofile-distance-ask"
                  onClick={onShareLocation}
                >
                  How far is this from me?
                </button>
              )}
            </p>
          </div>
        </div>

        {/* Social proof. Saves and recommends are separate figures because they
            answer different questions — "would I go back" versus "would I send
            a friend" — and averaging them into one score loses both. */}
        <div className="mt-10 flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-x-12 gap-y-6">
            <div className="bizprofile-stat">
              <span className="bizprofile-stat-figure">
                {savedCount.toLocaleString()}
              </span>
              <span className="bizprofile-stat-label">Panas saved this</span>
            </div>

            <div className="flex items-center gap-4">
              <div className="bizprofile-stat">
                <span className="bizprofile-stat-figure">
                  {recommendedCount.toLocaleString()}
                </span>
                <span className="bizprofile-stat-label">
                  Panas recommend it
                </span>
              </div>

              {/* A row of faces is read before a number is, so the stack sits
                  beside the figure rather than under a heading of its own. */}
              <div className="bizprofile-avatarstack">
                {profile.recommenderAvatars.map((src) => (
                  <Image
                    key={src}
                    src={src}
                    alt=""
                    width={40}
                    height={40}
                    aria-hidden="true"
                  />
                ))}
              </div>
            </div>
          </div>

          <div>
            <div className="flex flex-wrap gap-3">
              {/* Save and Recommend are absent, not disabled, for a
                  business-only account. See `showsPanaActions`. Share stays:
                  it costs nothing and sends people to the business. */}
              {showsPanaActions && (
                <>
                  <Button
                    size="lg"
                    onClick={() => {
                      if (!requirePana('save')) return;
                      setSaved((value) => !value);
                    }}
                    aria-pressed={saved}
                    className={
                      saved
                        ? 'bg-pana-indigo text-pana-cream hover:bg-pana-indigo/90 rounded-full font-extrabold'
                        : 'bg-pana-flame text-pana-ink hover:bg-pana-burnt rounded-full font-extrabold'
                    }
                  >
                    {saved ? (
                      <BookmarkCheck className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <Bookmark className="h-4 w-4" aria-hidden="true" />
                    )}
                    {saved ? 'Saved' : 'Save'}
                  </Button>

                  <Button
                    size="lg"
                    variant="outline"
                    onClick={() => {
                      if (!requirePana('recommend')) return;
                      setRecommended((value) => !value);
                    }}
                    aria-pressed={recommended}
                    className={
                      recommended
                        ? 'border-pana-indigo bg-pana-indigo text-pana-cream hover:bg-pana-indigo/90 rounded-full border-2 font-extrabold'
                        : 'border-pana-ink/25 text-pana-ink hover:bg-pana-butter-2 rounded-full border-2 bg-white font-extrabold'
                    }
                  >
                    <ThumbsUp className="h-4 w-4" aria-hidden="true" />
                    {recommended ? 'Recommended' : 'Recommend'}
                  </Button>
                </>
              )}

              <Button
                size="lg"
                variant="outline"
                className="border-pana-ink/25 text-pana-ink hover:bg-pana-butter-2 rounded-full border-2 bg-white font-extrabold"
              >
                <Share2 className="h-4 w-4" aria-hidden="true" />
                Share
              </Button>
            </div>

            {/* Hiding the controls with no explanation is how "unavailable"
                gets mistaken for "broken". One quiet line is enough to say
                which account type is missing and where to get one. */}
            {!showsPanaActions && (
              <p className="bizprofile-hero-note">
                Saving and recommending come from a pana account.{' '}
                <Link href="/form/become-a-pana">Add one</Link>
              </p>
            )}
          </div>
        </div>

        {/* Outbound links. On the live profile these are buried under a
            "Socials and Links" card below the fold; the whole point of a
            directory listing is to send people onward, so they belong here. */}
        <div className="mt-10 border-t-2 border-[rgb(17_13_13_/_0.1)] pt-8 dark:border-[hsl(var(--border))]">
          <span className="section-eyebrow mb-4">Find them at</span>
          <div className="flex flex-wrap gap-3">
            {profile.links.map((link) => {
              const Icon = LINK_ICON[link.kind];
              return (
                <a
                  key={`${link.kind}-${link.label}`}
                  href={link.href}
                  className="bizprofile-linkchip"
                  title={LINK_TITLE[link.kind]}
                >
                  <Icon className="h-4 w-4 opacity-70" aria-hidden="true" />
                  <span className="sr-only">{LINK_TITLE[link.kind]}: </span>
                  {link.label}
                </a>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
