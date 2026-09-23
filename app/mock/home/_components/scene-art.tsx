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
 * Nothing here is interactive and nothing here is content, so the whole
 * scene is `aria-hidden`. A screen reader gets the prose instead.
 */

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
 * Five clouds at five sizes and five opacities. They drift on their own
 * clock — see `home-cloud-float` — and are pushed a second time by the
 * scroll position, which is what gives the top of the page its parallax.
 */
export function SkyClouds() {
  return (
    <div className="sky-clouds" aria-hidden="true">
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

/** A single-storey house: pitched roof, a door, two windows. */
function House({ x, w, h, fill, ground = ROW_NEAR }: Placed) {
  const top = ground - h;
  const eaves = top + h * 0.34;
  const doorW = w * 0.2;
  const doorH = h * 0.42;

  return (
    <g>
      <path
        d={`M ${x} ${eaves} L ${x + w / 2} ${top} L ${x + w} ${eaves} Z`}
        className="street-roof"
      />
      <rect
        x={x}
        y={eaves}
        width={w}
        height={ground - eaves}
        fill={fill}
        rx="2"
      />
      <rect
        x={x + w / 2 - doorW / 2}
        y={ground - doorH}
        width={doorW}
        height={doorH}
        rx="2"
        className="street-door"
      />
      <rect
        x={x + w * 0.14}
        y={eaves + h * 0.16}
        width={w * 0.18}
        height={h * 0.18}
        rx="2"
        className="street-window-lit"
      />
      <rect
        x={x + w * 0.68}
        y={eaves + h * 0.16}
        width={w * 0.18}
        height={h * 0.18}
        rx="2"
        className="street-window-lit"
      />
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

type Pose = 'stand' | 'walk' | 'carry' | 'push';

interface PersonProps {
  x: number;
  /** 1 light, 2 medium, 3 deep. All three are mixed from the palette. */
  skin?: 1 | 2 | 3;
  shirt: string;
  hair?: string;
  pose?: Pose;
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

      {/* The near arm. Carrying shortens it and swings it forward — that,
          plus the bag below, is the whole gesture. */}
      <rect
        x={pose === 'carry' ? 5 : 5.5}
        y="-28"
        width="4"
        height={pose === 'carry' ? 11 : 15}
        rx="2"
        fill={shirt}
      />
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
 * The town. `xMidYMax meet` pins it to the bottom of its box, so when the
 * viewport is narrower than the drawing the buildings stay standing on the
 * kerb and the sky is what gets cropped.
 */
export function StreetScene() {
  return (
    <svg
      className="street-svg"
      viewBox="0 58 1440 310"
      preserveAspectRatio="xMidYMax meet"
      fill="none"
      aria-hidden="true"
    >
      {/* --- far: skyline, one flat tint, no detail ------------------- */}
      <g className="street-back">
        <Slab x={40} w={70} top={132} />
        <Slab x={150} w={86} top={86} />
        <Slab x={272} w={74} top={124} />
        <Slab x={382} w={92} top={70} />
        <Slab x={512} w={78} top={112} />
        <Slab x={632} w={96} top={78} />
        <Slab x={772} w={82} top={120} />
        <Slab x={892} w={88} top={92} />
        <Slab x={1022} w={76} top={136} />
        <Slab x={1132} w={90} top={82} />
        <Slab x={1258} w={80} top={118} />
        <Slab x={1368} w={72} top={140} />
      </g>

      {/* --- mid: the same town, smaller and washed toward the paper ---
              Red is deliberately absent from this row. Half opacity over
              cream turns it pink, which is not a colour we have. Orange,
              coral and blue all wash to something still in the family. */}
      <g className="street-mid">
        <House
          x={10}
          w={92}
          h={70}
          fill="var(--story-coral)"
          ground={ROW_MID}
        />
        <Shop
          x={118}
          w={104}
          h={92}
          fill={PALE}
          awning="var(--story-orange)"
          ground={ROW_MID}
        />
        <House
          x={242}
          w={86}
          h={66}
          fill="var(--story-blue)"
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
        <House
          x={462}
          w={90}
          h={72}
          fill="var(--story-orange)"
          ground={ROW_MID}
        />
        <Shop
          x={570}
          w={102}
          h={90}
          fill={PALE}
          awning="var(--story-coral)"
          ground={ROW_MID}
        />
        <House
          x={692}
          w={88}
          h={68}
          fill="var(--story-orange)"
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
        <House
          x={916}
          w={92}
          h={70}
          fill="var(--story-coral)"
          ground={ROW_MID}
        />
        <Shop
          x={1026}
          w={98}
          h={88}
          fill={PALE}
          awning="var(--story-orange)"
          ground={ROW_MID}
        />
        <House
          x={1142}
          w={86}
          h={66}
          fill="var(--story-blue)"
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
        <House
          x={1364}
          w={78}
          h={64}
          fill="var(--story-orange)"
          ground={ROW_MID}
        />
      </g>

      {/* --- near: full size, full colour ----------------------------- */}
      <g className="street-near">
        <House x={-10} w={118} h={96} fill="var(--story-coral)" />
        <Shop
          x={126}
          w={136}
          h={126}
          fill={PALE}
          awning="var(--story-orange)"
        />
        <House x={286} w={106} h={86} fill="var(--story-orange)" />
        <Tower x={410} w={84} h={182} fill="var(--story-blue)" />
        <Shop
          x={514}
          w={140}
          h={130}
          fill="var(--story-red)"
          awning="var(--story-ink)"
        />
        <House x={678} w={112} h={92} fill="var(--story-blue)" />
        <Shop x={810} w={132} h={122} fill={PALE} awning="var(--story-coral)" />
        <House x={962} w={108} h={88} fill="var(--story-coral)" />
        <Tower x={1090} w={78} h={170} fill="var(--story-ink)" />
      </g>

      {/* --- the park at the end of the block ------------------------- */}
      <g className="street-park">
        <Tree x={1212} scale={0.94} fill="var(--story-blue)" />
        <Tree x={1300} scale={1.06} fill="var(--story-blue)" />
        <Tree x={1424} scale={0.86} fill="var(--story-ink)" />
        <Bench x={1350} />
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

        <Person
          x={508}
          shirt="var(--story-coral)"
          skin={1}
          flip
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

      {/* --- the pavement: everyone else ------------------------------ */}
      <g className="street-crowd">
        {/* two walking together, with a dog */}
        <Person x={62} shirt="var(--story-blue)" skin={2} pose="walk" />
        <Person x={92} shirt="var(--story-orange)" skin={1} pose="walk" />
        <Dog x={126} fill="var(--story-ink)" />

        {/* a pair stopped mid-conversation */}
        <Person x={186} shirt="var(--story-red)" skin={3} />
        <Person x={214} shirt="var(--story-coral)" skin={1} flip />

        {/* shoppers in front of the stalls */}
        <Person x={356} shirt="var(--story-coral)" skin={1} pose="carry" />
        <Person x={398} shirt="var(--story-blue)" skin={3} flip />
        <Person
          x={420}
          shirt="var(--story-orange)"
          skin={3}
          scale={0.66}
          pose="walk"
        />
        <Person x={570} shirt="var(--story-ink)" skin={2} pose="carry" />
        <Person x={610} shirt="var(--story-red)" skin={1} pose="walk" flip />
        <Person x={806} shirt="var(--story-orange)" skin={2} pose="carry" />

        {/* further down the block */}
        <Person x={886} shirt="var(--story-coral)" skin={2} pose="walk" />
        <Person x={944} shirt="var(--story-blue)" skin={1} pose="push" />
        <Pram x={956} fill="var(--story-red)" />
        <Person x={1044} shirt="var(--story-orange)" skin={3} />
        <Person x={1068} shirt="var(--story-red)" skin={1} flip />
        <Person x={1152} shirt="var(--story-blue)" skin={2} pose="carry" />

        {/* the park */}
        <Person x={1258} shirt="var(--story-red)" skin={1} />
        <Person
          x={1278}
          shirt="var(--story-orange)"
          skin={1}
          scale={0.62}
          pose="walk"
        />
        <Person x={1382} shirt="var(--story-coral)" skin={3} pose="walk" flip />
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
