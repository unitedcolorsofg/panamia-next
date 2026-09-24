'use client';

import type { CSSProperties } from 'react';
import {
  CalendarDays,
  Check,
  Clock,
  Globe,
  Loader2,
  Lock,
  UserPlus,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  useGroup,
  useJoinGroup,
  useLeaveGroup,
  type GroupDetailResponse,
} from '@/lib/query/social';

/**
 * A group home page, as far as Phases 1 and 2 can honestly render it.
 *
 * Follows app/mock/group: cover, square avatar, identity block with a privacy
 * pill, summary, topics, join action. What the mock has and this does not is
 * posts, events and a roster -- those need the group timeline from Phase 3,
 * and showing empty tabs for them would advertise features that are not wired
 * rather than features that are quiet.
 *
 * The mock's stat rail is dropped for the same reason. With Posts and Events
 * unbuilt it would be a single Members figure, which the line above it already
 * gives -- a full-width bar restating one number, where the mock's version
 * earned its weight by being three controls.
 */
export function GroupView({ handle }: { handle: string }) {
  const { data, isLoading, isError } = useGroup(handle);

  if (isLoading) return <GroupSkeleton />;

  /* getSocialData folds 404 into null, so a missing group arrives as data
     being null rather than as an error. The server shell already 404s a bad
     handle, so reaching this means the group vanished between the two. */
  if (isError || !data) {
    return (
      <main className="surface-cream min-h-screen pb-20">
        <div className="container mx-auto max-w-4xl px-4 pt-16">
          <h1 className="text-pana-ink text-2xl font-black">
            This group is not available
          </h1>
          <p className="text-pana-ink/65 mt-2 text-[15px] font-medium">
            It may have been removed, or the link may be wrong.
          </p>
        </div>
      </main>
    );
  }

  return <GroupBody handle={handle} detail={data} />;
}

function GroupBody({
  handle,
  detail,
}: {
  handle: string;
  detail: GroupDetailResponse;
}) {
  const { group, actor, viewer } = detail;

  const isPrivate = group.visibility === 'private';
  const name = actor.name || handle;
  const topics = Object.keys(group.topics ?? {}).filter(
    (topic) => group.topics[topic]
  );
  const rules = Array.isArray(group.rules) ? (group.rules as string[]) : [];

  return (
    <main className="surface-cream min-h-screen pb-20">
      <header>
        {/* Scallop is white to meet the masthead directly above, the same way
            the profile hero does. */}
        <div
          className="profile-cover scallop"
          style={{ '--scallop': '#ffffff' } as CSSProperties}
        >
          {/* Plain img rather than next/image: these are remote CDN URLs and
              next.config.js declares no remotePatterns, so the optimizer
              would reject them at runtime. */}
          <img
            src={actor.headerUrl || '/img/bg_coconut_blue.jpg'}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover"
          />
        </div>

        <div className="container mx-auto max-w-4xl px-4">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:gap-7">
            {/* Square-ish, not a circle. A circular avatar reads as a person,
                and this page must never be mistaken for somebody's profile. */}
            <div className="profile-avatar" data-shape="group">
              <img
                src={actor.iconUrl || '/img/bg_coconut_blue.jpg'}
                alt=""
                aria-hidden="true"
                className="absolute inset-0 h-full w-full object-cover"
              />
            </div>

            <div className="min-w-0 flex-1 md:pb-1">
              <h1 className="profile-name">{name}</h1>

              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className="profile-handle">@{handle}</span>
                <span
                  className="identity-pill"
                  data-tone={isPrivate ? undefined : 'verified'}
                >
                  {isPrivate ? (
                    <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <Globe className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  {isPrivate ? 'Private group' : 'Open group'}
                </span>
              </div>
            </div>

            <div className="hidden flex-none items-center gap-2 md:flex md:pb-1">
              <JoinAction handle={handle} group={group} viewer={viewer} />
            </div>
          </div>

          <div className="mt-5 max-w-2xl space-y-4">
            {actor.summary && (
              <p className="text-pana-ink/85 text-[15px] leading-relaxed font-medium">
                {actor.summary}
              </p>
            )}

            <div className="text-pana-ink/60 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] font-bold">
              <span className="inline-flex items-center gap-1.5">
                <Users className="h-4 w-4" aria-hidden="true" />
                {group.memberCount.toLocaleString('en-US')}
                {group.memberCount === 1 ? ' member' : ' members'}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4" aria-hidden="true" />
                Started{' '}
                {new Date(group.createdAt).toLocaleDateString('en-US', {
                  month: 'long',
                  year: 'numeric',
                })}
              </span>
            </div>

            {topics.length > 0 && (
              <ul className="flex flex-wrap gap-2">
                {topics.map((topic) => (
                  <li key={topic}>
                    <span className="identity-pill text-pana-ink/70">
                      #{topic}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-5 flex items-center gap-2 md:hidden">
            <JoinAction handle={handle} group={group} viewer={viewer} stretch />
          </div>
        </div>
      </header>

      <div className="container mx-auto max-w-4xl px-4 pt-8">
        {viewer.canRead ? (
          <div className="space-y-4">
            {rules.length > 0 && (
              <section className="border-pana-ink/10 rounded-2xl border bg-white p-5">
                <h2 className="text-pana-ink text-[15px] font-extrabold">
                  House rules
                </h2>
                <ol className="text-pana-ink/75 mt-3 space-y-2 text-[14px] leading-snug font-medium">
                  {rules.map((rule, index) => (
                    <li key={rule} className="flex gap-2">
                      <span className="text-pana-ink/40 font-extrabold">
                        {index + 1}.
                      </span>
                      <span>{rule}</span>
                    </li>
                  ))}
                </ol>
              </section>
            )}

            <section className="border-pana-ink/10 rounded-2xl border border-dashed p-6">
              <h2 className="text-pana-ink text-[15px] font-extrabold">
                Posts are coming
              </h2>
              <p className="text-pana-ink/65 mt-1.5 text-[13px] leading-snug font-medium">
                This group exists and you can join it. Posting, events and the
                member roster land next, and anything posted here will show up
                in your feed.
              </p>
            </section>
          </div>
        ) : (
          <LockedPanel isPending={viewer.isPending} />
        )}
      </div>
    </main>
  );
}

/**
 * What a stranger sees of a private group.
 *
 * Everything above this point still rendered -- name, summary, topics, member
 * count -- because a group nobody can identify is a group nobody can ask to
 * join. What stops here is the content.
 */
function LockedPanel({ isPending }: { isPending: boolean }) {
  return (
    <div className="border-pana-ink/15 flex flex-col items-center rounded-2xl border border-dashed px-6 py-12 text-center">
      <Lock className="text-pana-ink/35 h-7 w-7" aria-hidden="true" />
      <h2 className="text-pana-ink mt-3 text-[17px] font-extrabold">
        This group is private
      </h2>
      <p className="text-pana-ink/65 mt-1.5 max-w-sm text-[14px] leading-snug font-medium">
        {isPending
          ? 'Your request is with the organizers. You will see posts here once it is accepted.'
          : 'Posts, events and the member list are for members. You can still ask to join.'}
      </p>
    </div>
  );
}

/**
 * The primary action, which is a different button for each viewer.
 *
 *   - member   → Joined, which is a way out. A member needs no call to action.
 *   - pending  → Requested, which withdraws. Saying "Join" would re-ask.
 *   - invite   → nothing. An invite-only group cannot be asked.
 *   - request  → Request to join, which sets the expectation of a wait.
 *   - open     → Join group, one tap.
 *
 * Indigo rather than burnt, per the palette note in globals.css: white-on-burnt
 * measures about 4.2:1, under the 4.5 bar, while cream-on-indigo measures 9.01.
 */
function JoinAction({
  handle,
  group,
  viewer,
  stretch = false,
}: {
  handle: string;
  group: GroupDetailResponse['group'];
  viewer: GroupDetailResponse['viewer'];
  stretch?: boolean;
}) {
  const join = useJoinGroup();
  const leave = useLeaveGroup();
  const busy = join.isPending || leave.isPending;

  const stretchClass = stretch ? 'flex-1' : '';

  /* Null means signed out, which is not the same as "you may not join" -- so
     the button still shows and sign-in is the thing it asks for. */
  if (viewer.canJoin === null && !viewer.isMember && !viewer.isPending) {
    return (
      <Button
        asChild
        className={`bg-pana-indigo text-pana-cream hover:bg-pana-indigo/90 rounded-full font-extrabold ${stretchClass}`}
      >
        <a href={`/signin?callbackUrl=${encodeURIComponent(`/g/${handle}`)}`}>
          <UserPlus className="h-4 w-4" aria-hidden="true" />
          Sign in to join
        </a>
      </Button>
    );
  }

  if (viewer.isMember || viewer.isPending) {
    return (
      <Button
        onClick={() => leave.mutate(handle)}
        disabled={busy}
        aria-pressed={true}
        variant="outline"
        className={`border-pana-ink/20 rounded-full font-extrabold ${stretchClass}`}
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : viewer.isPending ? (
          <Clock className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Check className="h-4 w-4" aria-hidden="true" />
        )}
        {viewer.isPending ? 'Requested' : 'Joined'}
      </Button>
    );
  }

  // Invite-only: there is no action to offer, so none is shown.
  if (group.joinPolicy === 'invite') {
    return (
      <span className="text-pana-ink/55 text-[13px] font-bold">
        Invite only
      </span>
    );
  }

  const asks = group.joinPolicy === 'request';

  return (
    <Button
      onClick={() => join.mutate(handle)}
      disabled={busy}
      className={`bg-pana-indigo text-pana-cream hover:bg-pana-indigo/90 rounded-full font-extrabold ${stretchClass}`}
    >
      {busy ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : asks ? (
        <Lock className="h-4 w-4" aria-hidden="true" />
      ) : (
        <UserPlus className="h-4 w-4" aria-hidden="true" />
      )}
      {asks ? 'Request to join' : 'Join group'}
    </Button>
  );
}

function GroupSkeleton() {
  return (
    <main className="surface-cream min-h-screen pb-20" aria-hidden="true">
      <div className="bg-pana-ink/10 h-48 w-full animate-pulse" />
      <div className="container mx-auto max-w-4xl animate-pulse px-4 pt-8">
        <div className="bg-pana-ink/10 h-8 w-64 rounded-xl" />
        <div className="bg-pana-ink/10 mt-3 h-4 w-96 max-w-full rounded-lg" />
        <div className="bg-pana-ink/10 mt-6 h-24 rounded-2xl" />
      </div>
    </main>
  );
}
