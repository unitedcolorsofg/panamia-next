import SurfaceLink from '@/components/panaverse/SurfaceLink';
import {
  BirthdayList,
  CommitmentsTable,
  EventCard,
  HousePill,
  Panel,
  TierLabel,
} from '@/components/connectors/dashboard-parts';
import { ViewerSwitch } from '@/components/connectors/viewer-switch';
import {
  MockButton,
  MockInput,
  MockSelect,
  MockTag,
} from '@/components/mock-controls';
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
import { HOUSES, type ConnectorEvent, getHouse, getPod, getTier } from '@/lib/connectors/model';
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
 *
 * ## Why the controls are here and inert
 *
 * Each of the three questions above has an answer that ends in doing
 * something: I will add a commitment, I will take a shift, I will pick that
 * ask up. The admin console got its mock controls when it moved; this page
 * did not have any, which made HQ a noticeboard — it could tell a connector
 * three volunteers were missing from Saturday and offer no way to be one of
 * them.
 *
 * They are `disabled`, like every other mock control in the app. The point is
 * to settle what a connector reaches for before anybody writes the table that
 * records it. See `components/mock-controls` for why disabled rather than
 * live-but-dropped.
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
          {/* `min-w-0` is load-bearing. A grid item defaults to
              `min-width: auto`, which means it refuses to shrink below its
              content's intrinsic width — so the commitments table's min-width
              pushed this whole column wider than the viewport on a phone, and
              the `overflow-x-auto` wrapper around the table never got the
              chance to scroll because it was never the thing being squeezed.
              The page scrolled sideways instead of the table. */}
          <div className="flex min-w-0 flex-col gap-6 lg:col-span-2">
            <Panel title="My commitments" action={<MockTag />}>
              <CommitmentsTable rows={myCommitments} showWho={false} />

              <div className="border-pana-ink/25 mt-6 border-t-2 border-dashed pt-5">
                <h3 className="text-sm font-extrabold tracking-wide uppercase">
                  Say you will do something
                </h3>
                {/* No "who" field, unlike the admin console's version of this
                  * form. A connector commits themselves; volunteering somebody
                  * else is the pod lead's job and it happens in conversation,
                  * not in a form. */}
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <MockInput
                    label="What"
                    placeholder="Table at the Little Haiti free market"
                  />
                  <MockInput label="When" placeholder="Early November" />
                  <MockSelect
                    label="House"
                    placeholder={house ? house.name : 'Pick a house'}
                    options={HOUSES.map((h) => h.name)}
                  />
                </div>
                <MockButton>Add to my commitments</MockButton>
              </div>
            </Panel>

            <section>
              <h2 className="text-pana-ink/60 text-sm font-extrabold tracking-wide uppercase">
                Coming up
              </h2>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                {events.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    action={<EventSignUp event={event} />}
                  />
                ))}
              </div>
            </section>
          </div>

          <aside className="flex flex-col gap-6">
            <Panel title="Open asks" action={<MockTag />}>
              <ul className="flex flex-col gap-5">
                {openAsks.map((ask) => (
                  <li key={ask.id} className="text-sm">
                    <p className="leading-snug font-bold">{ask.what}</p>
                    <p className="text-pana-ink/60 mt-1">
                      Asked by {ask.askedBy}
                    </p>
                    {/* House pills are on the admin version of this list and
                      * were missing here, which is backwards: a connector is
                      * the one deciding whether an ask is theirs to take. */}
                    {ask.houseIds.length > 0 && (
                      <span className="mt-2 flex flex-wrap gap-1">
                        {ask.houseIds.map((id) => (
                          <HousePill key={id} houseId={id} />
                        ))}
                      </span>
                    )}
                    <MockButton className="mt-2.5">
                      I&rsquo;ll pick this up
                    </MockButton>
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
 * The sign-up under an event card.
 *
 * The label tracks what the event actually needs, because "Sign up" on an
 * event that is already covered and "Sign up" on one that is three people
 * short are different offers, and a connector scanning four cards is choosing
 * between them. The shortfall maths matches `EventCard`'s "Needs" line — if
 * one ever changes, change both, or the card will contradict its own button.
 */
function EventSignUp({ event }: { event: ConnectorEvent }) {
  if (event.volunteersNeeded === null) {
    return <MockButton>Count me in</MockButton>;
  }

  const short = Math.max(0, event.volunteersNeeded - event.volunteersFilled);

  if (short === 0) {
    return <MockButton>Covered — add me as a spare</MockButton>;
  }

  if (short === 1) {
    return <MockButton>I&rsquo;ll take the last one</MockButton>;
  }

  return (
    <MockButton>
      I&rsquo;ll take one of the {short}
    </MockButton>
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
            href="/connectors/join"
            className={`rounded-full border-2 ${CONNECTORS_CHROME.BORDER} ${CONNECTORS_CHROME.FILL} px-5 py-2.5 text-sm font-extrabold ${CONNECTORS_CHROME.ON_FILL}`}
          >
            Become a Connector
          </SurfaceLink>
          {/* The second button used to be "Become a Pana" pointing at
            * `/form/get-listed`, the business directory intake. Two buttons,
            * neither of which joined the programme. */}
          <SurfaceLink
            href="/connectors"
            className="border-pana-ink text-pana-ink rounded-full border-2 px-5 py-2.5 text-sm font-extrabold"
          >
            What is Pana Connectors?
          </SurfaceLink>
        </div>
      </div>
    </main>
  );
}
