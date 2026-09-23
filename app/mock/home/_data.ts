/**
 * Fixtures for the homepage mock.
 *
 * Every word below is lifted from the Community Connectors Program deck
 * (2026) rather than written for this page. That is deliberate: the argument
 * this mock is making is that the homepage should say what the organisation
 * already says to the people it onboards, instead of the softer marketing copy
 * it currently carries. Paraphrasing here would have quietly lost that
 * argument.
 *
 * Source slides, in deck order:
 *  - "THE LOCAL MOVEMENT"      → the "Why local?" note
 *  - "THE FUTURE IS LOCAL!"    → the mission line in "Why was Pana MIA started?"
 *  - "BUT WHAT IS A PANA?"     → the "What's a pana?" note, both sides
 *  - "THE FUTURE OF PANA MIA"  → all three pillars and their programme lists
 *  - "FINAL MESSAGE FROM US"   → the ground-zero line
 *
 * Deck wording is kept verbatim where it is already good and only tightened
 * where a slide's line break made it read oddly as a paragraph. Two small
 * fixes are carried over silently because they are typos rather than voice:
 * "community project" → "community projects", and "a communities' agency" →
 * "a community's agency".
 */

/* -------------------------------------------------------------------------
   The info card — sticky notes
   ------------------------------------------------------------------------- */

/** A block inside an opened note. A tagged union rather than four optional
    fields, so the note body is a `switch` instead of a pile of `&&`. */
export type NoteBlock =
  | { kind: 'paragraph'; text: string }
  | { kind: 'numbered'; label: string; items: string[] }
  | { kind: 'list'; label: string; items: string[] }
  | { kind: 'tags'; label: string; items: string[] };

export interface StickyNote {
  id: string;
  /** Sticky-note colour. Warm tones only — all three carry ink text. */
  tone: 'butter' | 'flame' | 'cream';
  /** Degrees of tilt on the pinned note. Straightens on hover and focus. */
  tilt: number;
  /** The snapshot stuck to the note. Real photographs from the impact report
      rather than stock: the question "what's a pana" is answered better by a
      room full of them than by any definition underneath it. The polaroid
      counter-rotates against `tilt`, so these two fields are related. */
  photo: {
    src: string;
    alt: string;
    /** The line in the polaroid's bottom band. Short — it is a caption on a
        photograph, not a second answer. */
    caption: string;
  };
  /** The question the way a first-time visitor would actually ask it. */
  question: string;
  /** Pronunciation or aside printed under the question. */
  aside?: string;
  /** The answer on the face of the note, readable without opening anything. */
  answer: string;
  /** Label on the disclosure button, so each note names its own payoff. */
  more: string;
  /** Revealed when the note is opened. */
  detail: NoteBlock[];
}

export const stickyNotes: StickyNote[] = [
  {
    id: 'pana',
    tone: 'butter',
    tilt: -2.2,
    photo: {
      src: '/img/impact/hero-mixer.webp',
      alt: 'Panas gathered around a table at a Pana Mia community mixer',
      caption: 'Mixer night · Miami-Dade',
    },
    question: "What's a pana?",
    aside: '/pah·nah/',
    answer:
      'South American and Caribbean slang for friend. Around here it also means someone who shows up for the place they live.',
    more: 'See the full definition',
    detail: [
      {
        kind: 'numbered',
        label: 'Pana, noun',
        items: [
          'South American/Caribbean slang meaning friend.',
          'A member of the South Florida community that enjoys engaging with and supporting local community projects, small businesses, and creators.',
          'Someone that advocates for Pana MIA and the local movement.',
        ],
      },
      {
        kind: 'list',
        label: 'What this looks like in practice',
        items: [
          'Switch to local goods and services.',
          'Choose to eat out at local restaurants instead of chains.',
          'Stay informed of local news and events.',
          'Enjoy and advocate for the preservation of the local ecology.',
          'Engage in mutual aid projects.',
        ],
      },
    ],
  },
  {
    id: 'why',
    tone: 'flame',
    tilt: 1.6,
    photo: {
      src: '/img/impact/pana-social-dinner.webp',
      alt: 'A long communal dinner table filled with Pana Mia members',
      caption: 'Long table · Allapattah',
    },
    question: 'Why was Pana MIA started?',
    answer:
      'So that nobody with an idea for how to make South Florida better had to start at ground zero.',
    more: 'Read the mission',
    detail: [
      {
        kind: 'paragraph',
        text: 'Pana MIA Club serves as a community connector to promote everything local in South Florida — small businesses, creatives, and organizations — in order to achieve a more regenerative future.',
      },
      {
        kind: 'paragraph',
        text: 'Use this community to launch your ideas, get feedback, and grow skills, all for the benefit of South Florida. We don’t believe in competition and we reject the scarcity mindset.',
      },
      {
        kind: 'tags',
        label: 'What we hold to',
        items: [
          'Collaborative over competitive',
          'Abundance over scarcity',
          'Joy and care as resistance',
          'Horizontal growth',
          'Mutual respect',
        ],
      },
    ],
  },
  {
    id: 'local',
    tone: 'cream',
    tilt: -1.1,
    photo: {
      src: '/img/impact/county-map.webp',
      alt: 'Map of the three South Florida counties Pana Mia covers',
      caption: 'Broward · Miami-Dade · Palm Beach',
    },
    question: 'Why local?',
    answer:
      'Because communities know their own needs best, and they are the ones best equipped to meet them.',
    more: 'See what local does',
    detail: [
      {
        kind: 'list',
        label: 'Supporting local means',
        items: [
          'More money stays in the regional economy, and goes to households rather than extractive global corporations.',
          'Businesses stay beholden to the community, and are easier to hold accountable.',
          'More authentic art that preserves the culture of place. It should be a point of pride for our artists not to be starving.',
          'Local food sources, which make all of us more resilient.',
        ],
      },
      {
        kind: 'tags',
        label: 'What it adds up to',
        items: [
          'Economic resilience',
          'Equitable wealth',
          'Environmental benefits',
          'Community well-being',
        ],
      },
    ],
  },
];

/* -------------------------------------------------------------------------
   The three pillars — "The Future of Pana MIA"
   ------------------------------------------------------------------------- */

export interface PillarProgram {
  name: string;
  /** One line on what it is. Not in the deck: the deck lists names only, and
      a bare name means nothing to someone landing here for the first time. */
  note: string;
  /** Omitted when the programme has no destination on this site yet. */
  href?: string;
  /** `live` is reachable today; `building` is named but not yet shipped. */
  status: 'live' | 'building';
}

export interface Pillar {
  id: string;
  /** The deck's name for the pillar. */
  name: string;
  /** Fill colour for the panel. Each pillar is a solid block rather than a
      tint of the wash behind it — a 7%-ink panel on citrus was easy to scroll
      straight past. Kept to the three refresh-palette colours that hold up
      against orange: `red` is a neighbour of burnt and disappears into it. */
  accent: 'indigo' | 'butter' | 'ink';
  /** The condition this pillar answers, in the deck's words. */
  problem: string;
  /** What Pana MIA does about it, in the deck's words. */
  answer: string;
  programs: PillarProgram[];
}

export const pillars: Pillar[] = [
  {
    id: 'tech',
    name: 'Collective Tech',
    accent: 'indigo',
    problem: 'Current tech prioritizes shareholder values.',
    answer:
      'We’re developing platforms that prioritize genuine connection, user data privacy, and ecological wellbeing.',
    programs: [
      {
        name: 'Local’s Directory',
        note: 'Every creative, organization and small business in South Florida, searchable by name, category and neighborhood.',
        href: '/directory/search',
        status: 'live',
      },
      {
        name: 'Pana Social',
        note: 'A local social network that federates, so the community owns its own feed instead of renting one.',
        /* Points at the feed mock rather than the real surface (which lives
           on the `social.` subdomain) so a reviewer clicking through from
           this mock sees the designed feed, not today's. */
        href: '/mock/feed',
        status: 'building',
      },
    ],
  },
  {
    id: 'community',
    name: 'Community Building',
    /* Light between the two darks, so the row alternates rather than putting
       indigo and ink next to each other. */
    accent: 'butter',
    problem: 'People feel disconnected from each other and the land.',
    answer:
      'Our programming focuses on bringing people together to build people power and develop a community’s agency to flourish.',
    programs: [
      {
        name: 'Community Connectors',
        note: 'Pods across Miami-Dade, Broward and Palm Beach running projects for their own neighborhoods. Three tiers of involvement, and everyone starts at tier one.',
        status: 'building',
      },
      {
        name: 'Collaborative Events',
        note: 'Markets, workshops, art builds and gatherings — co-hosted with the people already doing the work.',
        href: 'https://shotgun.live/venues/pana-mia-club',
        status: 'live',
      },
    ],
  },
  {
    id: 'culture',
    name: 'Culture Work',
    accent: 'ink',
    problem: 'Cultural change is lasting change.',
    answer:
      'We support arts projects that encourage collective dreaming and shift the narrative towards celebrating interconnectedness and joy.',
    programs: [
      {
        name: 'Pana Ink Press',
        note: 'Zines, pamphlets and print that explain the local movement in a form anyone can hand to anyone.',
        status: 'building',
      },
      {
        name: 'The Newsletter',
        note: 'New panas, events and dispatches, written by the people they are about.',
        status: 'building',
      },
      {
        name: 'Collaborative Projects',
        note: 'Murals, playlists, solarpunk stories — work that imagines a liberated future for South Florida out loud.',
        status: 'building',
      },
    ],
  },
];
