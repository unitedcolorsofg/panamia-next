'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, BadgeCheck } from 'lucide-react';
import ScrollReveal from '@/components/scroll-reveal';
import { MockControls, type MockState } from './_components/mock-controls';
import { PanaGateProvider } from './_components/pana-gate';
import { ProfileHero } from './_components/profile-hero';
import { ProfileAbout } from './_components/profile-about';
import { ProfileGallery } from './_components/profile-gallery';
import { ProfileEvents } from './_components/profile-events';
import {
  ProfileClaimPrompt,
  ProfileUpdates,
} from './_components/profile-updates';
import { businessProfileMock } from './_data';

/**
 * Design mock for the directory's business profile page.
 *
 * Route: /mock/business-profile
 *
 * This is a throwaway route for reviewing the redesign of `/p/[user]`, which
 * today renders a stack of undifferentiated shadcn cards. It reads from the
 * fixture in `_data.ts` and touches nothing else — no queries, no session, no
 * mutations — so it can be iterated on without any of the real page's
 * constraints.
 *
 * Section order follows what a visitor arriving from a search result actually
 * needs, in order: who is this and do other panas vouch for them (hero), what
 * are they (about), what does it look like (photos), where can I find them
 * (events), and what are they saying (updates). Everything the brief asks for
 * has a home in that sequence rather than a card of its own.
 *
 * When the design is signed off, the sections move to
 * `app/p/[user]/_components/` against real data and `app/mock/` is deleted.
 */
export default function BusinessProfileMockPage() {
  const [state, setState] = useState<MockState>({
    certified: true,
    claimed: true,
    owner: false,
    // Defaults to signed out because that is what most directory traffic is,
    // and it is the state the signup gate exists for.
    viewer: 'anon',
  });

  const profile = useMemo(
    () => ({
      ...businessProfileMock,
      certification: state.certified ? businessProfileMock.certification : null,
      claim: state.claimed ? businessProfileMock.claim : null,
      // An unclaimed listing has nobody to post as, so the updates go with it.
      updates: state.claimed ? businessProfileMock.updates : [],
    }),
    [state.certified, state.claimed]
  );

  // Owner tools require a claim — you cannot own a listing nobody has claimed.
  const isOwner = state.claimed && state.owner;

  return (
    <PanaGateProvider
      viewer={state.viewer}
      businessName={profile.name}
      businessLogo={profile.logo}
    >
      <MockControls state={state} onChange={setState} />

      <main>
        <ProfileHero profile={profile} certified={state.certified} />

        {/* The badge in the hero is a claim the visitor has no way to evaluate
            on its own, so the page says once, plainly, what it means and who
            decides. Without this it reads as self-applied marketing. */}
        {state.certified && profile.certification && (
          <section className="surface-butter py-10">
            <div className="container mx-auto flex flex-col items-start gap-4 px-4 md:flex-row md:items-center md:gap-8">
              <BadgeCheck
                className="text-pana-indigo h-10 w-10 shrink-0"
                aria-hidden="true"
              />
              <p className="flex-1 text-[15.5px] leading-relaxed font-bold">
                <span className="text-pana-indigo">Pana Certified.</span>{' '}
                {profile.certification.blurb} Certified since{' '}
                {profile.certification.certifiedOn}.
              </p>
              <Link href="/about-us" className="link-arrow shrink-0 text-sm">
                How certification works
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </section>
        )}

        <section className="surface-butter-2 py-16 md:py-24">
          <div className="container mx-auto px-4">
            <ProfileAbout profile={profile} />
            <ProfileGallery profile={profile} isOwner={isOwner} />
          </div>
        </section>

        <ProfileEvents profile={profile} />

        {state.claimed ? (
          <ProfileUpdates profile={profile} />
        ) : (
          <ProfileClaimPrompt profile={profile} />
        )}

        <section className="surface-citrus py-16 md:py-20">
          <div className="container mx-auto px-4 text-center" data-rv>
            <h2 className="bizprofile-h2">More panas near you</h2>
            <p className="section-lede mx-auto mt-4">
              {profile.categories[0]} in {profile.county} County, and everything
              else the directory holds.
            </p>
            <Link
              href="/directory/search"
              className="link-arrow mt-8 inline-flex"
            >
              Back to the directory
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </section>
      </main>

      <ScrollReveal />
    </PanaGateProvider>
  );
}
