/**
 * The drawn furniture of the story: the clouds that sit behind the top card
 * and the town that sits under it.
 *
 * All of it is vector, and deliberately so. A photograph of a street would
 * have to be a photograph of *a* street — one block, one set of businesses,
 * one neighbourhood — and the club covers three counties. A drawing can be
 * everybody's. It is also the only version of this that stays sharp on a
 * 5K display, costs nothing to download, recolours with the palette, and
 * does not need a licence or a photo credit.
 *
 * The town is drawn in three planes so it reads as a place rather than a
 * strip of facades:
 *
 *   far   — a pale skyline. One flat tint, no detail, no colour. It is
 *           distance, not architecture.
 *   mid   — houses and shops at reduced size and half opacity, so the
 *           palette washes toward the paper. Cheap atmospheric perspective:
 *           the further back something is, the more of the background it
 *           takes on.
 *   near  — full size, full colour, full detail.
 *
 * In front of all three is the pavement, and that is where the page makes
 * its actual argument. The buildings are only ever the setting; the point
 * of Pana MIA is the people in front of them, so the front plane is the
 * busiest layer — a farmers market with stalls and vendors, people walking,
 * talking, carrying, shopping, pushing a pram, walking a dog, and a park at
 * the end with trees, a bench and somebody's kids.
 *
 * Every colour comes from the six-colour palette. Skin is mixed from two of
 * them — orange toward cream for light, orange toward ink for deeper — so
 * the crowd is visibly a crowd without importing a colour that is not ours.
 *
 * The buildings are South Florida ones specifically — Art Deco, Med
 * Revival, conch houses, palms, a lifeguard stand and one real landmark.
 * See the note above `archPath` for why those four styles and not others.
 *
 * The street also moves, gently: people walk along it, the ones standing
 * still shift their weight, a vendor waves, and the palms take the breeze.
 * All of that is CSS on wall-clock timers, all of it is inside a
 * `prefers-reduced-motion` guard, and all of it animates `translate` or
 * `rotate` rather than `transform`, because these elements already carry a
 * `transform` *attribute* — their position in the drawing — and a CSS
 * `transform` would replace it rather than compose with it.
 *
 * Nothing here is interactive and nothing here is content, so the whole
 * scene is `aria-hidden`. A screen reader gets the prose instead.
 */

import type { CSSProperties, ReactNode } from 'react';

/** The pavement. People, stalls and the park stand on this line. */
const GROUND = 368;
/** Front row of buildings — full colour, full detail. */
const ROW_NEAR = 336;
/** Second row — smaller, half opacity. */
const ROW_MID = 292;

/**
 * Walls that would otherwise be page-cream. A cream building on cream paper
 * is not a building, it is a hole, so the pale ones get a whisper of orange
 * in them — enough to have an edge without becoming a colour.
 */
const PALE = 'color-mix(in srgb, var(--story-orange) 13%, var(--story-cream))';

/**
 * Terracotta, for barrel-tile roofs. Red pulled most of the way to orange —
 * the palette has no brown and does not need one.
 *
 * `TERRA_MID` exists because the middle row is drawn at 48% opacity, and red
 * at 48% over cream is pink. The mid-row roofs are mixed the other way, so
 * they wash to something still in the family.
 */
const TERRA = 'color-mix(in srgb, var(--story-red) 58%, var(--story-orange))';
const TERRA_MID =
  'color-mix(in srgb, var(--story-orange) 78%, var(--story-ink))';

/** Palm fronds and street trees. Blue reads as foliage here; green is not
 *  in the palette, and a blue canopy against cream is unmistakably a plant. */
const FROND = 'var(--story-blue)';

/** Palm trunks. Terracotta was too red for them — a row of palms came out a
 *  row of red poles — so they get orange pulled toward ink instead. */
const TRUNK = 'color-mix(in srgb, var(--story-orange) 46%, var(--story-ink))';

/** The gator. Same reasoning as the fronds: there is no green in the palette,
 *  and inventing one for a single animal would put a colour on the page that
 *  appears nowhere else. Blue is already doing the work of "living thing" up
 *  in the canopy, so the gator takes the same blue pulled well down into ink
 *  — dark enough to read as a reptile rather than as a shrub, and dark enough
 *  to hold its shape at 46 units long against cream. */
const GATOR = 'color-mix(in srgb, var(--story-blue) 56%, var(--story-ink))';

/* ---------------------------------------------------------------- clouds */

/**
 * One cloud. Three overlapping ellipses on a rounded slab, which is the
 * cheapest shape that still reads as weather rather than as a blob.
 * `currentColor` so a single CSS rule tints the whole sky.
 */
function Cloud({ className }: { className: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 220 86"
      fill="none"
      aria-hidden="true"
    >
      <ellipse cx="66" cy="44" rx="46" ry="34" fill="currentColor" />
      <ellipse cx="118" cy="32" rx="38" ry="30" fill="currentColor" />
      <ellipse cx="160" cy="50" rx="40" ry="28" fill="currentColor" />
      <rect x="24" y="52" width="172" height="30" rx="15" fill="currentColor" />
    </svg>
  );
}

/**
 * The sun. Eight rays at eight even angles, and they do not turn: a rotating
 * sun is the one thing in this scene that would genuinely qualify as the
 * motion `prefers-reduced-motion` exists to suppress, and it would be the
 * only spinning object on the page. The halo breathes instead, which reads
 * as heat rather than as machinery.
 *
 * Drawn before the clouds so they pass in front of it. That single ordering
 * choice is what stops a static disc from looking like a logo stuck in the
 * corner — once something crosses it, it is sky.
 */
function Sun() {
  return (
    <svg className="sky-sun" viewBox="0 0 120 120" aria-hidden="true">
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
        const rad = (deg * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        return (
          <line
            key={deg}
            className="sky-sun-ray"
            x1={(60 + cos * 39).toFixed(2)}
            y1={(60 + sin * 39).toFixed(2)}
            x2={(60 + cos * 51).toFixed(2)}
            y2={(60 + sin * 51).toFixed(2)}
          />
        );
      })}
      <circle className="sky-sun-halo" cx="60" cy="60" r="32" />
      <circle className="sky-sun-core" cx="60" cy="60" r="24" />
    </svg>
  );
}

/**
 * Five clouds at five sizes and five opacities. They drift on their own
 * clock — see `home-cloud-float` — and are pushed a second time by the
 * scroll position, which is what gives the top of the page its parallax.
 */
export function SkyClouds() {
  return (
    <div className="sky-clouds" aria-hidden="true">
      <Sun />
      <Cloud className="sky-cloud sky-cloud-1" />
      <Cloud className="sky-cloud sky-cloud-2" />
      <Cloud className="sky-cloud sky-cloud-3" />
      <Cloud className="sky-cloud sky-cloud-4" />
      <Cloud className="sky-cloud sky-cloud-5" />
    </div>
  );
}

/* ------------------------------------------------------------- buildings */

interface Placed {
  x: number;
  w: number;
  h: number;
  fill: string;
  /** Which plane this sits on. Defaults to the front row. */
  ground?: number;
}

/**
 * A block in the far skyline. It is drawn from its roofline all the way down
 * to the front row's baseline rather than stopping at its own, so it is
 * occluded by the two rows in front instead of ending in mid-air — the bases
 * show through the gaps between buildings, which is what you would actually
 * see down a street.
 */
function Slab({ x, w, top }: { x: number; w: number; top: number }) {
  return (
    <rect x={x} y={top} width={w} height={ROW_NEAR - top} fill="currentColor" />
  );
}

/**
 * A stepped crown on a far-row block. It stops exactly on the block's
 * roofline rather than overlapping it, because the whole row is drawn in one
 * translucent tint and two shapes on top of each other would show the join
 * as a darker step.
 */
function Crown({
  x,
  w,
  top,
  base,
}: {
  x: number;
  w: number;
  top: number;
  base: number;
}) {
  return (
    <rect x={x} y={top} width={w} height={base - top} fill="currentColor" />
  );
}

/** A tower block. The window grid is what makes it read as tall. */
function Tower({ x, w, h, fill, ground = ROW_NEAR }: Placed) {
  const top = ground - h;
  const cols = Math.max(2, Math.round(w / 24));
  const rows = Math.max(2, Math.round(h / 34));
  const colGap = w / (cols + 1);
  const rowGap = (h - 18) / (rows + 1);

  return (
    <g>
      <rect x={x} y={top} width={w} height={h} rx="3" fill={fill} />
      {Array.from({ length: rows }, (_, r) =>
        Array.from({ length: cols }, (_, c) => (
          <rect
            key={`${r}-${c}`}
            x={x + colGap * (c + 1) - 5}
            y={top + 14 + rowGap * r}
            width="10"
            height="13"
            rx="1.5"
            /* Every third window unlit, on a stride that does not line up
               with either axis, so the grid does not look like a pattern. */
            className={
              (r * cols + c + r) % 3 === 0
                ? 'street-window-dark'
                : 'street-window-lit'
            }
          />
        ))
      )}
    </g>
  );
}

/** A shop: a wide glass front, a door, and a striped awning over both. */
function Shop({
  x,
  w,
  h,
  fill,
  awning,
  ground = ROW_NEAR,
}: Placed & { awning: string }) {
  const top = ground - h;
  const awningY = ground - 58;
  const glassY = ground - 42;
  const stripes = Math.max(3, Math.round(w / 22));
  const stripeW = w / stripes;

  return (
    <g>
      <rect x={x} y={top} width={w} height={h} rx="3" fill={fill} />

      {/* Upstairs windows, above the awning line. */}
      <rect
        x={x + w * 0.16}
        y={top + 12}
        width={w * 0.2}
        height="16"
        rx="2"
        className="street-window-lit"
      />
      <rect
        x={x + w * 0.64}
        y={top + 12}
        width={w * 0.2}
        height="16"
        rx="2"
        className="street-window-dark"
      />

      {/* Shopfront. */}
      <rect
        x={x + 8}
        y={glassY}
        width={w - 44}
        height={42}
        rx="2"
        className="street-glass"
      />
      <rect
        x={x + w - 32}
        y={glassY}
        width={24}
        height={42}
        rx="2"
        className="street-door"
      />

      {/* Awning: a solid bar, striped, with a scalloped hem. The hem sits on
          the shopfront, so its gaps are the wall colour rather than the page
          colour — cream circles here punched holes in the building. */}
      <rect x={x} y={awningY} width={w} height="14" rx="2" fill={awning} />
      {Array.from({ length: stripes }, (_, i) =>
        i % 2 === 0 ? null : (
          <rect
            key={i}
            x={x + stripeW * i}
            y={awningY}
            width={stripeW}
            height="14"
            className="street-awning-stripe"
          />
        )
      )}
      {Array.from({ length: stripes }, (_, i) => (
        <circle
          key={`hem-${i}`}
          cx={x + stripeW * (i + 0.5)}
          cy={awningY + 14}
          r={Math.min(5.5, stripeW / 2)}
          fill={i % 2 === 0 ? awning : fill}
        />
      ))}
    </g>
  );
}

/* --------------------------------------------------------- south florida */

/**
 * Everything above this line would draw any town anywhere. Everything below
 * it draws *this* one.
 *
 * South Florida has an unusually legible architecture, which is lucky,
 * because at this scale a building gets about six shapes to make its case.
 * Four styles carry almost all of it:
 *
 *   Art Deco        — South Beach. A stepped parapet, eyebrows over the
 *                     windows, a fin on the roofline. Symmetrical about a
 *                     raised centre bay, always.
 *   Med Revival     — Coral Gables, Little Havana, half of Coconut Grove.
 *                     Stucco, arched openings, barrel-tile roof.
 *   Conch house     — Bahamian-built, Key West up through the Grove. Metal
 *                     roof, shutters, and a porch across the whole front.
 *   MiMo / downtown — the towers already in the back row.
 *
 * Plus the two things nobody would accept a Miami street without: royal
 * palms, and a lifeguard stand.
 */

/**
 * An arched opening — the single shape Mediterranean Revival is built out
 * of. A square-topped hole in a stucco wall is a different country.
 */
function archPath(cx: number, bottom: number, w: number, h: number) {
  const r = Math.min(w / 2, h);
  return `M ${cx - w / 2} ${bottom} V ${bottom - h + r} A ${r} ${r} 0 0 1 ${cx + w / 2} ${bottom - h + r} V ${bottom} Z`;
}

/**
 * A South Beach hotel. Three moves do all the work — the stepped parapet,
 * the eyebrows, the fin — and with those you do not need the neon, which is
 * just as well, because neon at this size is a smudge.
 */
function DecoHotel({
  x,
  w,
  h,
  fill,
  trim,
  ground = ROW_NEAR,
}: Placed & { trim: string }) {
  const top = ground - h;
  const mid = x + w / 2;
  const porchH = Math.min(30, h * 0.26);
  const bandTop = top + 16;
  const bandH = h - 16 - porchH - 8;
  const floors = Math.max(1, Math.round(bandH / 28));
  const fh = bandH / floors;

  return (
    <g>
      {/* The parapet steps up to the centre and the centre carries a mast.
          This is the bit people recognise from two blocks away. */}
      <rect
        x={x + w * 0.06}
        y={top - 8}
        width={w * 0.88}
        height={14}
        fill={fill}
      />
      <rect
        x={mid - w * 0.16}
        y={top - 18}
        width={w * 0.32}
        height={24}
        fill={fill}
      />
      <rect x={mid - 3} y={top - 36} width={6} height={22} rx={2} fill={trim} />
      {/* Racing stripe. Deco draws a line under everything. */}
      <rect
        x={x + w * 0.06}
        y={top - 4}
        width={w * 0.88}
        height={2.5}
        fill={trim}
      />

      <rect x={x} y={top} width={w} height={h} rx={2} fill={fill} />

      {Array.from({ length: floors }, (_, r) => {
        const fy = bandTop + fh * r;
        return (
          <g key={r}>
            {/* The eyebrow: a concrete brow over the window, cantilevered to
                keep the sun off it. Pure function, entirely distinctive. */}
            <rect
              x={x + w * 0.09}
              y={fy - 4.5}
              width={w * 0.82}
              height={3.5}
              rx={1.5}
              fill={trim}
            />
            {[0.18, 0.43, 0.68].map((c) => (
              <rect
                key={c}
                x={x + w * c}
                y={fy}
                width={w * 0.14}
                height={Math.min(15, fh * 0.52)}
                rx={1.5}
                className="street-window-lit"
              />
            ))}
          </g>
        );
      })}

      {/* The ground floor is a shaded arcade, because it is ninety degrees
          out there and every one of these buildings knows it. Three bays
          with wall between them rather than one continuous glass band —
          stood next to each other along a row, continuous bands merge into
          a single stripe running the width of the drawing. */}
      <rect
        x={x + w * 0.09}
        y={ground - porchH}
        width={w * 0.29}
        height={porchH}
        rx={2}
        className="street-glass"
      />
      <rect
        x={mid - w * 0.08}
        y={ground - porchH}
        width={w * 0.16}
        height={porchH}
        rx={1.5}
        className="street-door"
      />
      <rect
        x={x + w * 0.62}
        y={ground - porchH}
        width={w * 0.29}
        height={porchH}
        rx={2}
        className="street-glass"
      />
    </g>
  );
}

/**
 * Mediterranean Revival: stucco, arches, and a barrel-tile roof. Coral
 * Gables is made of this by ordinance, and Little Havana by inheritance.
 */
function MedRevival({
  x,
  w,
  h,
  fill,
  roof,
  ground = ROW_NEAR,
}: Placed & { roof: string }) {
  const top = ground - h;
  const eave = top + 13;
  const wall = ground - eave;
  const tiles = Math.max(4, Math.round(w / 13));
  const tileW = (w + 10) / tiles;

  return (
    <g>
      <rect x={x} y={eave} width={w} height={wall} rx={2} fill={fill} />

      {/* Barrel tile: a flat band with a half-round hem. The terracotta is
          the one colour on this street that is mixed rather than picked —
          red pulled most of the way to orange. */}
      <rect x={x - 5} y={top} width={w + 10} height={13} fill={roof} />
      {Array.from({ length: tiles }, (_, i) => (
        <circle
          key={i}
          cx={x - 5 + tileW * (i + 0.5)}
          cy={top + 13}
          r={tileW / 2}
          fill={roof}
        />
      ))}

      <path
        d={archPath(x + w * 0.21, eave + wall * 0.58, w * 0.18, wall * 0.36)}
        className="street-window-lit"
      />
      <path
        d={archPath(x + w * 0.79, eave + wall * 0.58, w * 0.18, wall * 0.36)}
        className="street-window-lit"
      />
      <path
        d={archPath(x + w * 0.5, ground, w * 0.22, wall * 0.6)}
        className="street-door"
      />
    </g>
  );
}

/**
 * A conch house — the Bahamian cottage that runs from Key West up through
 * Coconut Grove. Metal roof, real shutters, and a porch across the whole
 * front. The porch is the argument: it is a house built to be sat on the
 * outside of, in full view of whoever is walking past. Hard to think of a
 * better piece of architecture for a club about knowing your neighbours.
 */
function ConchHouse({
  x,
  w,
  h,
  fill,
  roof,
  ground = ROW_NEAR,
}: Placed & { roof: string }) {
  const top = ground - h;
  const eaves = top + h * 0.3;
  const porchY = ground - h * 0.4;

  return (
    <g>
      <rect
        x={x}
        y={eaves}
        width={w}
        height={ground - eaves}
        rx={2}
        fill={fill}
      />

      {/* Standing-seam metal, which is what you roof with when the wind
          arrives sideways once a year. */}
      <path
        d={`M ${x - 7} ${eaves} L ${x + w / 2} ${top} L ${x + w + 7} ${eaves} Z`}
        fill={roof}
      />
      {[0.26, 0.5, 0.74].map((s) => (
        <line
          key={s}
          x1={x + w * s}
          y1={eaves}
          x2={x + w / 2}
          y2={top}
          className="street-seam"
        />
      ))}

      {/* Shuttered windows. The shutters are the tell. */}
      {[0.14, 0.62].map((c) => (
        <g key={c}>
          <rect
            x={x + w * c}
            y={eaves + 7}
            width={w * 0.18}
            height={h * 0.15}
            rx={1.5}
            className="street-window-lit"
          />
          <rect
            x={x + w * (c - 0.055)}
            y={eaves + 7}
            width={w * 0.05}
            height={h * 0.15}
            rx={1}
            fill={roof}
          />
          <rect
            x={x + w * (c + 0.185)}
            y={eaves + 7}
            width={w * 0.05}
            height={h * 0.15}
            rx={1}
            fill={roof}
          />
        </g>
      ))}

      <rect
        x={x + w * 0.4}
        y={ground - h * 0.28}
        width={w * 0.2}
        height={h * 0.28}
        rx={1.5}
        className="street-door"
      />

      {/* The porch: a roof on posts with a rail between them. */}
      <rect x={x - 5} y={porchY} width={w + 10} height={5} rx={2} fill={roof} />
      {[0.01, 0.47, 0.93].map((p) => (
        <rect
          key={p}
          x={x + w * p}
          y={porchY}
          width={4.5}
          height={ground - porchY}
          fill={roof}
        />
      ))}
      <rect
        x={x}
        y={ground - h * 0.15}
        width={w}
        height={3.5}
        rx={1.5}
        fill={roof}
      />
    </g>
  );
}

/**
 * The Freedom Tower, near enough.
 *
 * It is the only building on this street that is a *specific* building, and
 * it earns the exception. It is where a quarter of a million Cubans were
 * received in the sixties — Miami's Ellis Island, and the reason a good deal
 * of this city is the city it is. A page about who a place is made of should
 * have it on the skyline.
 */
function FreedomTower({
  x,
  w,
  h,
  fill,
  roof,
  ground = ROW_NEAR,
}: Placed & { roof: string }) {
  const baseH = h * 0.46;
  const baseTop = ground - baseH;
  const towW = w * 0.46;
  const towX = x + (w - towW) / 2;
  const towTop = ground - h;
  const capTop = towTop + 20;

  return (
    <g>
      <rect x={x} y={baseTop} width={w} height={baseH} rx={2} fill={fill} />
      {[0.2, 0.5, 0.8].map((c) => (
        <path
          key={c}
          d={archPath(x + w * c, ground, w * 0.17, baseH * 0.58)}
          className="street-door"
        />
      ))}
      <rect x={x - 5} y={baseTop - 6} width={w + 10} height={7} fill={roof} />

      {/* The tower, set back off the base. */}
      <rect
        x={towX}
        y={capTop}
        width={towW}
        height={baseTop - capTop}
        fill={fill}
      />
      {[0.27, 0.73].map((c) => (
        <path
          key={c}
          d={archPath(
            towX + towW * c,
            capTop + (baseTop - capTop) * 0.46,
            towW * 0.3,
            (baseTop - capTop) * 0.3
          )}
          className="street-window-dark"
        />
      ))}

      {/* Cupola and finial. The silhouette is the whole recognition. */}
      <rect
        x={towX - 7}
        y={capTop - 6}
        width={towW + 14}
        height={7}
        fill={roof}
      />
      <path
        d={`M ${towX - 3} ${capTop - 6} L ${x + w / 2} ${towTop + 2} L ${towX + towW + 3} ${capTop - 6} Z`}
        fill={roof}
      />
      <rect
        x={x + w / 2 - 1.75}
        y={towTop - 11}
        width={3.5}
        height={13}
        fill={roof}
      />
    </g>
  );
}

/**
 * A lifeguard stand. Nothing else says which coast this is so quickly, and
 * every one of them is painted a different set of colours, so it can take
 * whichever two the block next to it is not using. Never cream: on cream
 * paper a cream hut is a hole rather than a building.
 */
function Lifeguard({
  x,
  scale = 1,
  body,
  roof,
  ground = GROUND,
}: {
  x: number;
  scale?: number;
  body: string;
  roof: string;
  ground?: number;
}) {
  return (
    <g transform={`translate(${x} ${ground}) scale(${scale})`}>
      {[-21, -13, 13, 21].map((lx) => (
        <rect key={lx} x={lx} y="-30" width="3.5" height="30" fill={body} />
      ))}
      {[-24, -16, -8].map((ry) => (
        <rect key={ry} x="13" y={ry} width="12" height="2.5" fill={body} />
      ))}
      <rect x="-27" y="-36" width="54" height="5" rx="2" fill={body} />
      <rect x="-22" y="-59" width="43" height="24" rx="2" fill={body} />
      <rect
        x="-15"
        y="-53"
        width="27"
        height="12"
        rx="1.5"
        className="street-window-dark"
      />
      {/* A shed roof, pitched hard, overhanging on the seaward side. */}
      <path d="M -28 -57 L 24 -70 L 28 -63 L -24 -50 Z" fill={roof} />
      <rect x="22" y="-88" width="2.5" height="20" fill={body} />
      <path d="M 24.5 -88 L 40 -82 L 24.5 -76 Z" fill={roof} />
    </g>
  );
}

/**
 * A royal palm. A curved tapering trunk and eight fronds thrown out of one
 * point — fewer than that and it is a firework, more and it is a bush.
 *
 * The crown is wrapped in its own group so it can be given a breeze. See
 * `.street-palm` in globals.css.
 */
function Palm({
  x,
  scale = 1,
  trunk,
  frond,
  lean = 1,
  sway = 7,
  delay = 0,
  ground = GROUND,
}: {
  x: number;
  scale?: number;
  trunk: string;
  frond: string;
  /** +1 leans right, -1 leans left. No two palms lean the same way. */
  lean?: number;
  sway?: number;
  delay?: number;
  ground?: number;
}) {
  const cx = 10 * lean;
  const cy = -76;
  const fronds: Array<[number, number]> = [
    [-37, 11],
    [-29, -9],
    [-14, -22],
    [9, -23],
    [27, -11],
    [37, 9],
    [19, 19],
    [-20, 20],
  ];

  return (
    <g transform={`translate(${x} ${ground}) scale(${scale})`}>
      <g
        className="street-palm"
        style={
          {
            '--sway-dur': `${sway}s`,
            '--sway-delay': `${delay}s`,
          } as CSSProperties
        }
      >
        <path
          d={`M -4.5 0 Q ${cx * 0.3 - 2.5} -42 ${cx - 3} ${cy + 6} l 6 0 Q ${cx * 0.3 + 4.5} -42 4.5 0 Z`}
          fill={trunk}
        />
        {fronds.map(([ex, ey], i) => (
          <path
            key={i}
            d={`M ${cx} ${cy} Q ${cx + ex * 0.5} ${cy - 16} ${cx + ex} ${cy + ey}`}
            stroke={frond}
            strokeWidth="5.5"
            strokeLinecap="round"
            fill="none"
          />
        ))}
        <circle cx={cx - 5} cy={cy + 7} r="3" fill={trunk} />
        <circle cx={cx + 5} cy={cy + 8} r="3" fill={trunk} />
      </g>
    </g>
  );
}

/* ------------------------------------------------------------------ park */

/** A tree: three overlapping circles on a trunk. */
function Tree({
  x,
  scale = 1,
  fill,
  ground = GROUND,
}: {
  x: number;
  scale?: number;
  fill: string;
  ground?: number;
}) {
  return (
    <g transform={`translate(${x} ${ground}) scale(${scale})`}>
      <rect x="-5" y="-44" width="10" height="44" rx="3" fill={fill} />
      <circle cx="0" cy="-62" r="26" fill={fill} />
      <circle cx="-19" cy="-48" r="19" fill={fill} />
      <circle cx="19" cy="-48" r="19" fill={fill} />
    </g>
  );
}

/** A park bench, seen side-on. */
function Bench({
  x,
  scale = 0.82,
  ground = GROUND,
}: {
  x: number;
  scale?: number;
  ground?: number;
}) {
  return (
    <g
      transform={`translate(${x} ${ground}) scale(${scale})`}
      className="street-bench"
    >
      <rect x="0" y="-16" width="46" height="5" rx="2" />
      <rect x="0" y="-27" width="46" height="5" rx="2" />
      <rect x="3" y="-16" width="4" height="16" rx="1.5" />
      <rect x="39" y="-16" width="4" height="16" rx="1.5" />
    </g>
  );
}

/* ---------------------------------------------------------------- people */

type Pose = 'stand' | 'walk' | 'carry' | 'push' | 'wave';

interface PersonProps {
  x: number;
  /** 1 light, 2 medium, 3 deep. All three are mixed from the palette. */
  skin?: 1 | 2 | 3;
  shirt: string;
  hair?: string;
  pose?: Pose;
  /** Wave timing, so no two people in a scene wave in lockstep. */
  waveDur?: number;
  waveDelay?: number;
  /** Mirrors the figure, so a pair can face each other. */
  flip?: boolean;
  scale?: number;
  ground?: number;
}

/**
 * One person, about 40 units tall — roughly half a single-storey house,
 * which is about right once you allow for the house being a plane further
 * back. Head, torso, two legs and one visible arm is all the detail that
 * survives at this size; anything more turns to mud.
 */
function Person({
  x,
  skin = 1,
  shirt,
  hair = 'var(--story-ink)',
  pose = 'stand',
  waveDur = 1.15,
  waveDelay = 0,
  flip = false,
  scale = 1,
  ground = GROUND,
}: PersonProps) {
  const striding = pose === 'walk' || pose === 'push';

  return (
    <g
      className="street-person"
      transform={`translate(${x} ${ground}) scale(${flip ? -scale : scale} ${scale})`}
    >
      <g className="street-leg">
        <rect
          x="-5"
          y="-15"
          width="4.5"
          height="15"
          rx="2.25"
          transform={striding ? 'rotate(-11 -2.75 -15)' : undefined}
        />
        <rect
          x="0.5"
          y="-15"
          width="4.5"
          height="15"
          rx="2.25"
          transform={striding ? 'rotate(13 2.75 -15)' : undefined}
        />
      </g>

      {/* Torso: a semicircle for the shoulders, tapering to the hips. */}
      <path
        d="M -6 -30 a 6 6 0 0 1 12 0 l 1 16 q -7 2.5 -14 0 z"
        fill={shirt}
      />

      {/* The near arm. Carrying shortens it and swings it forward; waving
          raises it and hands it to CSS, which hinges it at the shoulder. */}
      {pose === 'wave' ? (
        <g
          className="street-arm"
          style={
            {
              '--wave-dur': `${waveDur}s`,
              '--wave-delay': `${waveDelay}s`,
            } as CSSProperties
          }
        >
          <rect x="4.5" y="-44" width="4" height="17" rx="2" fill={shirt} />
        </g>
      ) : (
        <rect
          x={pose === 'carry' ? 5 : 5.5}
          y="-28"
          width="4"
          height={pose === 'carry' ? 11 : 15}
          rx="2"
          fill={shirt}
        />
      )}
      {pose === 'carry' ? (
        <rect
          x="4"
          y="-17"
          width="9"
          height="11"
          rx="1.5"
          className="street-tote"
        />
      ) : null}
      {pose === 'push' ? (
        <rect x="5" y="-20" width="12" height="3" rx="1.5" fill={shirt} />
      ) : null}

      <circle cx="0" cy="-35" r="5.5" className={`street-skin-${skin}`} />
      <path
        d="M -5.5 -36.5 a 5.5 5.5 0 0 1 11 0 q -5.5 -3 -11 0 z"
        fill={hair}
      />
    </g>
  );
}

/** A dog on a lead, about knee height. */
function Dog({
  x,
  fill,
  flip = false,
  ground = GROUND,
}: {
  x: number;
  fill: string;
  flip?: boolean;
  ground?: number;
}) {
  return (
    <g
      transform={`translate(${x} ${ground}) scale(${flip ? -1 : 1} 1)`}
      className="street-dog"
    >
      <rect x="-9" y="-13" width="19" height="7" rx="3.5" fill={fill} />
      <rect x="-7" y="-7" width="3" height="7" rx="1.5" fill={fill} />
      <rect x="5" y="-7" width="3" height="7" rx="1.5" fill={fill} />
      <circle cx="12" cy="-15" r="4.5" fill={fill} />
      <rect x="14" y="-14" width="6" height="3.5" rx="1.75" fill={fill} />
      <path
        d="M -9 -13 q -6 -2 -5 -9"
        stroke={fill}
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
    </g>
  );
}

/** Ridge of scutes down the back: [x, baseline, height]. This is the detail
 *  that does the identifying — without it a long low body on four legs at
 *  this size is just a very committed dachshund. Split in two because the
 *  tail's scutes have to travel with the tail; see `GATOR_TAIL_SCUTES`. */
const GATOR_SCUTES: Array<[number, number, number]> = [
  [-10, -13, 1.9],
  [-3, -13, 2.1],
  [4, -13, 1.8],
];

/** The two that sit on the tail. They live inside the rotating group, or the
 *  tail swishes out from under them and leaves them hanging in mid-air. */
const GATOR_TAIL_SCUTES: Array<[number, number, number]> = [
  [-23, -8.9, 1.2],
  [-17, -9.8, 1.5],
];

/**
 * An alligator on a lead, because this is South Florida and somebody was
 * always going to.
 *
 * Roughly 46 units nose to tail against the 40-unit person walking it, which
 * at this scene's scale is a bit over six feet — a real and entirely legal
 * size of gator to be attached to.
 *
 * The waddle and the tail swish live in `globals.css`; the swish hinges on
 * the tail's own right edge, which is exactly where it meets the body.
 */
function Gator({
  x,
  fill,
  flip = false,
  scale = 1,
  ground = GROUND,
}: {
  x: number;
  fill: string;
  flip?: boolean;
  scale?: number;
  ground?: number;
}) {
  return (
    <g
      transform={`translate(${x} ${ground}) scale(${(flip ? -1 : 1) * scale} ${scale})`}
    >
      {/* The rotation wrapper carries no transform of its own, because the
          transform attribute above maps onto the same CSS property the
          animation uses and would be thrown away by it. */}
      <g className="street-gator">
        {/* Far pair of legs first, so the body covers where they join. Set
            back a little from the near pair, which is the whole trick for
            depth on a flat side view. The legs are longer than a real
            alligator's, deliberately: at true proportions the body sat down
            inside the 4-unit kerb band and the animal read as half-sunk in
            the pavement. Raising it clears the kerb entirely. */}
        <rect
          x="-6"
          y="-6"
          width="3"
          height="6"
          rx="1.4"
          fill={fill}
          opacity="0.5"
        />
        <rect
          x="9"
          y="-6"
          width="3"
          height="6"
          rx="1.4"
          fill={fill}
          opacity="0.5"
        />

        <g className="street-gator-tail">
          <path
            d="M -33 -6.6 Q -24 -10.2 -12 -10.6 L -12 -4.4 Q -24 -4.8 -33 -6.6 Z"
            fill={fill}
          />
          {GATOR_TAIL_SCUTES.map(([sx, sy, h]) => (
            <path
              key={sx}
              d={`M ${sx - 2.8} ${sy} L ${sx} ${sy - h} L ${sx + 2.8} ${sy} Z`}
              fill={fill}
            />
          ))}
        </g>

        <rect x="-14" y="-13" width="26" height="7.6" rx="3.2" fill={fill} />

        {/* Skull, then the snout, which is shallower — the step between the
            two is most of what makes the head read as a head. */}
        <rect x="8" y="-13.4" width="15" height="8" rx="2.6" fill={fill} />
        <rect x="21" y="-11.4" width="13" height="5.4" rx="2.7" fill={fill} />

        {GATOR_SCUTES.map(([sx, sy, h]) => (
          <path
            key={sx}
            d={`M ${sx - 2.8} ${sy} L ${sx} ${sy - h} L ${sx + 2.8} ${sy} Z`}
            fill={fill}
          />
        ))}

        <rect x="-9" y="-6" width="3.4" height="6" rx="1.5" fill={fill} />
        <rect x="5" y="-6" width="3.4" height="6" rx="1.5" fill={fill} />

        {/* Eye and nostrils sit proud on top, which is where a gator keeps
            them and the reason the rest of one is usually underwater. */}
        <circle cx="13" cy="-14" r="2.5" fill={fill} />
        <circle cx="13.4" cy="-14.4" r="0.95" fill="var(--story-cream)" />
        <circle cx="31" cy="-11.9" r="1.5" fill={fill} />

        {/* Collar, in orange to match the lead. It is also what gives the lead
            somewhere to land — a lead that stops in open space above the back
            looks like a handle rather than a lead. */}
        <path
          d="M 6 -13.4 L 6 -5"
          stroke="var(--story-orange)"
          strokeWidth="1.3"
          strokeLinecap="round"
        />
      </g>
    </g>
  );
}

/** A pram. Drawn beside a `pose="push"` figure. */
function Pram({
  x,
  fill,
  ground = GROUND,
}: {
  x: number;
  fill: string;
  ground?: number;
}) {
  return (
    <g transform={`translate(${x} ${ground})`} className="street-pram">
      <path d={`M 0 -20 h 17 a 9 9 0 0 1 -9 12 h -8 z`} fill={fill} />
      <rect x="0" y="-21" width="19" height="3" rx="1.5" fill={fill} />
      <circle cx="3" cy="-4" r="4" className="street-wheel" />
      <circle cx="15" cy="-4" r="4" className="street-wheel" />
    </g>
  );
}

/* ---------------------------------------------------------------- motion */

/**
 * Somebody on their way somewhere.
 *
 * One lap carries the figure clear off both ends of the drawing, where the
 * viewBox crops it, so the walk has no visible start and no visible finish.
 *
 * Unlike the clouds — where two different speeds guarantee an eventual
 * overlap, and an overlap of two soft white shapes is one blob — walkers are
 * deliberately allowed to differ and to pass each other. Two people
 * overtaking on a pavement is what a pavement looks like.
 *
 * The figure inside keeps its own `transform` attribute for pose and scale.
 * This wrapper only animates `translate`, which composes with it instead of
 * replacing it.
 */
function Walker({
  from,
  to,
  dur,
  delay = 0,
  children,
}: {
  from: number;
  to: number;
  dur: number;
  /** Negative, so the lap is already under way on the first frame. */
  delay?: number;
  children: ReactNode;
}) {
  return (
    <g
      className="street-walk"
      style={
        {
          '--walk-from': `${from}px`,
          '--walk-to': `${to}px`,
          '--walk-dur': `${dur}s`,
          '--walk-delay': `${delay}s`,
        } as CSSProperties
      }
    >
      {children}
    </g>
  );
}

/**
 * Somebody standing still, which is not the same as somebody frozen. A
 * degree and a half of lean, hinged on their own feet, on a slow cycle that
 * is different for every figure so the street never pulses in time.
 */
function Sway({
  dur = 4.6,
  delay = 0,
  children,
}: {
  dur?: number;
  delay?: number;
  children: ReactNode;
}) {
  return (
    <g
      className="street-sway"
      style={
        {
          '--sway-dur': `${dur}s`,
          '--sway-delay': `${delay}s`,
        } as CSSProperties
      }
    >
      {children}
    </g>
  );
}

/* ---------------------------------------------------------------- market */

/**
 * A market stall: two posts, a striped canopy with the same scalloped hem
 * as the shop awnings — the market is the shops, outdoors, once a week —
 * a clothed table, and crates of whatever is in season.
 */
function MarketStall({
  x,
  w = 150,
  canopy,
  produce,
  ground = GROUND,
}: {
  x: number;
  w?: number;
  canopy: string;
  produce: string[];
  ground?: number;
}) {
  const canopyY = ground - 84;
  const tableY = ground - 30;
  const stripes = Math.max(4, Math.round(w / 20));
  const stripeW = w / stripes;
  const crateW = (w - 26) / produce.length;

  return (
    <g>
      <rect
        x={x + 4}
        y={canopyY + 14}
        width="4"
        height={ground - canopyY - 14}
        className="street-stall-post"
      />
      <rect
        x={x + w - 8}
        y={canopyY + 14}
        width="4"
        height={ground - canopyY - 14}
        className="street-stall-post"
      />

      {/* Table first, so the crates sit on top of it. */}
      <rect
        x={x + 8}
        y={tableY + 6}
        width={w - 16}
        height={ground - tableY - 6}
        className="street-stall-cloth"
      />
      <rect
        x={x + 4}
        y={tableY}
        width={w - 8}
        height="6"
        rx="2"
        className="street-stall-top"
      />

      {produce.map((colour, i) => {
        const cx = x + 13 + crateW * i;
        const mid = cx + (crateW - 6) / 2;
        return (
          <g key={i}>
            <rect
              x={cx}
              y={tableY - 9}
              width={crateW - 6}
              height="9"
              rx="1.5"
              className="street-crate"
            />
            <circle cx={mid - 6} cy={tableY - 11} r="3.6" fill={colour} />
            <circle cx={mid} cy={tableY - 13} r="3.6" fill={colour} />
            <circle cx={mid + 6} cy={tableY - 11} r="3.6" fill={colour} />
          </g>
        );
      })}

      {/* Canopy. */}
      <rect x={x} y={canopyY} width={w} height="14" rx="2" fill={canopy} />
      {Array.from({ length: stripes }, (_, i) =>
        i % 2 === 0 ? null : (
          <rect
            key={i}
            x={x + stripeW * i}
            y={canopyY}
            width={stripeW}
            height="14"
            className="street-awning-stripe"
          />
        )
      )}
      {Array.from({ length: stripes }, (_, i) => (
        <circle
          key={`hem-${i}`}
          cx={x + stripeW * (i + 0.5)}
          cy={canopyY + 14}
          r={Math.min(5, stripeW / 2)}
          fill={i % 2 === 0 ? canopy : 'var(--story-cream)'}
        />
      ))}
    </g>
  );
}

/** Bunting strung over the market. Flags follow the sag of the line. */
function Bunting({
  x1,
  x2,
  y,
  sag = 16,
  colours,
}: {
  x1: number;
  x2: number;
  y: number;
  sag?: number;
  colours: string[];
}) {
  const count = Math.max(6, Math.round((x2 - x1) / 36));
  const mid = (x1 + x2) / 2;
  const half = (x2 - x1) / 2;
  /* The quadratic below dips to exactly `sag` at its midpoint, so the flags
     can be placed with the same parabola rather than measured off the path. */
  const yAt = (px: number) => y + sag * (1 - ((px - mid) / half) ** 2);

  return (
    <g>
      <path
        d={`M ${x1} ${y} Q ${mid} ${y + sag * 2} ${x2} ${y}`}
        className="street-bunting-line"
        fill="none"
      />
      {Array.from({ length: count }, (_, i) => {
        const fx = x1 + ((x2 - x1) / count) * (i + 0.5);
        const fy = yAt(fx);
        return (
          <polygon
            key={i}
            points={`${fx - 5},${fy} ${fx + 5},${fy} ${fx},${fy + 11}`}
            fill={colours[i % colours.length]}
          />
        );
      })}
    </g>
  );
}

/* ------------------------------------------------------------ the street */

/**
 * The town. `xMidYMax slice` pins it to the bottom of its box and crops from
 * the top, so when the box is short it is sky and rooflines that go rather
 * than the whole scene shrinking — the buildings stay standing on the kerb at
 * full size, and the cropped rooftops read as taller blocks further back.
 */
export function StreetScene() {
  return (
    <svg
      className="street-svg"
      viewBox="0 58 1440 310"
      preserveAspectRatio="xMidYMax slice"
      fill="none"
      aria-hidden="true"
    >
      {/* --- far: skyline, one flat tint, no detail -------------------
              Stepped crowns on half the blocks. Downtown Miami and the
              Deco district are both built out of setbacks, and a stepped
              silhouette is the only thing that survives at this distance —
              windows and colour would just be noise. */}
      <g className="street-back">
        <Slab x={40} w={70} top={132} />
        <Crown x={62} w={26} top={114} base={132} />

        <Slab x={150} w={86} top={86} />
        <Crown x={172} w={42} top={66} base={86} />

        <Slab x={272} w={74} top={124} />

        <Slab x={382} w={92} top={70} />
        <Crown x={412} w={32} top={60} base={70} />

        <Slab x={512} w={78} top={112} />
        <Crown x={532} w={38} top={94} base={112} />

        <Slab x={632} w={96} top={78} />
        <Crown x={664} w={32} top={62} base={78} />

        <Slab x={772} w={82} top={120} />

        <Slab x={892} w={88} top={92} />
        <Crown x={918} w={36} top={72} base={92} />

        <Slab x={1022} w={76} top={136} />

        <Slab x={1132} w={90} top={82} />
        <Crown x={1160} w={34} top={62} base={82} />

        <Slab x={1258} w={80} top={118} />
        <Crown x={1280} w={34} top={100} base={118} />

        <Slab x={1368} w={72} top={140} />
      </g>

      {/* --- mid: the same town, smaller and washed toward the paper ---
              Red is deliberately absent from this row. Half opacity over
              cream turns it pink, which is not a colour we have — hence
              TERRA_MID for the roofs rather than the terracotta used in
              front. Orange, coral and blue all wash to something still in
              the family. */}
      <g className="street-mid">
        <ConchHouse
          x={10}
          w={92}
          h={70}
          fill="var(--story-coral)"
          roof={TERRA_MID}
          ground={ROW_MID}
        />
        <DecoHotel
          x={118}
          w={104}
          h={92}
          fill={PALE}
          trim="var(--story-orange)"
          ground={ROW_MID}
        />
        <MedRevival
          x={242}
          w={86}
          h={66}
          fill="var(--story-blue)"
          roof={TERRA_MID}
          ground={ROW_MID}
        />
        <Shop
          x={346}
          w={98}
          h={88}
          fill="var(--story-orange)"
          awning="var(--story-ink)"
          ground={ROW_MID}
        />
        <MedRevival
          x={462}
          w={90}
          h={72}
          fill="var(--story-orange)"
          roof={TERRA_MID}
          ground={ROW_MID}
        />
        <DecoHotel
          x={570}
          w={102}
          h={90}
          fill={PALE}
          trim="var(--story-coral)"
          ground={ROW_MID}
        />
        <ConchHouse
          x={692}
          w={88}
          h={68}
          fill="var(--story-orange)"
          roof={TERRA_MID}
          ground={ROW_MID}
        />
        <Shop
          x={798}
          w={100}
          h={86}
          fill="var(--story-blue)"
          awning="var(--story-ink)"
          ground={ROW_MID}
        />
        <MedRevival
          x={916}
          w={92}
          h={70}
          fill="var(--story-coral)"
          roof={TERRA_MID}
          ground={ROW_MID}
        />
        <DecoHotel
          x={1026}
          w={98}
          h={88}
          fill={PALE}
          trim="var(--story-orange)"
          ground={ROW_MID}
        />
        <ConchHouse
          x={1142}
          w={86}
          h={66}
          fill="var(--story-blue)"
          roof={TERRA_MID}
          ground={ROW_MID}
        />
        <Shop
          x={1246}
          w={100}
          h={90}
          fill="var(--story-blue)"
          awning="var(--story-ink)"
          ground={ROW_MID}
        />
        <MedRevival
          x={1364}
          w={78}
          h={64}
          fill="var(--story-orange)"
          roof={TERRA_MID}
          ground={ROW_MID}
        />

        {/* Palms in the gaps, at the height of a two-storey building, which
            is about right for a royal palm that has been there a while. */}
        <Palm
          x={112}
          scale={0.62}
          trunk={TERRA_MID}
          frond={FROND}
          lean={-1}
          ground={ROW_MID}
          sway={8.4}
        />
        <Palm
          x={556}
          scale={0.58}
          trunk={TERRA_MID}
          frond={FROND}
          ground={ROW_MID}
          sway={7.2}
          delay={-2.4}
        />
        <Palm
          x={1016}
          scale={0.6}
          trunk={TERRA_MID}
          frond={FROND}
          lean={-1}
          ground={ROW_MID}
          sway={9.1}
          delay={-4.8}
        />
      </g>

      {/* --- near: full size, full colour ----------------------------- */}
      <g className="street-near">
        <ConchHouse
          x={-10}
          w={118}
          h={96}
          fill="var(--story-coral)"
          roof={TERRA}
        />
        <DecoHotel
          x={126}
          w={136}
          h={126}
          fill={PALE}
          trim="var(--story-coral)"
        />
        <MedRevival
          x={286}
          w={106}
          h={86}
          fill="var(--story-orange)"
          roof={TERRA}
        />
        <FreedomTower x={408} w={100} h={196} fill={PALE} roof={TERRA} />
        <Shop
          x={524}
          w={140}
          h={130}
          fill="var(--story-red)"
          awning="var(--story-ink)"
        />
        <ConchHouse
          x={678}
          w={112}
          h={92}
          fill="var(--story-blue)"
          roof={TERRA}
        />
        <DecoHotel
          x={810}
          w={132}
          h={122}
          fill={PALE}
          trim="var(--story-orange)"
        />
        <MedRevival
          x={962}
          w={108}
          h={88}
          fill="var(--story-coral)"
          roof={TERRA}
        />
        <Tower x={1090} w={78} h={170} fill="var(--story-ink)" />
      </g>

      {/* --- palms along the kerb, in front of the buildings ----------
              Drawn after the near row so they overlap the facades, which is
              the cheapest way to put the street in front of the town. */}
      <g className="street-palms">
        <Palm
          x={114}
          scale={0.9}
          trunk={TRUNK}
          frond={FROND}
          lean={-1}
          sway={6.4}
        />
        <Palm
          x={272}
          scale={1}
          trunk={TRUNK}
          frond={FROND}
          sway={7.8}
          delay={-3.1}
        />
        <Palm
          x={796}
          scale={0.86}
          trunk={TRUNK}
          frond={FROND}
          lean={-1}
          sway={8.6}
          delay={-1.7}
        />
        <Palm
          x={1078}
          scale={1.04}
          trunk={TRUNK}
          frond={FROND}
          sway={6.9}
          delay={-4.4}
        />
      </g>

      {/* --- the park at the end of the block ------------------------- */}
      <g className="street-park">
        <Palm
          x={1200}
          scale={0.96}
          trunk={TRUNK}
          frond={FROND}
          lean={-1}
          sway={7.4}
          delay={-2.2}
        />
        <Tree x={1252} scale={0.88} fill="var(--story-blue)" />
        <Bench x={1278} />
        {/* The lifeguard stand. Nothing else says which coast this is so
            quickly, and no two of them are painted the same. Kept clear of
            the right edge, because a cropped palm reads as a palm and a
            cropped lifeguard stand reads as a mistake. */}
        <Lifeguard
          x={1362}
          scale={0.78}
          body="var(--story-blue)"
          roof="var(--story-red)"
        />
        <Palm
          x={1428}
          scale={1.02}
          trunk={TRUNK}
          frond={FROND}
          sway={8.1}
          delay={-5.3}
        />
      </g>

      {/* --- the market. Vendors are drawn before their stalls so the
              table hides them from the waist down, which is the cheapest
              way to put somebody *behind* something. ------------------ */}
      <g className="street-market">
        <Person
          x={318}
          shirt="var(--story-blue)"
          skin={2}
          ground={GROUND - 16}
        />
        <MarketStall
          x={252}
          w={152}
          canopy="var(--story-orange)"
          produce={['var(--story-red)', 'var(--story-orange)']}
        />

        {/* One vendor waving somebody over. The whole page is an argument
            that this is what a neighbourhood is for. */}
        <Person
          x={508}
          shirt="var(--story-coral)"
          skin={1}
          flip
          pose="wave"
          waveDur={1.08}
          waveDelay={-0.37}
          ground={GROUND - 16}
        />
        <MarketStall
          x={436}
          w={160}
          canopy="var(--story-coral)"
          produce={['var(--story-blue)', 'var(--story-red)']}
        />

        <Person
          x={694}
          shirt="var(--story-red)"
          skin={3}
          ground={GROUND - 16}
        />
        <MarketStall
          x={628}
          w={152}
          canopy="var(--story-blue)"
          produce={['var(--story-orange)', 'var(--story-coral)']}
        />

        <Bunting
          x1={256}
          x2={776}
          y={GROUND - 100}
          colours={[
            'var(--story-red)',
            'var(--story-orange)',
            'var(--story-blue)',
            'var(--story-coral)',
          ]}
        />
      </g>

      {/* --- the pavement: everyone else ------------------------------
              Two kinds of person. The ones below are stopped — talking,
              shopping, waiting — and only shift their weight. The ones in
              the group after them are walking the length of the block. A
              street where everybody moves is a conveyor belt; a street
              where nobody does is a photograph. */}
      <g className="street-crowd">
        {/* a pair stopped mid-conversation */}
        <Sway dur={5.2}>
          <Person x={186} shirt="var(--story-red)" skin={3} />
        </Sway>
        <Sway dur={4.4} delay={-1.6}>
          <Person x={214} shirt="var(--story-coral)" skin={1} flip />
        </Sway>

        {/* shoppers in front of the stalls */}
        <Sway dur={5.8} delay={-2.3}>
          <Person x={356} shirt="var(--story-coral)" skin={1} pose="carry" />
        </Sway>
        <Sway dur={4.9} delay={-3.1}>
          <Person x={398} shirt="var(--story-blue)" skin={3} flip />
        </Sway>
        <Sway dur={5.4} delay={-0.9}>
          <Person x={572} shirt="var(--story-ink)" skin={2} pose="carry" />
        </Sway>
        <Sway dur={4.2} delay={-2.8}>
          <Person x={820} shirt="var(--story-orange)" skin={2} pose="carry" />
        </Sway>

        {/* somebody flagging down somebody they know */}
        <Sway dur={5} delay={-1.2}>
          <Person
            x={1042}
            shirt="var(--story-orange)"
            skin={3}
            pose="wave"
            waveDur={1.34}
          />
        </Sway>
        <Sway dur={4.6} delay={-3.4}>
          <Person x={1076} shirt="var(--story-red)" skin={1} flip />
        </Sway>

        {/* the park */}
        <Sway dur={5.6} delay={-2}>
          <Person x={1232} shirt="var(--story-red)" skin={1} />
        </Sway>
        <Sway dur={4.8} delay={-4.1}>
          <Person x={1320} shirt="var(--story-coral)" skin={3} flip />
        </Sway>
      </g>

      {/* --- and the people actually going somewhere ------------------
              Six laps at six lengths, each started part-way through, so
              the block is never empty and the pattern never repeats
              anywhere near often enough to be spotted. */}
      <g className="street-traffic">
        <Walker from={-90} to={1530} dur={78} delay={-11}>
          <Person x={0} shirt="var(--story-blue)" skin={2} pose="walk" />
        </Walker>

        <Walker from={1530} to={-90} dur={88} delay={-35}>
          <Person x={0} shirt="var(--story-coral)" skin={1} pose="walk" flip />
        </Walker>

        <Walker from={-150} to={1510} dur={70} delay={-49}>
          <Person x={0} shirt="var(--story-orange)" skin={3} pose="carry" />
        </Walker>

        {/* somebody walking a dog, the other way */}
        <Walker from={1550} to={-130} dur={97} delay={-74}>
          <Person x={0} shirt="var(--story-red)" skin={1} pose="walk" flip />
          <Dog x={-38} fill="var(--story-ink)" flip />
        </Walker>

        {/* and somebody pushing a pram, slowest of the lot */}
        <Walker from={-170} to={1490} dur={104} delay={-20}>
          <Person x={0} shirt="var(--story-blue)" skin={2} pose="push" />
          <Pram x={13} fill="var(--story-red)" />
        </Walker>

        {/* a kid, running ahead of all of them */}
        <Walker from={-110} to={1520} dur={62} delay={-45}>
          <Person
            x={0}
            shirt="var(--story-orange)"
            skin={1}
            scale={0.64}
            pose="walk"
          />
        </Walker>

        {/* and, this being South Florida, somebody walking an alligator.
            Drawn at 67 units and then scaled down, because at full size it
            came out around ten feet long next to its owner — a real length of
            alligator, but not one anybody walks on a lead. 0.68 puts it at
            roughly six feet, which is both plausible and still unmistakable
            at the size this scene actually renders. */}
        <Walker from={-190} to={1500} dur={92} delay={-58}>
          <Person x={0} shirt="var(--story-coral)" skin={3} pose="walk" />
          <Gator x={38} scale={0.68} fill={GATOR} />
          {/* The lead is orange, and drawn last so it sits on top of the
              gator rather than behind it. A collar on a long low animal is at
              the far end from its owner, so the lead has to cross the
              creature's own back to get there — there is no arrangement of
              the two that avoids it. In the gator's own navy that crossing
              turned into one indistinct mass; in orange it stays a separate
              object over both the navy and the cream, which is the whole
              reason it reads as a lead at all. */}
          <path
            d="M 7.5 -13.5 Q 25 -11.4 42 -8.7"
            transform={`translate(0 ${GROUND})`}
            stroke="var(--story-orange)"
            strokeWidth="1.1"
            strokeLinecap="round"
            fill="none"
          />
        </Walker>
      </g>

      <rect
        x="0"
        y={GROUND - 4}
        width="1440"
        height="4"
        className="street-kerb"
      />
    </svg>
  );
}
