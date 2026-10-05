import SurfaceLink from '@/components/panaverse/SurfaceLink';
import {
  BirthdayList,
  CommitmentsTable,
  EventCard,
  Panel,
  TierLabel,
} from '@/components/connectors/dashboard-parts';
import { ViewerSwitch } from '@/components/connectors/viewer-switch';
import {
  ASKS,
  DEMO_VIEWER_ID,
  commitmentsFor,
  connectorById,
  connectorsInPod,
  resolveViewerRole,
  upcomingBirthdays,
  upcomingEvents,
} from '@/lib/connectors/fixtures';
import { getHouse, getPod, getTier } from '@/lib/connectors/model';

/**
 * Connector HQ — the page a connector actually lives on.
 *
 * Ordered by what somebody opens it to find out, which in practice is three
 * questions in this order: what have I said I would do, what is happening
 * soon, and what else needs picking up. The programme explainer is not
 * repeated here; by this point you have read it.
 *
 * The "next in your house" panel is the one piece that is not in the
 * spreadsheet today. The deck lists example actions per house per tier, and
 * leaving that on a slide means it gets read once during onboarding and never
 * again — which is precisely when somebody starts wondering what Tier 2 would
 * actually involve.
 */

export const metadata = {
  title: 'Connector HQ | Pana MIA Club',
  robots: { index: false, follow: false },
};

export default async function ConnectorHqPage({
  searchParams,
}: {
  searchParams: Promise<{ as?: string }>;
}) {
  const role = resolveViewerRole((await searchParams).as);

  if (role === 'visitor') {
    return (
      <>
        <ViewerSwitch current="visitor" />
        <NotAConnectorYet />
      </>
    );
  }

  const me = connectorById(DEMO_VIEWER_ID);
  if (!me) throw new Error('Demo viewer is missing from the fixture roster');

  const house = me.houseId ? getHouse(me.houseId) : null;
  const tier = getTier(me.tier);
  const pod = getPod(me.podId);
  const myCommitments = commitmentsFor(me.id);
  const podSize = connectorsInPod(me.podId).length;
  const events = upcomingEvents(4);
  const openAsks = ASKS.filter((a) => !a.completed);

  return (
    <>
      <ViewerSwitch current={role} />

      <main className="bg-pana-cream pb-20 text-pana-ink">
        <header className="border-b-2 border-pana-ink bg-pana-ink">
          <div className="container mx-auto px-4 py-10">
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-pana-orange">
              Connector HQ
            </p>
            <h1 className="mt-2 text-4xl font-extrabold leading-tight text-pana-cream sm:text-5xl">
              Hey, {me.name.split(' ')[0]}.
            </h1>

            <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-3 text-sm text-pana-cream">
              <div>
                <dt className="text-xs font-bold uppercase tracking-wide text-pana-cream/60">
                  House
                </dt>
                <dd className="mt-0.5 font-bold">
                  {house ? (
                    house.name
                  ) : (
                    <span className="text-pana-orange">Not chosen yet</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase tracking-wide text-pana-cream/60">
                  Tier
                </dt>
                <dd className="mt-0.5 font-bold">
                  <TierLabel tier={me.tier} />
                </dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase tracking-wide text-pana-cream/60">
                  Pod
                </dt>
                <dd className="mt-0.5 font-bold">
                  {pod.name} · {podSize} connectors
                </dd>
              </div>
            </dl>

            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-pana-cream/70">
              {tier.blurb}
            </p>
          </div>
        </header>

        <div className="container mx-auto grid gap-6 px-4 py-10 lg:grid-cols-3">
          <div className="flex flex-col gap-6 lg:col-span-2">
            <Panel title="My commitments">
              <CommitmentsTable rows={myCommitments} showWho={false} />
            </Panel>

            <section>
              <h2 className="text-sm font-extrabold uppercase tracking-wide text-pana-ink/60">
                Coming up
              </h2>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                {events.map((event) => (
                  <EventCard key={event.id} event={event} />
                ))}
              </div>
            </section>
          </div>

          <aside className="flex flex-col gap-6">
            <Panel title="Open asks">
              <ul className="flex flex-col gap-4">
                {openAsks.map((ask) => (
                  <li key={ask.id} className="text-sm">
                    <p className="font-bold leading-snug">{ask.what}</p>
                    <p className="mt-1 text-pana-ink/60">
                      Asked by {ask.askedBy}
                    </p>
                  </li>
                ))}
              </ul>
            </Panel>

            {house && (
              <Panel title={`Next in ${house.name}`}>
                <p className="text-sm leading-relaxed text-pana-ink/70">
                  What people at each tier are doing. Tiers are about how much
                  you are carrying — not how good you are at it.
                </p>

                <div className="mt-4 flex flex-col gap-4">
                  {([1, 2, 3] as const).map((t) => (
                    <div
                      key={t}
                      className={
                        t === me.tier
                          ? 'rounded-lg border-2 border-pana-ink p-3'
                          : 'px-3 opacity-60'
                      }
                    >
                      <p className="text-xs font-extrabold uppercase tracking-wide">
                        Tier {t}
                        {t === me.tier ? ' · you' : ''}
                      </p>
                      <ul className="mt-1.5 flex list-disc flex-col gap-1 pl-4 text-sm leading-snug">
                        {house.actions[t].map((action) => (
                          <li key={action}>{action}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </Panel>
            )}

            <Panel title="Birthdays coming up">
              <BirthdayList rows={upcomingBirthdays(4)} />
            </Panel>
          </aside>
        </div>
      </main>
    </>
  );
}

/**
 * What somebody who is not in the programme sees if they reach the HQ URL.
 *
 * A redirect would be tidier, but this is the more useful answer: the person
 * most likely to land here is a pana who heard about Connectors from a friend
 * and was sent the link, and bouncing them to the front page without a word
 * loses the thread of why they clicked.
 */
function NotAConnectorYet() {
  return (
    <main className="bg-pana-cream py-24 text-pana-ink">
      <div className="container mx-auto max-w-xl px-4 text-center">
        <h1 className="text-3xl font-extrabold leading-tight sm:text-4xl">
          You are not a connector yet.
        </h1>
        <p className="mt-4 text-base leading-relaxed text-pana-ink/70">
          Connector HQ is where the pods keep their events, their commitments
          and their open asks. Read what the programme is, and if it sounds like
          you, there is a way in.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <SurfaceLink
            href="/connectors"
            className="rounded-full border-2 border-pana-ink bg-pana-ink px-5 py-2.5 text-sm font-extrabold text-pana-cream"
          >
            What is Pana Connectors?
          </SurfaceLink>
          <SurfaceLink
            href="/form/become-a-pana"
            className="rounded-full border-2 border-pana-ink px-5 py-2.5 text-sm font-extrabold text-pana-ink"
          >
            Become a Pana
          </SurfaceLink>
        </div>
      </div>
    </main>
  );
}
