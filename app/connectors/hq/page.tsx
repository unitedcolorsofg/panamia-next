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
import { CONNECTORS_CHROME } from '@/lib/connectors/theme';

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

      <main className="bg-pana-cream text-pana-ink pb-20">
        <header
          className={`border-pana-ink border-b-2 ${CONNECTORS_CHROME.FILL}`}
        >
          <div className="container mx-auto px-4 py-10">
            <p
              className={`text-xs font-extrabold tracking-[0.2em] uppercase ${CONNECTORS_CHROME.ACCENT}`}
            >
              Connector HQ
            </p>
            <h1
              className={`mt-2 text-4xl leading-tight font-extrabold ${CONNECTORS_CHROME.ON_FILL} sm:text-5xl`}
            >
              Hey, {me.name.split(' ')[0]}.
            </h1>

            <dl className="text-pana-cream mt-6 flex flex-wrap gap-x-8 gap-y-3 text-sm">
              <div>
                <dt className="text-pana-cream/60 text-xs font-bold tracking-wide uppercase">
                  House
                </dt>
                <dd className="mt-0.5 font-bold">
                  {house ? (
                    house.name
                  ) : (
                    <span className={CONNECTORS_CHROME.ACCENT}>
                      Not chosen yet
                    </span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-pana-cream/60 text-xs font-bold tracking-wide uppercase">
                  Tier
                </dt>
                <dd className="mt-0.5 font-bold">
                  <TierLabel tier={me.tier} />
                </dd>
              </div>
              <div>
                <dt className="text-pana-cream/60 text-xs font-bold tracking-wide uppercase">
                  Pod
                </dt>
                <dd className="mt-0.5 font-bold">
                  {pod.name} · {podSize} connectors
                </dd>
              </div>
            </dl>

            <p className="text-pana-cream/70 mt-4 max-w-2xl text-sm leading-relaxed">
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
              <h2 className="text-pana-ink/60 text-sm font-extrabold tracking-wide uppercase">
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
                    <p className="leading-snug font-bold">{ask.what}</p>
                    <p className="text-pana-ink/60 mt-1">
                      Asked by {ask.askedBy}
                    </p>
                  </li>
                ))}
              </ul>
            </Panel>

            {house && (
              <Panel title={`Next in ${house.name}`}>
                <p className="text-pana-ink/70 text-sm leading-relaxed">
                  What people at each tier are doing. Tiers are about how much
                  you are carrying — not how good you are at it.
                </p>

                <div className="mt-4 flex flex-col gap-4">
                  {([1, 2, 3] as const).map((t) => (
                    <div
                      key={t}
                      className={
                        t === me.tier
                          ? 'border-pana-ink rounded-lg border-2 p-3'
                          : 'px-3 opacity-60'
                      }
                    >
                      <p className="text-xs font-extrabold tracking-wide uppercase">
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
    <main className="bg-pana-cream text-pana-ink py-24">
      <div className="container mx-auto max-w-xl px-4 text-center">
        <h1 className="text-3xl leading-tight font-extrabold sm:text-4xl">
          You are not a connector yet.
        </h1>
        <p className="text-pana-ink/70 mt-4 text-base leading-relaxed">
          Connector HQ is where the pods keep their events, their commitments
          and their open asks. Read what the programme is, and if it sounds like
          you, there is a way in.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <SurfaceLink
            href="/connectors"
            className={`rounded-full border-2 ${CONNECTORS_CHROME.BORDER} ${CONNECTORS_CHROME.FILL} px-5 py-2.5 text-sm font-extrabold ${CONNECTORS_CHROME.ON_FILL}`}
          >
            What is Pana Connectors?
          </SurfaceLink>
          <SurfaceLink
            href="/form/get-listed"
            className="border-pana-ink text-pana-ink rounded-full border-2 px-5 py-2.5 text-sm font-extrabold"
          >
            Become a Pana
          </SurfaceLink>
        </div>
      </div>
    </main>
  );
}
