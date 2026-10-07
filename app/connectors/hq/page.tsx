import type { ReactNode } from 'react';

import { auth } from '@/auth';
import SurfaceLink from '@/components/panaverse/SurfaceLink';
import { Panel, TierLabel } from '@/components/connectors/dashboard-parts';
import { MyCommitments } from '@/components/connectors/my-commitments';
import {
  countConnectorsInPod,
  getMyConnector,
  type ProfileConnector,
} from '@/lib/connectors/membership';
import { getHouse, getPod, getTier } from '@/lib/connectors/model';
import { CONNECTORS_CHROME } from '@/lib/connectors/theme';

/**
 * Connector HQ — the page a connector actually lives on.
 *
 * ## What changed, and why
 *
 * This page used to render a fixture: a hardcoded demo connector called
 * Bianca, shown to everybody who added `?as=connector` to the URL. Signed in
 * as yourself, HQ greeted you by somebody else's name — which is exactly the
 * bug that was reported against production. It now reads the signed-in
 * member's own membership from `profiles.connector`.
 *
 * ## What was removed
 *
 * The events, open asks and birthdays panels are gone rather than kept. All
 * three rendered invented people — asks "asked by" names that do not exist,
 * birthdays for nobody — and there is no table behind any of them and no way
 * to create one: events and asks are programme-wide content owned by an
 * organiser, and the admin console lives on admin.pana.social, out of scope
 * here. Leaving them in place would mean this page still shows fiction, which
 * is the thing being fixed. They come back when they have real data behind
 * them.
 *
 * What stays is what is true: your own commitments, which you write; your
 * pod's real size, counted; and the tier ladder for your houses, which is
 * programme content from `lib/connectors/model.ts` rather than a person.
 *
 * The "next in your house" panel is the one piece that is not in the
 * spreadsheet today. The deck lists example actions per house per tier, and
 * leaving that on a slide means it gets read once during onboarding and never
 * again — which is precisely when somebody starts wondering what Tier 2 would
 * actually involve.
 *
 * ## Three ways not to see HQ
 *
 * Applying is not joining. This page is only the dashboard for an accepted
 * member; a pending applicant, a declined one and somebody who has never
 * applied each get their own message instead, because telling all three "you
 * are not a connector yet" would be wrong for two of them.
 */

export const metadata = {
  title: 'Connector HQ | Pana MIA Club',
  robots: { index: false, follow: false },
};

export default async function ConnectorHqPage() {
  const session = await auth();

  // Not signed in and not a member land in the same place on purpose. HQ has
  // nothing to show either of them, and "sign in" is the wrong first thing to
  // say to somebody who has never heard of the programme.
  if (!session?.user?.id) {
    return <NotAConnectorYet signedIn={false} />;
  }

  const me = await getMyConnector(session.user.id);
  if (!me) {
    return <NotAConnectorYet signedIn />;
  }

  // Applying is not joining. Only an accepted member gets HQ; the other two
  // states each get an answer of their own, because "we have your
  // application" and "the answer was no" are different things to be told.
  if (me.membership.status === 'pending') {
    return <ApplicationPending membership={me.membership} />;
  }
  if (me.membership.status === 'declined') {
    return <ApplicationDeclined />;
  }

  const { displayName, membership } = me;
  const houses = membership.houses.map(getHouse);
  const tier = getTier(membership.tier);
  const pod = getPod(membership.pod);
  const podSize = await countConnectorsInPod(membership.pod);

  return (
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
            Hey, {displayName.split(' ')[0]}.
          </h1>

          <dl className="text-pana-cream mt-6 flex flex-wrap gap-x-8 gap-y-3 text-sm">
            <div>
              <dt className="text-pana-cream/60 text-xs font-bold tracking-wide uppercase">
                {houses.length === 1 ? 'House' : 'Houses'}
              </dt>
              <dd className="mt-0.5 font-bold">
                {houses.map((h) => h.name).join(' · ')}
              </dd>
            </div>
            <div>
              <dt className="text-pana-cream/60 text-xs font-bold tracking-wide uppercase">
                Tier
              </dt>
              <dd className="mt-0.5 font-bold">
                <TierLabel tier={membership.tier} />
              </dd>
            </div>
            <div>
              <dt className="text-pana-cream/60 text-xs font-bold tracking-wide uppercase">
                Pod
              </dt>
              <dd className="mt-0.5 font-bold">
                {pod.name} ·{' '}
                {podSize === 1 ? 'just you so far' : `${podSize} connectors`}
              </dd>
            </div>
          </dl>

          <p className="text-pana-cream/70 mt-4 max-w-2xl text-sm leading-relaxed">
            {tier.blurb}
          </p>

          <p className="mt-4 text-sm">
            <SurfaceLink
              href="/connectors/join"
              className={`font-bold underline underline-offset-4 ${CONNECTORS_CHROME.ACCENT}`}
            >
              Change your houses or pod
            </SurfaceLink>
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
          <Panel title="My commitments">
            <MyCommitments
              commitments={membership.commitments}
              houses={membership.houses}
            />
          </Panel>
        </div>

        <aside className="flex flex-col gap-6">
          {houses.map((house) => (
            <Panel key={house.id} title={`Next in ${house.name}`}>
              <p className="text-pana-ink/70 text-sm leading-relaxed">
                What people at each tier are doing. Tiers are about how much you
                are carrying — not how good you are at it.
              </p>

              <div className="mt-4 flex flex-col gap-4">
                {([1, 2, 3] as const).map((t) => (
                  <div
                    key={t}
                    className={
                      t === membership.tier
                        ? 'border-pana-ink rounded-lg border-2 p-3'
                        : 'px-3 opacity-60'
                    }
                  >
                    <p className="text-xs font-extrabold tracking-wide uppercase">
                      Tier {t}
                      {t === membership.tier ? ' · you' : ''}
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
          ))}

          {membership.bring && (
            <Panel title="What you said you can bring">
              <p className="text-pana-ink/80 text-sm leading-relaxed">
                {membership.bring}
              </p>
            </Panel>
          )}
        </aside>
      </div>
    </main>
  );
}

/**
 * The full-page message states HQ can show instead of a dashboard.
 *
 * One shell for all of them so that "not a connector", "waiting" and
 * "declined" cannot drift apart visually. They are the same page answering
 * the same question — why am I not looking at HQ — with different reasons.
 */
function HqMessage({
  title,
  children,
  actions,
}: {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <main className="bg-pana-cream text-pana-ink py-24">
      <div className="container mx-auto max-w-xl px-4 text-center">
        <h1 className="text-3xl leading-tight font-extrabold sm:text-4xl">
          {title}
        </h1>
        <div className="text-pana-ink/70 mt-4 text-base leading-relaxed">
          {children}
        </div>
        {actions && (
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {actions}
          </div>
        )}
      </div>
    </main>
  );
}

function PrimaryAction({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <SurfaceLink
      href={href}
      className={`rounded-full border-2 ${CONNECTORS_CHROME.BORDER} ${CONNECTORS_CHROME.FILL} px-5 py-2.5 text-sm font-extrabold ${CONNECTORS_CHROME.ON_FILL}`}
    >
      {children}
    </SurfaceLink>
  );
}

function SecondaryAction({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <SurfaceLink
      href={href}
      className="border-pana-ink text-pana-ink rounded-full border-2 px-5 py-2.5 text-sm font-extrabold"
    >
      {children}
    </SurfaceLink>
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
function NotAConnectorYet({ signedIn }: { signedIn: boolean }) {
  return (
    <HqMessage
      title="You are not a connector yet."
      actions={
        <>
          <PrimaryAction href={signedIn ? '/connectors/join' : '/signin'}>
            {signedIn ? 'Apply to be a Connector' : 'Sign in to apply'}
          </PrimaryAction>
          {/* The second button used to be "Become a Pana" pointing at
           * `/form/get-listed`, the business directory intake. Two buttons,
           * neither of which joined the programme. */}
          <SecondaryAction href="/connectors">
            What is Pana Connectors?
          </SecondaryAction>
        </>
      }
    >
      <p>
        Connector HQ is where the pods keep their commitments and their people.
        Read what the programme is, and if it sounds like you, there is a way
        in.
      </p>
    </HqMessage>
  );
}

/**
 * Somebody has applied and is waiting on a decision.
 *
 * Their answers are shown back to them for two reasons: it confirms the form
 * actually saved something, and it is the moment they are most likely to spot
 * that they picked the wrong pod — so the edit link is right there rather
 * than requiring them to guess that the join page still works.
 */
function ApplicationPending({ membership }: { membership: ProfileConnector }) {
  const pod = getPod(membership.pod);
  const houses = membership.houses.map(getHouse);

  return (
    <HqMessage
      title="Your application is in."
      actions={
        <>
          <PrimaryAction href="/connectors/join">
            Change your answers
          </PrimaryAction>
          <SecondaryAction href="/connectors">
            What is Pana Connectors?
          </SecondaryAction>
        </>
      }
    >
      <p>
        Someone from the programme reviews these by hand, so this is not
        instant. You will keep access to this page — when you have been taken
        on, this is where your HQ appears.
      </p>
      <dl className="border-pana-ink/20 mt-6 flex flex-col gap-3 rounded-xl border-2 border-dashed p-5 text-left text-sm">
        <div>
          <dt className="text-pana-ink/60 text-xs font-bold tracking-wide uppercase">
            Pod
          </dt>
          <dd className="mt-0.5 font-bold">{pod.name}</dd>
        </div>
        <div>
          <dt className="text-pana-ink/60 text-xs font-bold tracking-wide uppercase">
            {houses.length === 1 ? 'House' : 'Houses'}
          </dt>
          <dd className="mt-0.5 font-bold">
            {houses.map((h) => h.name).join(' · ')}
          </dd>
        </div>
      </dl>
    </HqMessage>
  );
}

/**
 * The answer was no.
 *
 * Deliberately short, and deliberately without a re-apply button. Re-posting
 * the join form carries the decision over rather than resetting it, so a
 * button here would look like a second chance and deliver nothing — see
 * `app/api/admin/connectors/[profileId]/decline/route.ts` for why reversing a
 * decision is a conversation rather than a click.
 */
function ApplicationDeclined() {
  return (
    <HqMessage
      title="You are not in the programme."
      actions={
        <SecondaryAction href="/connectors">
          What is Pana Connectors?
        </SecondaryAction>
      }
    >
      <p>
        Your application was reviewed and not taken forward this time. If you
        think that is a mistake, or things have changed, talk to whoever you
        know in the programme — there are plenty of other ways to be in this
        community in the meantime.
      </p>
    </HqMessage>
  );
}
