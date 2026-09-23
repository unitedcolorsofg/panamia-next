/**
 * The homepage's content, assembled from the `home` translation namespace.
 *
 * Every word this page says is lifted from the Community Connectors Program
 * deck (2026) rather than written for the web. That is deliberate: the
 * argument this page makes is that the homepage should say what the
 * organisation already says to the people it onboards, instead of the softer
 * marketing copy it used to carry. Paraphrasing would have quietly lost that
 * argument.
 *
 * Source slides, in deck order:
 *  - "THE LOCAL MOVEMENT"      → the "Why local?" stop, and the benefits ring
 *  - "THE FUTURE IS LOCAL!"    → the mission line in "Why was Pana MIA started?"
 *  - "BUT WHAT IS A PANA?"     → the "What's a pana?" stop, both sides
 *  - "THE FUTURE OF PANA MIA"  → all three pillars and their programme lists
 *  - "FINAL MESSAGE FROM US"   → the ground-zero line
 *
 * Deck wording is kept verbatim where it is already good and only tightened
 * where a slide's line break made it read oddly as a paragraph. Two small
 * fixes are carried silently because they are typos rather than voice:
 * "community project" → "community projects", and "a communities' agency" →
 * "a community's agency".
 *
 * The split between this file and the `home.json` locale files is copy
 * versus structure. Anything a translator would need to change lives in the JSON;
 * anything a translator would break by changing — ids, panel colours, which
 * side of the street a stop sits on, image paths, hrefs, whether a programme
 * has shipped — lives here. That is also why the programme lists are keyed
 * rather than indexed: a translator reordering an array should not silently
 * move a live link onto an unbuilt programme.
 */

'use client';

import { useTranslation } from 'react-i18next';

/* -------------------------------------------------------------------------
   Types
   ------------------------------------------------------------------------- */

/** A block inside an opened stop. A tagged union rather than four optional
    fields, so the body is a `switch` instead of a pile of `&&`. */
export type NoteBlock =
  | { kind: 'paragraph'; text: string }
  | { kind: 'numbered'; label: string; items: string[] }
  | { kind: 'list'; label: string; items: string[] }
  | { kind: 'tags'; label: string; items: string[] };

/**
 * The artwork that answers each question.
 *
 * A tagged union rather than a shared `image` field, because these three are
 * not the same kind of picture doing three jobs — they are three different
 * arguments. A photograph of a room proves a word means people; a diagram
 * proves a claim has parts; a map proves a place is a real place. Giving them
 * one shape would have meant one renderer hedging across all three.
 */
export type BeatScene =
  | {
      /** Overlapping photographs, fanned out. "What is a pana" is answered
          better by a room full of them than by any definition. */
      kind: 'collage';
      photos: { src: string; alt: string; caption: string }[];
    }
  | {
      /** The circular diagram from the deck's "THE LOCAL MOVEMENT" slide,
          rebuilt as vector so it stays crisp and can draw itself in. */
      kind: 'ring';
      centre: string;
      items: string[];
    }
  | {
      /** The branded state map, rising into frame on scroll. */
      kind: 'map';
      src: string;
      alt: string;
      counties: string[];
    };

export interface StoryBeat {
  id: string;
  /** Optional DOM id, for stops that inherit an anchor the old page owned.
      The sign-in page has been sending people to `/#faq-what-is-a-pana`
      since the FAQ existed, and that link is out in the world; the stop that
      answers the same question keeps the anchor alive rather than dropping
      those visitors at the top of the page. */
  anchor?: string;
  /** Which side of the street this one sits on. Alternating puts the artwork
      left, right, left as you walk down, instead of three identical rows. */
  side: 'left' | 'right';
  /** Panel colour. One warm, one blue, one paper — so the three read as three
      different buildings rather than a repeated card. */
  accent: 'orange' | 'blue' | 'paper';
  /** The sign over the door, phrased the way a first-time visitor would ask. */
  question: string;
  /** Pronunciation or aside printed under the question. */
  aside?: string;
  /** The answer on the face of the building, readable without opening it. */
  answer: string;
  /** Label on the disclosure, so each stop names its own payoff. */
  more: string;
  /** What is inside, revealed when the stop is opened. */
  detail: NoteBlock[];
  scene: BeatScene;
}

export interface PillarProgram {
  name: string;
  /** One line on what it is. Not in the deck: the deck lists names only, and
      a bare name means nothing to someone landing here for the first time. */
  note: string;
  /** Omitted when the programme has no destination on this site yet. */
  href?: string;
  /** `live` is reachable today; `building` is named but not yet shipped. */
  status: 'live' | 'building';
  /** Rendered next to the name. Translated, so it is passed in rather than
      decided in the panel. */
  statusLabel: string;
}

export interface Pillar {
  id: string;
  /** The deck's name for the pillar. */
  name: string;
  /** Fill colour for the panel. Each pillar is a solid block rather than a
      tint of the band behind it — a 7%-ink panel on cream was easy to scroll
      straight past. Three fills that stay apart from each other in a row, and
      each takes the text colour that clears AA on it. */
  accent: 'blue' | 'orange' | 'coral';
  /** The condition this pillar answers, in the deck's words. */
  problem: string;
  /** What Pana MIA does about it, in the deck's words. */
  answer: string;
  programs: PillarProgram[];
}

/* -------------------------------------------------------------------------
   Structure
   ------------------------------------------------------------------------- */

/** Photographs for the "what's a pana" collage. Paths are structure; the alt
    text and captions underneath them are copy. */
const PANA_PHOTOS = [
  '/img/impact/hero-mixer.webp',
  '/img/impact/pana-social-dinner.webp',
  '/img/impact/community-group.webp',
  '/img/about/clari_and_anette.webp',
] as const;

/* `floridamap_panamia.jpg` is the other candidate and it is the more heavily
   branded of the two, but its highlighted counties are hot pink — a colour
   that is not in this palette. This one is the ink silhouette with the three
   counties marked in red, orange and blue, which is the palette almost
   exactly. It carries its own county labels, so the tag row underneath is
   dropped rather than repeated. */
const COUNTY_MAP_SRC = '/img/impact/county-map.webp';

/** Which programmes are reachable today, and where they point. Kept out of
    the translation files so a live link cannot be translated into a dead one.
    `panaSocial` points at the feed mock rather than the real surface, which
    lives on the `social.` subdomain. */
const PROGRAM_LINKS: Record<
  string,
  { href?: string; status: 'live' | 'building' }
> = {
  directory: { href: '/directory/search', status: 'live' },
  panaSocial: { href: '/mock/feed', status: 'building' },
  connectors: { status: 'building' },
  events: { href: 'https://shotgun.live/venues/pana-mia-club', status: 'live' },
  press: { status: 'building' },
  newsletter: { status: 'building' },
  projects: { status: 'building' },
};

const PILLAR_SHAPE: {
  id: string;
  accent: Pillar['accent'];
  programs: string[];
}[] = [
  { id: 'tech', accent: 'blue', programs: ['directory', 'panaSocial'] },
  /* The light one in the middle, so the row alternates rather than putting
     the two strongest fills next to each other. */
  { id: 'community', accent: 'orange', programs: ['connectors', 'events'] },
  {
    id: 'culture',
    accent: 'coral',
    programs: ['press', 'newsletter', 'projects'],
  },
];

/* -------------------------------------------------------------------------
   Assembly
   ------------------------------------------------------------------------- */

/** i18next hands back the raw value for `returnObjects`, which TypeScript
    types as a string. Everything read this way is an array of strings in the
    JSON; the guard means a missing or mistyped key renders nothing rather
    than throwing inside a map. */
function stringList(value: unknown): string[] {
  return Array.isArray(value) ? (value as string[]) : [];
}

/**
 * The three stops on the street.
 *
 * Each one's `detail` is a fixed sequence of block kinds — the shape of the
 * answer is part of the argument, not a translation choice — filled from the
 * `beats.*` keys.
 */
export function useStoryBeats(): StoryBeat[] {
  const { t } = useTranslation('home');
  const list = (key: string) =>
    stringList(t(key, { returnObjects: true }) as unknown);

  return [
    {
      id: 'pana',
      anchor: 'faq-what-is-a-pana',
      side: 'left',
      accent: 'orange',
      question: t('beats.pana.question'),
      aside: t('beats.pana.aside'),
      answer: t('beats.pana.answer'),
      more: t('beats.pana.more'),
      scene: {
        kind: 'collage',
        photos: PANA_PHOTOS.map((src, index) => ({
          src,
          alt: t(`beats.pana.photos.${index}.alt`),
          caption: t(`beats.pana.photos.${index}.caption`),
        })),
      },
      detail: [
        {
          kind: 'numbered',
          label: t('beats.pana.definition.label'),
          items: list('beats.pana.definition.items'),
        },
        {
          kind: 'list',
          label: t('beats.pana.practice.label'),
          items: list('beats.pana.practice.items'),
        },
      ],
    },
    {
      id: 'why',
      side: 'right',
      accent: 'blue',
      question: t('beats.why.question'),
      answer: t('beats.why.answer'),
      more: t('beats.why.more'),
      /* The deck draws this ring on the "THE LOCAL MOVEMENT" slide, where it
         sits beside the "why local" argument. It is carried here instead, on
         the ask of the panas who walked through the deck: read as artwork it
         is the club's own thesis — the four things the whole project exists
         to produce, with the logo in the middle of them — which is a better
         answer to "why was this started" than to "why local". The four labels
         are therefore no longer repeated as tags on the third stop. */
      scene: {
        kind: 'ring',
        centre: t('beats.why.ring.centre'),
        items: list('beats.why.ring.items'),
      },
      detail: [
        { kind: 'paragraph', text: t('beats.why.mission') },
        { kind: 'paragraph', text: t('beats.why.invitation') },
        {
          kind: 'tags',
          label: t('beats.why.values.label'),
          items: list('beats.why.values.items'),
        },
      ],
    },
    {
      id: 'local',
      side: 'left',
      accent: 'paper',
      question: t('beats.local.question'),
      answer: t('beats.local.answer'),
      more: t('beats.local.more'),
      scene: {
        kind: 'map',
        src: COUNTY_MAP_SRC,
        alt: t('beats.local.mapAlt'),
        counties: [],
      },
      detail: [
        {
          kind: 'list',
          label: t('beats.local.effects.label'),
          items: list('beats.local.effects.items'),
        },
      ],
    },
  ];
}

/** The three pillars from "The Future of Pana MIA". */
export function usePillars(): Pillar[] {
  const { t } = useTranslation('home');

  return PILLAR_SHAPE.map(({ id, accent, programs }) => ({
    id,
    accent,
    name: t(`pillars.${id}.name`),
    problem: t(`pillars.${id}.problem`),
    answer: t(`pillars.${id}.answer`),
    programs: programs.map((programId) => {
      const link = PROGRAM_LINKS[programId];
      return {
        name: t(`pillars.${id}.programs.${programId}.name`),
        note: t(`pillars.${id}.programs.${programId}.note`),
        href: link.href,
        status: link.status,
        statusLabel: t(`programStatus.${link.status}`),
      };
    }),
  }));
}
