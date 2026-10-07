import type { ReactNode } from 'react';

import SurfaceLink from '@/components/panaverse/SurfaceLink';
import {
  MockButton,
  MockInput,
  MockSelect,
  MockTag,
  MockTextarea,
} from '@/components/mock-controls';
import { HOUSES, PODS, TIERS, getTier } from '@/lib/connectors/model';
import { CONNECTORS_CHROME } from '@/lib/connectors/theme';

/**
 * The connector intake, as a mock.
 *
 * ## Why this exists at all
 *
 * The front page's primary button said "Become a Connector" and pointed at
 * `/form/get-listed`, which is the public *business directory* intake — a
 * seven-step form asking for your shop's categories and socials. Someone who
 * read the whole programme pitch and decided they wanted in was handed a form
 * about their business, or about a business they do not have. That was the one
 * genuine hole in the surface: the pitch had no door at the end of it.
 *
 * So the mock answers the question it was always going to have to answer —
 * what do we ask somebody who wants to join — before anybody writes the
 * schema that stores it.
 *
 * ## Why these three questions
 *
 * The offering page already tells readers how it works: "Pick a house, join a
 * pod, start at the first tier." This form is that sentence, in order, and
 * nothing else. Every field a reviewer might reach for — how long have you
 * been organizing, what are your qualifications, how many hours a week — is
 * absent on purpose, because the deck is emphatic that the tiers do not rank
 * anybody and that everyone starts at Tier 1. A form that opens by scoring
 * people contradicts the programme on the way in.
 *
 * Tier is shown and not asked, for the same reason.
 *
 * ## Why it is inert
 *
 * Every control is `disabled`, like the rest of the mock controls. A form that
 * looked live, took an email address and dropped it would be worse than no
 * form: somebody would believe they had joined. See `components/mock-controls`
 * for why `disabled` is doing the accessibility work here too.
 *
 * Server component. A multi-step client form is the obvious next version, and
 * it is the wrong thing to build before the questions are settled.
 */

const TIER_ONE = getTier(1);

export function ConnectorJoinForm() {
  return (
    <main className="bg-pana-cream text-pana-ink pb-20">
      <header className={`border-pana-ink border-b-2 ${CONNECTORS_CHROME.FILL}`}>
        <div className="container mx-auto px-4 py-12">
          <p
            className={`text-xs font-extrabold tracking-[0.2em] uppercase ${CONNECTORS_CHROME.ACCENT}`}
          >
            Pana Connectors
          </p>
          <h1
            className={`mt-2 max-w-3xl text-4xl leading-tight font-extrabold ${CONNECTORS_CHROME.ON_FILL} sm:text-5xl`}
          >
            Organize where you already are.
          </h1>
          <p className="text-pana-cream/70 mt-4 max-w-2xl text-base leading-relaxed">
            Three questions. Which county you are in, what you already like
            doing, and what you can bring. Nothing here is a test — read{' '}
            <SurfaceLink
              href="/connectors"
              className={`font-bold underline underline-offset-4 ${CONNECTORS_CHROME.ACCENT}`}
            >
              what the programme is
            </SurfaceLink>{' '}
            first if you have not yet.
          </p>
        </div>
      </header>

      <div className="container mx-auto max-w-3xl px-4 py-10">
        <div className="border-pana-ink/30 bg-pana-butter-2 mb-8 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border-2 border-dashed px-4 py-3">
          <MockTag />
          <p className="text-pana-ink/70 text-sm leading-snug">
            This form does not submit. It is here to settle what we ask a new
            connector before anybody builds the table that stores the answers.
          </p>
        </div>

        <form className="flex flex-col gap-8">
          <Step
            number={1}
            title="Join your pod"
            lede="Pods are geographic, and they meet. Pick the county you can actually get to on a weeknight."
          >
            <div className="grid gap-3 sm:grid-cols-3">
              {PODS.map((pod) => (
                <Choice
                  key={pod.id}
                  name="pod"
                  value={pod.id}
                  title={pod.name}
                  detail={pod.region}
                />
              ))}
            </div>
          </Step>

          <Step
            number={2}
            title="Choose a house"
            lede="Houses group people by what they already like doing, not by what needs covering. Pick the one you recognise yourself in — you can sit in more than one."
          >
            <div className="grid gap-3 sm:grid-cols-2">
              {HOUSES.map((house) => (
                <label
                  key={house.id}
                  className="border-pana-ink bg-pana-cream flex cursor-default flex-col overflow-hidden rounded-xl border-2"
                >
                  <span
                    className="flex items-center gap-2.5 px-4 py-3"
                    style={{
                      backgroundColor: `var(--color-${house.color})`,
                      color: `var(--color-${house.onColor})`,
                    }}
                  >
                    <input
                      type="checkbox"
                      name="house"
                      value={house.id}
                      disabled
                      className="border-pana-ink size-4 shrink-0 rounded border-2"
                    />
                    <span className="text-base leading-tight font-extrabold">
                      {house.name}
                    </span>
                  </span>
                  <span className="text-pana-ink/80 px-4 py-3 text-sm leading-snug">
                    {house.calling}
                  </span>
                </label>
              ))}
            </div>
          </Step>

          <Step
            number={3}
            title="Tell your pod what you can bring"
            lede="Not a résumé. The pod lead reads this to work out who to introduce you to first."
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <MockInput label="Your name" placeholder="Name" />
              <MockInput label="Email" placeholder="you@example.com" />
            </div>
            <div className="mt-3">
              <MockTextarea
                label="What you can bring"
                placeholder="A van most weekends. I speak Creole. I can edit video. I know every venue in Little Haiti."
                rows={3}
              />
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <MockSelect
                label="How you heard about Pana Connectors"
                placeholder="How did you hear about us?"
                options={[
                  'A connector invited me',
                  'At an event or free market',
                  'The Pana MIA directory',
                  'Instagram',
                  'A zine or postcard',
                ]}
              />
              <MockSelect
                label="Best way to reach you"
                placeholder="Best way to reach you"
                options={['Email', 'Text', 'Signal', 'Instagram DM']}
              />
            </div>
          </Step>

          <section className="border-pana-ink bg-pana-butter-2 rounded-xl border-2 p-5">
            <h2 className="text-base font-extrabold">
              You will start at Tier {TIER_ONE.id} — {TIER_ONE.name}
            </h2>
            <p className="text-pana-ink/70 mt-2 text-sm leading-relaxed">
              {TIER_ONE.blurb} Tiers are about how much you are carrying, not
              how good you are at it, and nothing on this form changes where you
              start.
            </p>
            <ol className="mt-4 flex flex-col gap-2 text-sm leading-snug">
              {TIERS.map((tier) => (
                <li key={tier.id} className="flex gap-2.5">
                  <span
                    className={`h-fit shrink-0 rounded-full border-2 px-2 py-0.5 text-xs font-extrabold ${
                      tier.id === TIER_ONE.id
                        ? `${CONNECTORS_CHROME.BORDER} ${CONNECTORS_CHROME.FILL} ${CONNECTORS_CHROME.ON_FILL}`
                        : 'border-pana-ink/30 text-pana-ink/50'
                    }`}
                  >
                    Tier {tier.id}
                  </span>
                  <span
                    className={
                      tier.id === TIER_ONE.id
                        ? 'font-bold'
                        : 'text-pana-ink/60'
                    }
                  >
                    {tier.name}
                  </span>
                </li>
              ))}
            </ol>
          </section>

          <div className="flex flex-wrap items-center gap-4">
            <MockButton>Send this to my pod</MockButton>
            <p className="text-pana-ink/60 text-sm">
              Your pod lead gets in touch — the programme runs on people, not on
              an approval queue.
            </p>
          </div>
        </form>

        <p className="text-pana-ink/60 mt-10 text-sm leading-relaxed">
          Already a connector?{' '}
          <SurfaceLink
            href="/connectors/hq?as=connector"
            className="text-pana-ink font-bold underline underline-offset-4"
          >
            Open Connector HQ
          </SurfaceLink>
          .
        </p>
      </div>
    </main>
  );
}

/** One numbered question, with its own rule above it. */
function Step({
  number,
  title,
  lede,
  children,
}: {
  number: number;
  title: string;
  lede: string;
  children: ReactNode;
}) {
  return (
    <section>
      <div className="flex items-baseline gap-3">
        <span
          className={`rounded-full border-2 ${CONNECTORS_CHROME.BORDER} ${CONNECTORS_CHROME.FILL} px-2.5 py-0.5 text-xs font-extrabold ${CONNECTORS_CHROME.ON_FILL}`}
        >
          {number}
        </span>
        <h2 className="text-xl leading-tight font-extrabold">{title}</h2>
      </div>
      <p className="text-pana-ink/70 mt-2 text-sm leading-relaxed">{lede}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** A plain radio card, for choices that have no colour of their own. */
function Choice({
  name,
  value,
  title,
  detail,
}: {
  name: string;
  value: string;
  title: string;
  detail: string;
}) {
  return (
    <label className="border-pana-ink bg-pana-cream flex cursor-default items-start gap-2.5 rounded-xl border-2 px-4 py-3">
      <input
        type="radio"
        name={name}
        value={value}
        disabled
        className="border-pana-ink mt-0.5 size-4 shrink-0 border-2"
      />
      <span>
        <span className="block text-base leading-tight font-extrabold">
          {title}
        </span>
        <span className="text-pana-ink/60 mt-0.5 block text-sm">{detail}</span>
      </span>
    </label>
  );
}
