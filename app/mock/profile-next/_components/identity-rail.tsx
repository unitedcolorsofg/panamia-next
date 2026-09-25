import Image from 'next/image';
import Link from 'next/link';
import {
  BadgeCheck,
  CalendarDays,
  MapPin,
  MessageCircle,
  Share2,
  UserPlus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  MOCK_FOLLOWERS_ONLY_COUNT,
  MOCK_PANAS,
  MOCK_PROFILE,
} from '../../profile/_data/mock-profile';

/* The identity column.
 *
 * Everything a visitor needs to answer "who is this" sits here and stops
 * moving. The old layout spent the top third of the screen on that question
 * and pushed the answer to "what have they been up to" below the fold; here
 * the two run side by side, so scrolling the work never costs you the person.
 *
 * The cover survives — people put real care into choosing one — but as a strip
 * inside this card rather than a billboard across the viewport. It is scenery
 * for the identity, not a header for the page.
 */
export function IdentityRail() {
  const profile = MOCK_PROFILE;

  return (
    <aside className="space-y-5 lg:sticky lg:top-[5.25rem]">
      <section className="profile-card overflow-hidden">
        <div className="relative h-24">
          <Image
            src={profile.cover}
            alt={profile.coverAlt}
            fill
            sizes="20rem"
            className="object-cover"
          />
          <div
            className="absolute inset-0 bg-gradient-to-t from-black/25 to-transparent"
            aria-hidden="true"
          />
        </div>

        <div className="p-4">
          <div className="relative -mt-13 h-20 w-20 overflow-hidden rounded-full border-4 border-white">
            <Image
              src={profile.avatar}
              alt={`${profile.name}'s profile picture`}
              fill
              sizes="80px"
              className="object-cover"
            />
          </div>

          <h1 className="mt-3 text-xl leading-tight font-black tracking-tight">
            {profile.name}
          </h1>
          <p className="text-pana-burnt text-sm font-extrabold">
            @{profile.handle}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {/* The check sits on the county because that is the only part
                that is actually verified — residency comes from billing data.
                Neighborhoods below are self-declared and carry no check. */}
            {profile.verified ? (
              <span className="identity-pill" data-tone="verified">
                <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
                {profile.county}
              </span>
            ) : (
              <span className="identity-pill">{profile.county}</span>
            )}
            <span className="identity-pill">{profile.pronouns}</span>
          </div>

          <p className="text-pana-indigo mt-3 text-[11px] font-extrabold tracking-widest uppercase">
            {profile.fiveWords}
          </p>

          <p className="text-pana-ink/80 mt-2 text-[13px] leading-relaxed font-medium">
            {profile.bio}
          </p>

          <div className="text-pana-ink/55 mt-3 space-y-1.5 text-[12px] font-bold">
            <p className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 flex-none" aria-hidden="true" />
              {profile.neighborhoods.join(' · ')}
            </p>
            <p className="flex items-center gap-1.5">
              <CalendarDays
                className="h-3.5 w-3.5 flex-none"
                aria-hidden="true"
              />
              {profile.joined}
            </p>
          </div>

          <ul className="mt-3 flex flex-wrap gap-1.5">
            {profile.tags.map((tag) => (
              <li key={tag}>
                <span className="identity-pill text-pana-ink/65 px-2 py-0.5 text-[11px]">
                  #{tag}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-4 flex items-center gap-2">
            <Button className="bg-pana-indigo text-pana-cream hover:bg-pana-indigo/90 flex-1 rounded-full font-extrabold">
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              Add Pana
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="border-pana-ink/20 rounded-full"
              aria-label={`Message ${profile.name}`}
            >
              <MessageCircle className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="border-pana-ink/20 rounded-full"
              aria-label="Share this profile"
            >
              <Share2 className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>

        {/* Figures, not controls. In the old layout the stat rail doubled as
            navigation because the tabs were a long way down the page; here the
            tab bar is a few hundred pixels to the right, and two controls that
            select the same thing side by side is a coin toss, not a choice. */}
        <div className="stat-rail border-b-0">
          {profile.stats.map((stat) => (
            <div key={stat.tab} className="stat-rail-item">
              <span className="stat-rail-value">
                {stat.value.toLocaleString('en-US')}
              </span>
              <span className="stat-rail-label">{stat.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Panas stay in the rail rather than becoming a fifth tab. They are a
          fact about the person, like the county badge — the four tabs are all
          things this person has made or committed to, and a list of other
          people does not belong in that set. */}
      <section className="profile-card p-4">
        <h2 className="rail-heading">Panas</h2>
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {MOCK_PANAS.map((pana) => (
            <li key={pana.id}>
              <span
                className="border-pana-ink/10 relative block h-10 w-10 overflow-hidden rounded-full border-2"
                title={`${pana.name} (@${pana.handle})`}
              >
                <Image
                  src={pana.avatar}
                  alt={pana.name}
                  fill
                  sizes="40px"
                  className="object-cover"
                />
              </span>
            </li>
          ))}
        </ul>
        <p className="text-pana-ink/55 mt-3 text-[12px] leading-snug font-bold">
          A Pana is a mutual follow. {MOCK_FOLLOWERS_ONLY_COUNT} more people
          follow {profile.name.split(' ')[0]} without being followed back.
        </p>
        <Link
          href="/mock/profile-next"
          className="link-arrow text-pana-indigo mt-2 inline-flex text-[13px] font-extrabold"
        >
          See all Panas
        </Link>
      </section>
    </aside>
  );
}
