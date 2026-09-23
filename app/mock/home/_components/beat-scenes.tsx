'use client';

import Image from 'next/image';
import type { BeatScene } from '../_data';

/**
 * The artwork for each of the three places.
 *
 * One component per scene kind rather than one that branches internally,
 * because these have almost nothing in common: a fanned stack of photographs,
 * a drawn diagram and a map do not share a layout, a motion or a reason for
 * being there. The union in `_data.ts` is what keeps them interchangeable at
 * the call site.
 */
export function BeatSceneArt({ scene }: { scene: BeatScene }) {
  switch (scene.kind) {
    case 'collage':
      return <CollageScene scene={scene} />;
    case 'ring':
      return <RingScene scene={scene} />;
    case 'map':
      return <MapScene scene={scene} />;
  }
}

/* -------------------------------------------------------------------------
   Collage — "what's a pana?"
   ------------------------------------------------------------------------- */

/**
 * Four photographs, stacked and fanned.
 *
 * The answer to "what is a pana" is a room full of them, so this is the one
 * scene that is photographic. They overlap deliberately: four tidy thumbnails
 * would read as a gallery, and a gallery is a list of events. A stack reads
 * as a pile of evidence.
 *
 * Each print carries its own `--fan` rotation and settles towards zero as it
 * comes up the page, so the stack opens out as you arrive at it. Hovering any
 * one of them brings it forward and straightens it on its own.
 */
function CollageScene({
  scene,
}: {
  scene: Extract<BeatScene, { kind: 'collage' }>;
}) {
  return (
    <ul className="collage">
      {scene.photos.map((photo, i) => (
        <li
          key={photo.src}
          className="collage-print"
          style={
            {
              '--fan': `${[-7, 4.5, -3, 8][i] ?? 0}deg`,
              '--lift': `${[0, 18, 8, 26][i] ?? 0}px`,
            } as React.CSSProperties
          }
        >
          <div className="collage-frame">
            <Image
              src={photo.src}
              alt={photo.alt}
              fill
              sizes="(max-width: 768px) 45vw, 22vw"
              className="collage-img"
            />
          </div>
          <span className="collage-caption">{photo.caption}</span>
        </li>
      ))}
    </ul>
  );
}

/* -------------------------------------------------------------------------
   Ring — "why was Pana MIA started?"
   ------------------------------------------------------------------------- */

/** A circular arc as an SVG path. Degrees run clockwise from twelve o'clock,
    which is how the labels are positioned too, so the two stay in step. */
function arcPath(r: number, from: number, to: number) {
  const point = (deg: number) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return [160 + r * Math.cos(rad), 160 + r * Math.sin(rad)] as const;
  };
  const [x1, y1] = point(from);
  const [x2, y2] = point(to);
  const large = Math.abs(to - from) > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
}

const RING_COLOURS = [
  'var(--story-orange)',
  'var(--story-coral)',
  'var(--story-red)',
  'var(--story-blue)',
];

/* Four arcs at the quarters, each an 80° run with a 10° gap either side. The
   gaps are what make it read as a cycle of four things rather than a pie
   chart of one thing, and they line up with the four labels outside. */
const RING_ARCS = [
  [-40, 40],
  [50, 130],
  [140, 220],
  [230, 310],
] as const;

const RING_AT = ['top', 'right', 'bottom', 'left'] as const;

/**
 * The benefits ring from the deck.
 *
 * Rebuilt as vector rather than cropped out of the slide. The slide is a
 * 2000px screenshot of a presentation: dropping a piece of it onto the page
 * would have brought the deck's own type, its own spacing and a JPEG's worth
 * of edge artefacts into the middle of a section that is otherwise drawn. As
 * vector it takes the palette, stays sharp at any width, and can draw itself
 * in as you reach it.
 *
 * The labels are HTML rather than SVG text so they wrap, inherit the page's
 * type, and can be read in order by a screen reader — `text` on a path does
 * none of those things well.
 */
function RingScene({ scene }: { scene: Extract<BeatScene, { kind: 'ring' }> }) {
  return (
    <div className="beat-ring">
      <svg className="ring-dial" viewBox="0 0 320 320" aria-hidden="true">
        {RING_ARCS.map(([from, to], i) => (
          <path
            key={i}
            d={arcPath(128, from, to)}
            className="ring-arc"
            pathLength={100}
            style={{ stroke: RING_COLOURS[i] }}
          />
        ))}

        {/* The inner disc the logo sits on, and a hairline to tie it to the
            arcs without competing with them. */}
        <circle cx="160" cy="160" r="86" className="ring-hub" />
        <circle cx="160" cy="160" r="99" className="ring-hairline" />
      </svg>

      <div className="ring-centre">
        {/* Set rather than placed. Every logo in `public/logos` is either a
            horizontal lockup, which will not sit in a round hub, or the pink
            palm mark, and pink is not in this palette — so the club's name is
            typeset here in the page's own face and colour. */}
        <span className="ring-centre-name">{scene.centre}</span>
      </div>

      {/* Listed, not just positioned: read linearly these are the four things
          the club exists to produce, and that is worth having as a list. */}
      <ul className="ring-labels">
        {scene.items.map((item, i) => (
          <li
            key={item}
            className="ring-label"
            data-at={RING_AT[i]}
            style={{ '--dot': RING_COLOURS[i] } as React.CSSProperties}
          >
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* -------------------------------------------------------------------------
   Map — "why local?"
   ------------------------------------------------------------------------- */

/**
 * Florida, rising.
 *
 * The map comes up from below its own frame as the section scrolls in, which
 * is the one piece of motion on the page that is doing an argument rather
 * than a flourish: the answer to "why local" is that this is a real, bounded
 * place with three counties in it, and having the state physically arrive
 * makes that point before the paragraph next to it does.
 *
 * The counties are listed under it south-first, the way the site orders them
 * everywhere else.
 */
function MapScene({ scene }: { scene: Extract<BeatScene, { kind: 'map' }> }) {
  return (
    <figure className="statemap">
      <div className="statemap-frame">
        <Image
          src={scene.src}
          alt={scene.alt}
          width={800}
          height={600}
          className="statemap-img"
          sizes="(max-width: 768px) 70vw, 30vw"
        />
      </div>
      {scene.counties.length > 0 && (
        <figcaption className="statemap-counties">
          {scene.counties.map((county) => (
            <span key={county} className="statemap-county">
              {county}
            </span>
          ))}
        </figcaption>
      )}
    </figure>
  );
}
