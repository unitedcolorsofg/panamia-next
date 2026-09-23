'use client';

import type { CSSProperties } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useTranslation, Trans } from 'react-i18next';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DirectorySuggest } from '@/components/directory-suggest';
import { countyList } from '@/lib/lists';
import { StoryBeats } from './story-beats';
import { SkyClouds, StreetScene } from './scene-art';
import { PillarPanels } from './pillar-panels';
import { useStoryBeats, usePillars } from './content';

/**
 * The homepage, told as one continuous scene.
 *
 * The page it replaced ran eleven sections. This one runs four, because the
 * panas who came over with the Community Connectors deck were describing a
 * front page that answers three questions in order and then asks for
 * something:
 *
 *   1. Search        — what are you looking for? (unchanged, it already works)
 *   2. The street    — what is this place, and why does it exist?
 *   3. The pillars   — what is actually being built?
 *   4. The point     — so join, or subscribe.
 *
 * The scene is the newer idea and the load-bearing one. Pana MIA's whole
 * argument is about a physical place — these counties, these blocks, the
 * people on them — and the page was making that argument entirely in prose on
 * a flat background. So the page now starts in the sky, comes down past a row
 * of houses, shops and a park, and walks you along it. The sections did not
 * move; the ground under them arrived.
 *
 * What the four-card cut costs, and where it goes:
 *
 * - The category index, Featured Panas and the events band all restate the
 *   directory, which the search at the top already opens. They belong on
 *   /directory/search, which is where someone who used the search lands
 *   anyway.
 * - The FAQ's first three rows are now the three stops; the rest are
 *   onboarding questions (cost, eligibility, terms) that belong next to the
 *   join form, not on a front page.
 * - The impact band's figures are still unset, and a row of em dashes is not
 *   worth a fold. It comes back when there is a counts endpoint.
 * - "Community is a form of power" (Gather / Connect / Celebrate) is replaced
 *   outright. It was three verbs written for the site; the pillars are the
 *   organisation's own three-part account of its work, and having both would
 *   be the homepage disagreeing with the deck.
 *
 * The point-and-newsletter section is carried over as-is, per the brief.
 *
 * These are exported as parts rather than as one `<HomePage>` because
 * `/mock/home` renders exactly the same sections inside a density-toggle
 * harness. Sharing the parts is what makes the mock a preview of this page
 * rather than a second copy of it that drifts.
 */

/* -------------------------------------------------------------------------
   1. Search, and the street it stands on
   ------------------------------------------------------------------------- */

/**
 * The first screen: the search card, the town, and the line telling you to
 * keep going.
 *
 * The card and the town are one composition, so they are measured as one:
 * together they are exactly the height of the screen, which puts the street —
 * the ground line, the market, the people — on the bottom edge of the first
 * view at any resolution. Separately they were 79-211px too tall for a laptop
 * and the town's feet were the part that fell off.
 */
export function HomeFirstScreen() {
  const { t } = useTranslation('home');

  return (
    <div className="home-first">
      <HeroCard />
      <StreetBand />
      {/* Last line on the first screen, under the town rather than over it:
          the town is the thing you are being told to scroll past, so the
          instruction reads after it.

          It is a button because it was already an instruction — telling
          someone to scroll and then making them do it by hand is a worse
          version of the same thing. It lands on the next section's top edge
          rather than jumping a viewport, so the answer card arrives framed
          rather than halfway up the screen. */}
      <button
        type="button"
        className="story-street-note"
        onClick={() => {
          const next = document.getElementById('what-is-this');
          if (!next) return;
          const reduced = window.matchMedia(
            '(prefers-reduced-motion: reduce)'
          ).matches;
          next.scrollIntoView({
            behavior: reduced ? 'auto' : 'smooth',
            block: 'start',
          });
        }}
      >
        {t('hero.scrollNote')}
      </button>
    </div>
  );
}

function HeroCard() {
  const { t } = useTranslation('home');

  return (
    /* No scalloped trim across the top. The scallop is a good edge when two
       different colours meet and the seam is worth decorating — it is how
       `.point` announces itself against the section above. Here the masthead
       and the top of this card are the same colour, so there is no seam to
       dress: the trim was drawing an edge rather than finishing one, which
       made the card read as a shape pasted onto the page instead of the top
       of it.

       There is no field behind the search either — no photograph, no wash, no
       sky. The card is the same paper as the masthead above it and the street
       below it, and the only thing drawn on it is a soft pool of orange light
       sitting under the search box. Everything this card has to say is now
       said by four things in a column: the wordmark, the headline, the
       mission and the one box you can type in. */
    <section className="home-hero-banner home-hero-field">
      <SkyClouds />
      <div className="home-hero-grain" aria-hidden="true" />

      <div className="relative z-10 container mx-auto px-4">
        {/* The wordmark ships as white and as four brand colours. On the old
            dark field the white file was the only one that held; on cream the
            orange can be used as it is, which is also the file the site
            header uses — so the two agree now instead of one being a black
            silhouette of the other. */}
        <Image
          src="/logos/pana_logo_long_orange.png"
          alt="Pana Mia"
          width={600}
          height={150}
          className="flower-power-logo mx-auto mb-8 h-auto w-full max-w-[min(26rem,70vw)] md:mb-10"
          priority
        />

        <h1 className="hero-headline">
          <Trans
            i18nKey="hero.headline"
            t={t}
            components={{ br: <br />, em: <em className="accent-word" /> }}
          />
        </h1>

        <div className="mx-auto mt-4 max-w-[760px]">
          {/* The mission, cut to one line. The full sentence names the three
              groups and the role the club plays between them, which is the
              right level of detail for an about page and one clause too many
              for the first thing anyone reads. What is left is the claim and
              the reason for it; the three stops further down are where the
              groups get named. */}
          <p className="hero-subheadline">{t('hero.mission')}</p>

          <DirectorySuggest
            layout="pill"
            className="mt-[18px]"
            label={t('hero.searchLabel')}
            placeholder={t('hero.searchPlaceholder')}
            ariaLabel={t('hero.searchAriaLabel')}
            buttonLabel={t('hero.searchButton')}
            inputClassName="text-pana-ink h-auto border-0 bg-transparent px-4 py-[18px] text-[16.5px] font-semibold shadow-none placeholder:font-medium placeholder:text-[rgb(17_13_13_/_0.45)] focus-visible:ring-0 md:text-[16.5px]"
          />
        </div>
      </div>
    </section>
  );
}

/**
 * The block the rest of the page stands on.
 *
 * It is its own band rather than decoration bolted to the bottom of the hero
 * or the top of the next section, because it belongs to neither: it is the
 * horizon the search sits above and the ground the three stops sit on, and
 * making it a section of its own is what lets both of those be true without
 * either one owning it.
 *
 * It has no fixed height. It takes whatever the card leaves of the first
 * screen, and the drawing crops rather than scales to fill it, so the street
 * lands on the bottom edge of the screen at any resolution.
 */
function StreetBand() {
  const { t } = useTranslation('home');

  return (
    <section className="story-street" aria-label={t('street.label')}>
      <StreetScene />
    </section>
  );
}

/* -------------------------------------------------------------------------
   2. The three stops
   ------------------------------------------------------------------------- */

export function HomeBasics() {
  const { t } = useTranslation('home');
  const beats = useStoryBeats();

  return (
    <section id="what-is-this" className="home-section story-basics">
      <div className="container mx-auto px-4">
        {/* Just the question. This section used to open with an eyebrow, a
            two-line display heading and a lede explaining that three
            questions follow — three lines of preamble in front of three
            cards that ask and answer their own questions perfectly well.
            The preamble was the least useful thing on the screen and it was
            the thing costing the most height. */}
        <div className="home-sectionhead" data-rv>
          <h2 className="section-display">
            <Trans
              i18nKey="basics.title"
              t={t}
              components={{ em: <em className="display-accent" /> }}
            />
          </h2>
        </div>
      </div>

      {/* Out of the container on purpose. These run the full width so the
          artwork on each one has room to be artwork rather than a thumbnail
          in a column. */}
      <StoryBeats beats={beats} />
    </section>
  );
}

/* -------------------------------------------------------------------------
   3. The three pillars
   ------------------------------------------------------------------------- */

export function HomePillars() {
  const { t } = useTranslation('home');
  const pillars = usePillars();

  return (
    <section id="pillars" className="home-section story-pillars">
      <div className="container mx-auto px-4">
        <div className="home-sectionhead" data-rv>
          {/* No colour utility here: `.section-eyebrow` hard-codes indigo and
              is unlayered, so it beats one anyway. The section overrides it by
              name in CSS instead. */}
          <span className="section-eyebrow">{t('pillarsBand.eyebrow')}</span>
          <h2 className="section-display">
            <Trans
              i18nKey="pillarsBand.title"
              t={t}
              components={{ br: <br />, em: <em className="display-accent" /> }}
            />
          </h2>
          <p className="section-lede max-w-2xl">{t('pillarsBand.lede')}</p>
        </div>

        <div data-rv>
          <PillarPanels pillars={pillars} />
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------
   4. The point, and the newsletter
   ------------------------------------------------------------------------- */

/**
 * Carried over from the previous homepage without redesign, per the brief.
 * The newsletter capture is still disabled for the same reason it was
 * disabled there: /api/crm/contact/subscribe only re-subscribes an already
 * authenticated contact, so a live input would accept an address and silently
 * drop it.
 */
export function HomePoint() {
  const { t } = useTranslation('home');

  return (
    <section
      className="home-section story-point scallop"
      style={{ '--scallop': 'var(--story-cream)' } as CSSProperties}
    >
      <div className="container mx-auto px-4" data-rv>
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div>
            <span className="section-eyebrow">{t('closing.eyebrow')}</span>
            <h2 className="section-statement mt-6">
              <Trans
                i18nKey="closing.statement"
                t={t}
                components={{ em: <em /> }}
              />
            </h2>
          </div>
          <div>
            <p className="section-lede story-point-body">{t('closing.lede')}</p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Button
                size="lg"
                asChild
                className="story-btn story-btn-solid rounded-full font-extrabold"
              >
                <Link href="/form/become-a-pana">{t('closing.ctaJoin')}</Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                asChild
                className="story-btn story-btn-ghost rounded-full border-2 font-extrabold"
              >
                <Link href="/directory/search">{t('closing.ctaBrowse')}</Link>
              </Button>
            </div>

            <div className="story-point-rule mt-10 border-t pt-8">
              <span className="section-eyebrow">{t('newsletter.eyebrow')}</span>
              <p className="section-lede story-point-body mt-4">
                {t('newsletter.lede')}
              </p>
              <div className="mt-5 flex max-w-lg flex-wrap items-center gap-3">
                <input
                  type="email"
                  disabled
                  aria-describedby="home-newsletter-status"
                  placeholder={t('newsletter.placeholder')}
                  className="story-point-input min-w-0 flex-1 rounded-full border-2 px-5 py-3 font-semibold disabled:cursor-not-allowed"
                />
                <Button
                  size="lg"
                  disabled
                  className="story-btn story-btn-solid rounded-full font-extrabold"
                >
                  {t('newsletter.cta')}
                </Button>
              </div>
              <span
                id="home-newsletter-status"
                className="coming-soon story-point-accent mt-4"
              >
                {t('comingSoon')}
              </span>
            </div>

            <Link href="/a" className="link-arrow story-point-accent mt-10">
              {t('closing.dispatches')}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------
   5. Where to go next
   ------------------------------------------------------------------------- */

/**
 * The county shortcuts and the donate ask.
 *
 * These four used to sit under the search bar. They were the first thing
 * below the mission and they were competing with the search field for the
 * same job — "pick a county" is a narrower version of "search" — while Donate
 * was asking for money from someone who had not yet been told what the club
 * does. Both were in the wrong place, not wrong.
 *
 * Down here they are in the right one. The page has made its case by now, so
 * a reader arriving at this row has either finished it or scrolled to the
 * bottom looking for exactly this kind of thing. It is the last band before
 * the footer and it does what the footer cannot: it offers the two concrete
 * next moves, at a size you can hit.
 *
 * Donate is set apart rather than styled as a fourth county, because it is a
 * different kind of ask and reading it as one of four would be a trap.
 */
export function HomeLocalRow() {
  const { t } = useTranslation('home');

  return (
    <section className="home-section story-localrow">
      <div className="container mx-auto px-4" data-rv>
        <div className="localrow-inner">
          <div className="localrow-group">
            <span className="localrow-label">{t('localRow.countyLabel')}</span>
            <div className="localrow-links">
              {countyList.map((county) => (
                <Link
                  key={county.value}
                  href={`/directory/search?floc=${county.value}`}
                  className="localrow-chip"
                >
                  {county.desc}
                </Link>
              ))}
            </div>
          </div>

          <div className="localrow-group localrow-group-give">
            <span className="localrow-label">{t('localRow.giveLabel')}</span>
            <Link href="/donate" className="localrow-chip localrow-chip-give">
              {t('localRow.donate')}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
