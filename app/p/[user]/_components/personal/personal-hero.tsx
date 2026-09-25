import type { ReactNode } from 'react';
import Image from 'next/image';
import { BadgeCheck, CalendarDays, MapPin } from 'lucide-react';
import type { PersonalProfileView } from '@/lib/server/personal-profile';
import { isUnoptimizableImageSrc } from '@/lib/image-src';
import { StoryRing } from '@/components/social/StoryRing';
import type { PersonalTab, StatDef } from './types';

interface PersonalHeroProps {
  profile: PersonalProfileView;
  stats: StatDef[];
  activeTab: PersonalTab;
  onSelectTab: (tab: PersonalTab) => void;
  actions: ReactNode;
  mobileActions: ReactNode;
}

/* Cover, identity block, bio, actions, and the stat rail.
 *
 * The stat rail is wired to the same `activeTab` state as the tab bar below
 * it, so "1,284 Panas" is a control rather than a decoration — tapping a
 * figure is the fastest way most people will reach a section. It is not a
 * second `tablist`: two tablists driving one set of panels reads as a
 * duplicate control group to a screen reader, so these stay plain buttons and
 * the tab bar below owns the tab semantics. */
export function PersonalHero({
  profile,
  stats,
  activeTab,
  onSelectTab,
  actions,
  mobileActions,
}: PersonalHeroProps) {
  return (
    <header>
      {/* No scalloped trim here, unlike the homepage sections. The cover meets
          the masthead flush: a person's photograph is the subject of this
          page, and notching a bite out of its top edge reads as damage rather
          than as the doily motif it does on a flat colour band. */}
      <div className="profile-cover">
        {profile.cover ? (
          <Image
            src={profile.cover}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover"
            unoptimized={isUnoptimizableImageSrc(profile.cover)}
          />
        ) : (
          // Accounts that never enrolled in social have no header image. A
          // flat band keeps the avatar overlap intact rather than collapsing
          // the layout around a missing asset.
          <div
            className="from-pana-indigo to-pana-flame absolute inset-0 bg-gradient-to-br"
            aria-hidden="true"
          />
        )}
      </div>

      <div className="container mx-auto max-w-4xl px-4">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:gap-7">
          <StoryRing
            username={profile.handle}
            size="lg"
            className="mt-[-92px] [&_.profile-avatar]:!mt-0"
          >
            <div className="profile-avatar">
              {profile.avatar ? (
                <Image
                  src={profile.avatar}
                  alt={`${profile.name}'s profile picture`}
                  fill
                  priority
                  sizes="(min-width: 768px) 184px, 152px"
                  className="object-cover"
                  unoptimized={isUnoptimizableImageSrc(profile.avatar)}
                />
              ) : (
                <div className="bg-pana-butter text-pana-ink flex h-full w-full items-center justify-center text-4xl font-black">
                  {profile.name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
          </StoryRing>

          <div className="min-w-0 flex-1 md:pb-1">
            <h1 className="profile-name">{profile.name}</h1>

            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
              <span className="profile-handle">@{profile.handle}</span>
              {profile.pronouns && (
                <span className="identity-pill">{profile.pronouns}</span>
              )}
              {/* The check sits on the county because that is the part that is
                  actually verified — residency is confirmed from billing zip,
                  not self-reported. Neighborhoods below are self-declared and
                  deliberately carry no check. */}
              {profile.county &&
                (profile.verified ? (
                  <span className="identity-pill" data-tone="verified">
                    <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
                    {profile.county}
                  </span>
                ) : (
                  <span className="identity-pill">{profile.county}</span>
                ))}
            </div>
          </div>

          {/* Actions sit beside the name on desktop and drop below the bio on
              mobile, where the primary action takes the full row. */}
          <div className="hidden flex-none items-center gap-2 md:flex md:pb-1">
            {actions}
          </div>
        </div>

        <div className="mt-5 max-w-2xl space-y-4">
          {profile.fiveWords && (
            <p className="text-pana-indigo text-sm font-extrabold tracking-wide uppercase">
              {profile.fiveWords}
            </p>
          )}

          {profile.bio && (
            <p className="text-pana-ink/85 text-[15px] leading-relaxed font-medium">
              {profile.bio}
            </p>
          )}

          {(profile.neighborhoods.length > 0 || profile.joined) && (
            <div className="text-pana-ink/60 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] font-bold">
              {profile.neighborhoods.length > 0 && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-4 w-4" aria-hidden="true" />
                  {profile.neighborhoods.join(' · ')}
                </span>
              )}
              {profile.joined && (
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="h-4 w-4" aria-hidden="true" />
                  {profile.joined}
                </span>
              )}
            </div>
          )}

          {profile.tags.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {profile.tags.map((tag) => (
                <li key={tag}>
                  <span className="identity-pill text-pana-ink/70">#{tag}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-5 flex items-center gap-2 md:hidden">
          {mobileActions}
        </div>

        <div className="stat-rail mt-6">
          {stats.map((stat) => (
            <button
              key={stat.tab}
              type="button"
              className="stat-rail-item"
              data-active={activeTab === stat.tab}
              onClick={() => onSelectTab(stat.tab)}
            >
              <span className="stat-rail-value">
                {stat.value === null ? '—' : stat.value.toLocaleString('en-US')}
              </span>
              <span className="stat-rail-label">{stat.label}</span>
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}
