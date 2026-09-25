import Image from 'next/image';
import {
  BadgeCheck,
  CalendarDays,
  MapPin,
  MessageCircle,
  Share2,
  UserPlus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { MockProfile, ProfileTab } from '../_data/mock-profile';

interface ProfileHeroProps {
  profile: MockProfile;
  activeTab: ProfileTab;
  onSelectTab: (tab: ProfileTab) => void;
}

/* Cover, identity block, bio, actions, and the stat rail.
 *
 * The stat rail is wired to the same `activeTab` state as the tab bar below
 * it, so "1,284 Panas" is a control rather than a decoration — tapping a
 * figure is the fastest way most people will reach a section. It is not a
 * second `tablist`: two tablists driving one set of panels reads as a
 * duplicate control group to a screen reader, so these stay plain buttons and
 * the tab bar below owns the tab semantics. */
export function ProfileHero({
  profile,
  activeTab,
  onSelectTab,
}: ProfileHeroProps) {
  return (
    <header>
      {/* No scalloped trim here, unlike the homepage sections. The cover meets
          the masthead flush: a person's photograph is the subject of this
          page, and notching a bite out of its top edge reads as damage rather
          than as the doily motif it does on a flat colour band. */}
      <div className="profile-cover">
        <Image
          src={profile.cover}
          alt={profile.coverAlt}
          fill
          priority
          sizes="100vw"
        />
      </div>

      <div className="container mx-auto max-w-4xl px-4">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:gap-7">
          <div className="profile-avatar">
            <Image
              src={profile.avatar}
              alt={`${profile.name}'s profile picture`}
              fill
              priority
              sizes="(min-width: 768px) 184px, 152px"
            />
          </div>

          <div className="min-w-0 flex-1 md:pb-1">
            <h1 className="profile-name">{profile.name}</h1>

            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
              <span className="profile-handle">@{profile.handle}</span>
              <span className="identity-pill">{profile.pronouns}</span>
              {/* The check sits on the county because that is the part that is
                  actually verified — residency is confirmed from billing zip,
                  not self-reported. Neighborhoods below are self-declared and
                  deliberately carry no check. */}
              {profile.verified && (
                <span className="identity-pill" data-tone="verified">
                  <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  {profile.county}
                </span>
              )}
            </div>
          </div>

          {/* Actions sit beside the name on desktop and drop below the bio on
              mobile, where Add Pana takes the full row as the primary action. */}
          <div className="hidden flex-none items-center gap-2 md:flex md:pb-1">
            <ProfileActions />
          </div>
        </div>

        <div className="mt-5 max-w-2xl space-y-4">
          <p className="text-pana-indigo text-sm font-extrabold tracking-wide uppercase">
            {profile.fiveWords}
          </p>

          <p className="text-pana-ink/85 text-[15px] leading-relaxed font-medium">
            {profile.bio}
          </p>

          <div className="text-pana-ink/60 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] font-bold">
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-4 w-4" aria-hidden="true" />
              {profile.neighborhoods.join(' · ')}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4" aria-hidden="true" />
              {profile.joined}
            </span>
          </div>

          <ul className="flex flex-wrap gap-2">
            {profile.tags.map((tag) => (
              <li key={tag}>
                <span className="identity-pill text-pana-ink/70">#{tag}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-5 flex items-center gap-2 md:hidden">
          <ProfileActions stretch />
        </div>

        <div className="stat-rail mt-6">
          {profile.stats.map((stat) => (
            <button
              key={stat.tab}
              type="button"
              className="stat-rail-item"
              data-active={activeTab === stat.tab}
              onClick={() => onSelectTab(stat.tab)}
            >
              <span className="stat-rail-value">
                {stat.value.toLocaleString('en-US')}
              </span>
              <span className="stat-rail-label">{stat.label}</span>
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}

/* Rendered twice at different breakpoints, so it is factored out rather than
   duplicated. `stretch` is the mobile arrangement, where Add Pana claims the
   remaining width and Message collapses to its icon.

   Indigo rather than burnt: the palette note in globals.css puts white-on-burnt
   at roughly 4.2:1, under the 4.5 bar for button copy, while cream-on-indigo
   measures 9.01. */
function ProfileActions({ stretch = false }: { stretch?: boolean }) {
  return (
    <>
      <Button
        className={`bg-pana-indigo text-pana-cream hover:bg-pana-indigo/90 rounded-full font-extrabold ${
          stretch ? 'flex-1' : ''
        }`}
      >
        <UserPlus className="h-4 w-4" aria-hidden="true" />
        Add Pana
      </Button>
      <Button
        variant="outline"
        className="border-pana-ink/20 rounded-full font-extrabold"
      >
        <MessageCircle className="h-4 w-4" aria-hidden="true" />
        <span className={stretch ? 'sr-only' : undefined}>Message</span>
      </Button>
      <Button
        variant="outline"
        size="icon"
        className="border-pana-ink/20 rounded-full"
        aria-label="Share profile"
      >
        <Share2 className="h-4 w-4" aria-hidden="true" />
      </Button>
    </>
  );
}
