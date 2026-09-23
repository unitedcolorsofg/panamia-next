'use client';

import { useState, type CSSProperties, type FormEvent } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ArrowRight, HeartHandshake, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ScrollReveal from '@/components/scroll-reveal';
import { countyList } from '@/lib/lists';
import { searchPath } from '@/lib/directory-search-path';
import { MockControls, type Density } from './mock-controls';
import { StoryBeats } from './story-beats';
import { SkyClouds, StreetScene } from './scene-art';
import { PillarPanels } from './pillar-panels';
import { pillars, storyBeats } from '../_data';

/**
 * Design mock for the homepage, told as one continuous scene.
 *
 * The live page runs eleven sections. This one runs four, because the panas
 * who came over with the Community Connectors deck were describing a front
 * page that answers three questions in order and then asks for something:
 *
 *   1. Search        — what are you looking for? (unchanged, it already works)
 *   2. The street    — what is this place, and why does it exist?
 *   3. The pillars   — what is actually being built?
 *   4. The point     — so join, or subscribe.
 *
 * The scene is the newer idea and the load-bearing one. Pana MIA's whole
 * argument is about a physical place — these counties, these blocks, the
 * people on them — and the page was making that argument entirely in prose
 * on a flat background. So the page now starts in the sky, comes down past a
 * row of houses, shops and a park, and walks you along it. The sections did
 * not move; the ground under them arrived.
 *
 * That also fixes something the sticky notes could not. Three small squares
 * could hold a photograph or a sentence, but the club's case for itself is a
 * room full of people, a diagram, and a map — and none of those fit on a
 * square. Each answer now gets a full-width stop with its own artwork.
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
 * Nothing here reads the database. The search bar navigates to the real
 * results page but drops the typeahead, so this route stays a fixture: see
 * the comment on the form below.
 *
 * On density: the live site's vertical rhythm is a full-viewport hero plus
 * `py-16 md:py-24` on every band, which is where most of the page's empty
 * space comes from. Rather than pick a new number here, the bar carries a
 * switch: `compact` is the proposal, `roomy` is what the live site does
 * today, and the two are a click apart so the difference can be judged
 * rather than argued about. Only the rhythm changes — no copy, no colour,
 * nothing reflows to a different layout.
 */
export function HomeMock() {
  const [density, setDensity] = useState<Density>('compact');

  return (
    <>
      <MockControls density={density} onDensityChange={setDensity} />
      <ScrollReveal />

      <div className="flex min-h-screen flex-col" data-density={density}>
        <HeroCard />
        <StreetBand />
        <InfoCard />
        <PillarsCard />
        <PointCard />

        {/* Every mock says where it came from, so a screenshot taken out of
            context still names its own route. */}
        <p className="story-colophon py-6 text-center text-xs font-bold tracking-wider uppercase opacity-55">
          Design mock · /mock/home · not a live page
        </p>
      </div>
    </>
  );
}

/* -------------------------------------------------------------------------
   1. Search
   ------------------------------------------------------------------------- */

function HeroCard() {
  const router = useRouter();
  const [term, setTerm] = useState('');

  // The live hero uses <DirectorySuggest>, which calls /api/directory/suggest
  // on every keystroke. That is the right component for the real page and the
  // wrong one here: a mock that queries the database is a mock whose empty
  // states depend on what is in the database that afternoon. The submit still
  // goes to the real results page, because a search box that goes nowhere is
  // not a search box a reviewer can judge.
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    router.push(searchPath(term));
  };

  return (
    /* No scalloped trim across the top. The scallop is a good edge when two
       different colours meet and the seam is worth decorating — it is how
       `.point` announces itself against the section above. Here the masthead
       and the top of this card are the same colour, so there is no seam to
       dress: the trim was drawing an edge rather than finishing one, which
       made the card read as a shape pasted onto the page instead of the top
       of it.

       The field behind the search is sky — see `.home-hero-field`. It runs
       vivid blue at the very top and eases to paper by the time it reaches
       the headline, so the page opens outdoors but the wordmark, the type
       and the search all sit on cream where they are legible. Orange on that
       blue is a poor pairing and the search is the one thing this card is
       for; the gradient exists so the sky never gets near it. */
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
          The Future
          <br />
          Is <em className="accent-word">Local</em>
        </h1>

        <div className="mx-auto mt-4 max-w-[760px]">
          <p className="hero-subheadline">
            South Florida&rsquo;s first local directory — a living archive of
            the creatives, entrepreneurs and small businesses who make this
            place what it is.
          </p>

          <form onSubmit={handleSubmit} className="mt-[18px]">
            <label htmlFor="mock-home-search" className="sr-only">
              Search the directory
            </label>
            <div className="directory-suggest-pill">
              <Search
                className="text-pana-ink ml-6 h-5 w-5 shrink-0 opacity-45"
                aria-hidden="true"
              />
              <input
                id="mock-home-search"
                type="search"
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                placeholder="Search by name, category, products"
                autoComplete="off"
                className="text-pana-ink min-w-0 flex-1 border-0 bg-transparent px-4 py-[18px] text-[16.5px] font-semibold outline-none placeholder:font-medium placeholder:text-[rgb(17_13_13_/_0.45)]"
              />
              <button type="submit" className="directory-suggest-pill-button">
                Search
              </button>
            </div>
          </form>

          <div className="hero-meta">
            <div className="flex flex-wrap items-center justify-center gap-3">
              {/* Reversed so the list opens on Miami-Dade, as on the live
                  page — `countyList` is ordered north to south. */}
              {[...countyList].reverse().map((county) => (
                <Link
                  key={county.value}
                  href={`/directory/search?floc=${county.value}`}
                  className="tagpill"
                >
                  {county.desc}
                </Link>
              ))}

              {/* New, and the one thing in this card the sketch adds: a
                  standing ask that does not wait for the bottom of the page.
                  `/donate` is the real route — it is already in the header
                  menu and the footer, just nowhere anyone looks. Deliberately
                  a quiet chip rather than a button: it sits beside the
                  counties instead of competing with the search. */}
              <Link href="/donate" className="tagpill hero-donate">
                <HeartHandshake className="h-4 w-4" aria-hidden="true" />
                Donate
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------
   The street
   ------------------------------------------------------------------------- */

/**
 * The block the rest of the page stands on.
 *
 * It is its own band rather than decoration bolted to the bottom of the hero
 * or the top of the next section, because it belongs to neither: it is the
 * horizon the search sits above and the ground the three stops sit on, and
 * making it a section of its own is what lets both of those be true without
 * either one owning it.
 *
 * The scroll hint moved down here from the hero's meta line. It was competing
 * with the county chips for the same corner; on the street it has a job,
 * which is to say that the drawing is not the end of the page.
 */
function StreetBand() {
  return (
    <section className="story-street" aria-label="Pana Mia's neighbourhood">
      <StreetScene />
      <p className="story-street-note">Scroll ↓ · Start with the basics</p>
    </section>
  );
}

/* -------------------------------------------------------------------------
   2. The info card
   ------------------------------------------------------------------------- */

function InfoCard() {
  return (
    <section id="what-is-this" className="home-section story-basics">
      <div className="container mx-auto px-4">
        <div className="home-sectionhead max-w-3xl" data-rv>
          <span className="section-eyebrow">Start Here</span>
          <h2 className="section-display">
            First,
            <br />
            <em className="display-accent">the basics</em>
          </h2>
          <p className="section-lede">
            Three questions everyone asks in their first minute here. Each one
            gets a stop on the block — the answer is right there, and there is
            more behind it if you want it.
          </p>
        </div>
      </div>

      {/* Out of the container on purpose. These run the full width so the
          artwork on each one has room to be artwork rather than a thumbnail
          in a column. */}
      <StoryBeats beats={storyBeats} />
    </section>
  );
}

/* -------------------------------------------------------------------------
   3. The three pillars
   ------------------------------------------------------------------------- */

function PillarsCard() {
  return (
    <section id="pillars" className="home-section story-pillars">
      <div className="container mx-auto px-4">
        <div className="home-sectionhead" data-rv>
          {/* No colour utility here: `.section-eyebrow` hard-codes indigo and
              is unlayered, so it beats one anyway. The section overrides it
              by name in CSS instead. */}
          <span className="section-eyebrow">The Future Of Pana MIA</span>
          <h2 className="section-display">
            Three ways
            <br />
            <em className="display-accent">we build</em>
          </h2>
          <p className="section-lede max-w-2xl">
            Not three departments — three halves of the same argument, that a
            place gets better when the people in it own the tools, the
            gatherings and the stories.
          </p>
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
 * Carried over from the live page without redesign, per the brief. The
 * newsletter capture is still disabled for the same reason it is disabled
 * there: /api/crm/contact/subscribe only re-subscribes an already
 * authenticated contact, so a live input would accept an address and silently
 * drop it.
 */
function PointCard() {
  return (
    <section
      className="home-section story-point scallop"
      style={{ '--scallop': 'var(--story-cream)' } as CSSProperties}
    >
      <div className="container mx-auto px-4" data-rv>
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div>
            <span className="section-eyebrow">The Point</span>
            <h2 className="section-statement mt-6">
              The future isn&rsquo;t coming. It&rsquo;s <em>next door</em>.
            </h2>
          </div>
          <div>
            <p className="section-lede story-point-body">
              Pana MIA is built by and for locally based creatives,
              organizations and small businesses across Broward, Miami-Dade and
              Palm Beach. Join the directory, or start by finding someone
              already in it.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Button
                size="lg"
                asChild
                className="story-btn story-btn-solid rounded-full font-extrabold"
              >
                <Link href="/form/become-a-pana">Become a Pana</Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                asChild
                className="story-btn story-btn-ghost rounded-full border-2 font-extrabold"
              >
                <Link href="/directory/search">Search the directory</Link>
              </Button>
            </div>

            <div className="story-point-rule mt-10 border-t pt-8">
              <span className="section-eyebrow">Our Newsletter</span>
              <p className="section-lede story-point-body mt-4">
                Get new Panas, events and dispatches in your inbox. No noise.
              </p>
              <div className="mt-5 flex max-w-lg flex-wrap items-center gap-3">
                <input
                  type="email"
                  disabled
                  aria-describedby="mock-newsletter-status"
                  placeholder="you@email.com"
                  className="story-point-input min-w-0 flex-1 rounded-full border-2 px-5 py-3 font-semibold disabled:cursor-not-allowed"
                />
                <Button
                  size="lg"
                  disabled
                  className="story-btn story-btn-solid rounded-full font-extrabold"
                >
                  Subscribe
                </Button>
              </div>
              <span
                id="mock-newsletter-status"
                className="coming-soon story-point-accent mt-4"
              >
                Coming soon
              </span>
            </div>

            <Link href="/a" className="link-arrow story-point-accent mt-10">
              Read the dispatches
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
