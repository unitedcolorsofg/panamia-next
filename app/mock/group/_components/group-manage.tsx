import Image from 'next/image';
import {
  ArrowRight,
  Ban,
  CalendarPlus,
  Check,
  Clock,
  Settings,
  Shield,
  TriangleAlert,
  Users,
  X,
} from 'lucide-react';
import {
  groupHealth,
  MOCK_BANNED,
  MOCK_EVENTS,
  MOCK_PENDING,
  type MockJoinRequest,
  type ViewerState,
} from '../_data/mock-group';

/* The Manage tab: everything an organiser does, in the order it goes stale.
 *
 * It is called Manage rather than Admin because moderators get it too.
 * Approving requests is the entire reason the moderator role exists, and a tab
 * named for the role above them would read as off-limits to the people meant
 * to use it most.
 *
 * It does not absorb /g/<handle>/settings, and that is deliberate rather than
 * unfinished. Settings is a form with a danger zone at the bottom, and the
 * existing rationale for giving deletion its own route is sound: the only
 * thing between a member and destroying a group should not be a role check on
 * a button they can already see. So this tab links there and stops.
 *
 * What it does absorb is the thing nothing currently points at. The approval
 * queue shipped months ago, on /members, reachable through a "See all N" link
 * that only appears once the roster outgrows a page. A small group with people
 * waiting has no route to its own queue at all. The count on the tab is
 * therefore the actual feature here; the panel below it is just where the
 * count takes you.
 *
 * Order is by decay. Requests have a person on the other end refreshing a
 * page, so they go first. Health is context and never urgent, so it goes
 * last — above the links out, which are not work at all.
 */

function RequestRow({ request }: { request: MockJoinRequest }) {
  return (
    <li className="border-pana-ink/10 flex items-start gap-3 rounded-xl border p-3">
      <div className="border-pana-ink/10 relative h-10 w-10 flex-none overflow-hidden rounded-full border-2">
        <Image
          src={request.avatar}
          alt=""
          fill
          sizes="40px"
          className="object-cover"
        />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-[14.5px] leading-tight font-extrabold">
            {request.name}
          </span>
          <span className="text-pana-ink/45 text-[12.5px] font-bold">
            @{request.handle}
          </span>
        </div>

        {/* Not every request has a bio, so the row cannot be built around
            having one. */}
        {request.blurb ? (
          <p className="text-pana-ink/65 mt-0.5 text-[13px] leading-snug font-medium">
            {request.blurb}
          </p>
        ) : null}

        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
          {/* Mutuals are the one signal on this row that cannot be authored by
              the person asking, which makes them the one worth styling. */}
          {request.mutuals > 0 ? (
            <span className="text-pana-indigo inline-flex items-center gap-1 text-[12px] font-black">
              <Users className="h-3.5 w-3.5" aria-hidden="true" />
              {request.mutuals} Panas in common
            </span>
          ) : (
            <span className="text-pana-ink/40 text-[12px] font-bold">
              No Panas in common
            </span>
          )}

          <span
            className={`inline-flex items-center gap-1 text-[12px] font-bold ${
              request.overdue ? 'text-pana-burnt' : 'text-pana-ink/45'
            }`}
          >
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            Waiting {request.waiting}
          </span>
        </div>
      </div>

      <div className="flex flex-none items-center gap-1.5">
        <button
          type="button"
          className="bg-pana-indigo inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[12px] font-black text-white"
        >
          <Check className="h-3.5 w-3.5" aria-hidden="true" />
          Approve
        </button>
        <button
          type="button"
          aria-label={`Decline ${request.name}`}
          className="border-pana-ink/15 text-pana-ink/55 hover:text-pana-ink inline-flex items-center rounded-full border-2 p-1.5"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    </li>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="border-pana-ink/10 rounded-xl border px-3 py-2.5">
      <p className="text-[19px] leading-none font-black">{value}</p>
      <p className="text-pana-ink/55 mt-1 text-[12px] leading-snug font-bold">
        {label}
      </p>
    </div>
  );
}

export function GroupManage({ viewer }: { viewer: ViewerState }) {
  const health = groupHealth();
  const isAdmin = viewer === 'admin';
  const overdue = MOCK_PENDING.filter((request) => request.overdue).length;

  return (
    <div className="space-y-4">
      <section className="profile-card p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="inline-flex items-center gap-1.5 text-[15px] font-extrabold">
            <Clock className="h-4 w-4" aria-hidden="true" />
            Waiting to join
            <span className="text-pana-ink/55 font-bold">
              ({MOCK_PENDING.length})
            </span>
          </h2>
          {/* The apology case. Somebody has been looking at "Requested" for a
              week and a half, and the group is the only one who can tell. */}
          {overdue > 0 ? (
            <span className="bg-pana-burnt/10 text-pana-burnt inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-black">
              <TriangleAlert className="h-3 w-3" aria-hidden="true" />
              {overdue} waiting over a week
            </span>
          ) : null}
        </div>
        <p className="text-pana-ink/55 mt-1 text-[13px] font-medium">
          Oldest first. Declining isn&apos;t a ban — they can ask again.
        </p>

        <ul className="mt-3 space-y-2">
          {MOCK_PENDING.map((request) => (
            <RequestRow key={request.id} request={request} />
          ))}
        </ul>
      </section>

      <section className="profile-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="inline-flex items-center gap-1.5 text-[15px] font-extrabold">
            <CalendarPlus className="h-4 w-4" aria-hidden="true" />
            Events you&rsquo;re hosting
          </h2>
          <span className="link-arrow text-pana-indigo text-[13px] font-black">
            Host an event
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
        </div>
        {/* The group is the host — events.host_group_id, not the founder's
            profile — which is why this list belongs to the group rather than
            to whoever happened to create each one, and why it outlives them
            leaving. */}
        <p className="text-pana-ink/55 mt-1 text-[13px] font-medium">
          The group is the host, not you.
        </p>

        <ul className="mt-3 space-y-2">
          {MOCK_EVENTS.map((event) => (
            <li
              key={event.id}
              className="border-pana-ink/10 flex items-center gap-3 rounded-xl border p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-extrabold">
                  {event.title}
                </p>
                <p className="text-pana-ink/55 mt-0.5 text-[12.5px] font-bold">
                  {event.when} · {event.going} going, {event.interested} maybe
                </p>
              </div>
              <span className="border-pana-ink/15 text-pana-ink/65 flex-none rounded-full border-2 px-3 py-1 text-[12px] font-black">
                Manage
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="profile-card p-5">
        <h2 className="inline-flex items-center gap-1.5 text-[15px] font-extrabold">
          <Shield className="h-4 w-4" aria-hidden="true" />
          How the group&rsquo;s doing
        </h2>
        <p className="text-pana-ink/55 mt-1 text-[13px] font-medium">
          Last 30 days, next to the whole roster.
        </p>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat
            value={health.activeMembers.toLocaleString('en-US')}
            label={`of ${health.totalMembers.toLocaleString('en-US')} members active`}
          />
          <Stat value={`${health.postAuthors}`} label="members posted" />
          <Stat value={`+${health.joinedThisMonth}`} label="joined" />
          <Stat value={`${health.upcomingEvents}`} label="events coming up" />
        </div>
      </section>

      {MOCK_BANNED.length > 0 ? (
        <section className="profile-card p-5">
          <h2 className="inline-flex items-center gap-1.5 text-[15px] font-extrabold">
            <Ban className="h-4 w-4" aria-hidden="true" />
            Banned
            <span className="text-pana-ink/55 font-bold">
              ({MOCK_BANNED.length})
            </span>
          </h2>
          <p className="text-pana-ink/55 mt-1 text-[13px] font-medium">
            They can&apos;t rejoin until you lift this.
          </p>

          <ul className="mt-3 space-y-2">
            {MOCK_BANNED.map((member) => (
              <li
                key={member.id}
                className="border-pana-ink/10 flex items-center gap-3 rounded-xl border p-3"
              >
                <div className="border-pana-ink/10 relative h-9 w-9 flex-none overflow-hidden rounded-full border-2">
                  <Image
                    src={member.avatar}
                    alt=""
                    fill
                    sizes="36px"
                    className="object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-extrabold">
                    {member.name}
                  </p>
                  <p className="text-pana-ink/50 text-[12.5px] font-bold">
                    Since {member.since}
                  </p>
                </div>
                <span className="border-pana-ink/15 text-pana-ink/65 flex-none rounded-full border-2 px-3 py-1 text-[12px] font-black">
                  Lift ban
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Links out, not work. The roster and the settings form both already
          exist as their own routes and are not rebuilt here — a second copy of
          the roster is exactly the duplication this tab is meant to end. */}
      <section className="profile-card p-5">
        <h2 className="text-[15px] font-extrabold">Elsewhere</h2>
        <ul className="mt-2.5 space-y-1.5">
          <li>
            <span className="link-arrow text-pana-indigo inline-flex items-center gap-1.5 text-[13.5px] font-black">
              <Users className="h-4 w-4" aria-hidden="true" />
              Full roster, roles and removals
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
          </li>
          {/* A moderator who taps Settings gets a 403. Better to say why than
              to show them a door that does not open. */}
          {isAdmin ? (
            <li>
              <span className="link-arrow text-pana-indigo inline-flex items-center gap-1.5 text-[13.5px] font-black">
                <Settings className="h-4 w-4" aria-hidden="true" />
                Group settings, privacy and deletion
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
            </li>
          ) : (
            <li className="text-pana-ink/45 inline-flex items-center gap-1.5 text-[13.5px] font-bold">
              <Settings className="h-4 w-4" aria-hidden="true" />
              Settings and deletion are admin-only
            </li>
          )}
        </ul>
      </section>
    </div>
  );
}
