'use client';

import Image from 'next/image';
import type { BeatScene } from './content';

/**
 * The artwork for each of the three places.
 *
 * One component per scene kind rather than one that branches internally,
 * because these have almost nothing in common: a fanned stack of photographs,
 * a row of portraits, a map and a banner do not share a layout, a motion or a
 * reason for being there. The union in `content.ts` is what keeps them
 * interchangeable at the call site.
 */
export function BeatSceneArt({ scene }: { scene: BeatScene }) {
  switch (scene.kind) {
    case 'collage':
      return <CollageScene scene={scene} />;
    case 'faces':
      return <FacesScene scene={scene} />;
    case 'map':
      return <MapScene scene={scene} />;
    case 'banner':
      return <BannerScene scene={scene} />;
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
   Faces — "why was Pana MIA started?"
   ------------------------------------------------------------------------- */

/* One ring colour per portrait. The first four are the palette the benefits
   diagram used before this stop became photographic; the fifth is the green
   that arrived with the town, so a five-up row gets five colours that are
   already on the page rather than a repeat of the first. */
const FACE_COLOURS = [
  'var(--story-orange)',
  'var(--story-coral)',
  'var(--story-red)',
  'var(--story-blue)',
  'var(--story-green)',
];

/**
 * The people, named.
 *
 * "Why was this started" is a question about intent, and intent belongs to
 * people rather than to a diagram — so this stop answers it with the faces
 * behind the club. It used to hold the deck's benefits ring; those four
 * outcomes are still on this card, they moved into the panel underneath where
 * they read as a list instead of as labels orbiting a circle.
 *
 * Round, upright and evenly spaced, deliberately unlike the fanned rectangles
 * one stop above: two photographic scenes next door to each other have to be
 * different kinds of object, or the eye reads them as one scene repeated.
 *
 * Names only. The roles are on `/about-us`, and five job titles at this size
 * would be more type than picture — the alt text carries them for anyone who
 * needs them.
 */
function FacesScene({
  scene,
}: {
  scene: Extract<BeatScene, { kind: 'faces' }>;
}) {
  return (
    <ul className="beat-faces">
      {scene.photos.map((photo, i) => (
        <li
          key={photo.src}
          className="face"
          style={
            {
              '--ring': FACE_COLOURS[i % FACE_COLOURS.length],
            } as React.CSSProperties
          }
        >
          <span className="face-frame">
            <Image
              src={photo.src}
              alt={photo.alt}
              fill
              sizes="(max-width: 768px) 22vw, 8vw"
              className="face-img"
            />
          </span>
          <span className="face-name">{photo.name}</span>
        </li>
      ))}
    </ul>
  );
}

/* -------------------------------------------------------------------------
   Map — "why local?"
   ------------------------------------------------------------------------- */

/**
 * Florida, rising.
 *
 * The map comes up into place as the section scrolls in, which is the one
 * piece of motion on the page that is doing an argument rather than a
 * flourish: the answer to "why local" is that this is a real, bounded place
 * with three counties in it, and having the state physically arrive makes
 * that point before the paragraph next to it does.
 *
 * It sits straight on the card now. The bordered, shadowed panel it used to
 * have read as a picture inside a picture, so the wrapper keeps nothing but
 * `overflow: hidden` — which is still load-bearing, because it is what the
 * rise is clipped against.
 *
 * The counties are listed under it south-first, the way the site orders them
 * everywhere else.
 */
function MapScene({ scene }: { scene: Extract<BeatScene, { kind: 'map' }> }) {
  return (
    <figure className="statemap">
      <div className="statemap-clip">
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

/* -------------------------------------------------------------------------
   Banner - "what is Pana MIA?"
   ------------------------------------------------------------------------- */

/**
 * The vision, strung across the street on cloth.
 *
 * The other three stops argue: a stack of photographs, a row of faces, a
 * map. This one does not, because the vision is not an argument - it is four
 * words shouted at a block party. So it gets the object those words would
 * actually be printed on, hung from bunting over a room full of people.
 *
 * The photograph is a backdrop, not the subject. The cloth is opaque and
 * sits across the middle of it, so the words never have to fight the
 * picture; the crowd behind is there to say the sign was hung somewhere
 * real rather than drawn on an empty wall.
 *
 * The cloth hangs at a small angle on purpose. A banner pinned up straight
 * and square reads as a web component; a crooked one reads as something a
 * person put up.
 *
 * The words are real text rather than a drawn path, so they stay selectable,
 * translatable and legible to a screen reader. The bunting is the only part
 * that is decoration, and it is hidden from the accessibility tree.
 */
function BannerScene({
  scene,
}: {
  scene: Extract<BeatScene, { kind: 'banner' }>;
}) {
  return (
    <div className="banner-scene">
      {/* The room the sign is hung in. Behind the cloth rather than beside
          it, so the card is still a banner first and a photograph second. */}
      <Image
        src={scene.photo.src}
        alt={scene.photo.alt}
        fill
        sizes="(max-width: 768px) 80vw, 32vw"
        className="banner-photo"
      />
      <div className="banner-bunting" aria-hidden="true">
        {Array.from({ length: 9 }, (_, i) => (
          <span
            key={i}
            className="banner-flag"
            style={{ '--i': i } as React.CSSProperties}
          />
        ))}
      </div>
      <p className="banner-cloth">
        <span className="banner-headline">{scene.headline}</span>
        <span className="banner-caption">{scene.caption}</span>
      </p>
    </div>
  );
}
