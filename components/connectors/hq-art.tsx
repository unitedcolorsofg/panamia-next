/**
 * The drawn vignette in the top right of Connector HQ.
 *
 * ## Why a drawing and not a photograph
 *
 * Same argument the homepage makes for its street band: a photograph of a
 * block would have to be a photograph of *a* block — one neighbourhood, one
 * set of businesses — and the programme runs across three counties. A drawing
 * can be everybody's. It also stays sharp at any size, costs nothing to
 * download, recolours with the palette, and needs no licence or photo credit.
 *
 * ## Why it is built out of the homepage's parts
 *
 * The brief was "along the lines of the art style of the main page", so this
 * is the same construction rather than a lookalike: flat fills with no
 * strokes, rounded rects, window grids that make a block read as tall, an
 * awning with a scalloped hem, and people drawn as two legs, a tapering
 * torso, a circle head and an arc of hair. Anyone who has read
 * `components/home/scene-art.tsx` will recognise every shape in here.
 *
 * It is not *imported* from there, though, and that is deliberate. That file
 * draws in `--story-*`, a palette scoped by `body:has(...)` selectors to the
 * homepage, the directory and the offering pages. None of those selectors
 * match on Connectors, so every colour in a reused `StreetScene` would
 * resolve to nothing here. This draws in `--color-pana-*` instead, which is
 * the registry the whole site has.
 *
 * ## Why there is no foliage
 *
 * The homepage's palms and street tree wear `--story-green`, and globals.css
 * is explicit that green is scoped to that one page because the palette does
 * not have one. Rather than invent a seventh colour for a decorative palm, or
 * draw a palm in a colour palms are not, the block here is buildings and
 * people. The people were always the point — the buildings are only ever the
 * setting.
 *
 * ## Why it is framed
 *
 * The homepage's scene is a full-width band with the page's own ground under
 * it. Dropped into a small box beside a heading, the same drawing reads as a
 * fragment someone forgot to crop. The rounded ink frame gives it an edge of
 * its own, and borrows the one the panels below already use, so it sits in
 * the page as a deliberate object rather than as a floating cutout.
 *
 * Nothing here is content, so the whole thing is `aria-hidden`. A screen
 * reader gets the heading and the dl beside it, which say the same thing in
 * words.
 */

/** The pavement. Everything in the near plane stands on this line. */
const GROUND = 150;
/** Roofline of the pale blocks behind. Distance, not architecture. */
const FAR_BASE = 150;

/**
 * Walls that would otherwise be page-cream. A cream building on cream paper
 * is a hole rather than a building, so the pale ones take a little orange —
 * enough to have an edge without becoming a colour.
 */
const PALE = 'color-mix(in srgb, var(--color-pana-orange) 20%, #fff7ec)';

/** The blocks in the back plane, washed most of the way to the paper. */
const FAR = 'color-mix(in srgb, var(--color-pana-indigo) 26%, #fff7ec)';

/**
 * The shop's wall. A second pale, pulled toward red rather than orange, so
 * the middle of the block does not read as one continuous building with the
 * Deco block beside it. Cream here was the mistake the homepage file warns
 * about: against the butter sky the wall had no edge and the awning appeared
 * to be floating.
 */
const BLUSH = 'color-mix(in srgb, var(--color-pana-red) 14%, #fff7ec)';

/** Glass. Indigo let most of the way down to cream, as on the homepage. */
const GLASS = 'color-mix(in srgb, var(--color-pana-indigo) 55%, #fff7ec)';

/** Skin, mixed from the palette rather than imported from outside it: orange
 *  toward cream for lighter, orange toward ink for deeper. Three tones, so a
 *  group of three is visibly a group. */
const SKIN = [
  'color-mix(in srgb, var(--color-pana-orange) 42%, #fff7ec)',
  'color-mix(in srgb, var(--color-pana-orange) 64%, #110d0d)',
  'color-mix(in srgb, var(--color-pana-orange) 40%, #110d0d)',
];

/** A window grid. What makes a rectangle read as a building. */
function Windows({
  x,
  y,
  w,
  h,
  cols,
  rows,
  fill,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  cols: number;
  rows: number;
  fill: string;
}) {
  const colGap = w / (cols + 1);
  const rowGap = h / (rows + 1);

  return (
    <>
      {Array.from({ length: rows }, (_, r) =>
        Array.from({ length: cols }, (_, c) => (
          <rect
            key={`${r}-${c}`}
            x={x + colGap * (c + 1) - 3.5}
            y={y + rowGap * (r + 1) - 4}
            width="7"
            height="8"
            rx="1.2"
            fill={fill}
            /* Every third window dark, on a stride that lines up with
               neither axis, so the grid does not read as a pattern. */
            opacity={(r * cols + c + r) % 3 === 0 ? 0.35 : 1}
          />
        ))
      )}
    </>
  );
}

/**
 * One pana. Two legs, a torso that tapers from the shoulders, a head and an
 * arc of hair — the homepage's figure, built the same way at a smaller size.
 */
function Person({
  x,
  shirt,
  skin,
  scale = 1,
}: {
  x: number;
  shirt: string;
  skin: string;
  scale?: number;
}) {
  return (
    <g transform={`translate(${x} ${GROUND}) scale(${scale})`}>
      <rect x="-4.6" y="-14" width="4" height="14" rx="2" fill="#110d0d" />
      <rect x="0.6" y="-14" width="4" height="14" rx="2" fill="#110d0d" />
      <path
        d="M -5.5 -28 a 5.5 5.5 0 0 1 11 0 l 0.9 14 q -6.4 2.3 -12.8 0 z"
        fill={shirt}
      />
      <rect x="5" y="-26" width="3.6" height="13" rx="1.8" fill={shirt} />
      <circle cx="0" cy="-32.5" r="5" fill={skin} />
      <path d="M -5 -33.8 a 5 5 0 0 1 10 0 q -5 -2.7 -10 0 z" fill="#110d0d" />
    </g>
  );
}

/**
 * The block itself.
 *
 * The svg carries no width of its own beyond `w-full`: it fills whatever box
 * the caller puts it in, and the viewBox keeps the proportions. Sizing lives
 * at the call site because only the call site knows how much room is going
 * spare next to the text.
 */
export function HqArt({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 300 180"
      className={`block h-auto w-full ${className}`}
      aria-hidden="true"
      focusable="false"
    >
      {/* The frame, and the paper inside it. Drawn first so everything else
          sits on top of it. */}
      <rect
        x="1.25"
        y="1.25"
        width="297.5"
        height="177.5"
        rx="14"
        fill="var(--color-pana-butter-2)"
        stroke="var(--color-pana-ink)"
        strokeWidth="2.5"
      />

      {/* Everything past here is clipped to the frame, so a roofline or an
          elbow can run to the edge without escaping the rounded corner. */}
      <clipPath id="hq-art-frame">
        <rect x="1.25" y="1.25" width="297.5" height="177.5" rx="14" />
      </clipPath>

      <g clipPath="url(#hq-art-frame)">
        {/* Sun. A flat disc, dropped in the gap between the tower and the
            house at the end so it has sky to sit in. Yellow rather than
            butter: butter is a half-step from the butter-2 sky behind it and
            the disc disappeared into the paper. */}
        <circle cx="262" cy="42" r="18" fill="var(--color-pana-yellow)" />

        {/* Back plane: pale blocks, one flat tint, no detail. */}
        <rect x="6" y="74" width="40" height={FAR_BASE - 74} fill={FAR} />
        <rect x="42" y="60" width="32" height={FAR_BASE - 60} fill={FAR} />
        <rect x="150" y="68" width="34" height={FAR_BASE - 68} fill={FAR} />
        <rect x="228" y="84" width="40" height={FAR_BASE - 84} fill={FAR} />

        {/* --- Near plane ------------------------------------------------ */}

        {/* Art Deco: a stepped parapet, the one shape that says Miami Beach
            without needing a caption. */}
        <g>
          <rect
            x="14"
            y="56"
            width="62"
            height={GROUND - 56}
            rx="2"
            fill={PALE}
          />
          <rect x="32" y="46" width="26" height="12" fill={PALE} />
          <rect x="41" y="38" width="8" height="10" fill={PALE} />
          <rect
            x="14"
            y="56"
            width="62"
            height="4"
            fill="var(--color-pana-flame)"
          />
          {/* Pilasters. Deco buildings are banded vertically as well as
              horizontally, and without them a pale wall is just a rectangle. */}
          <rect
            x="24"
            y="60"
            width="3"
            height={GROUND - 60}
            fill="var(--color-pana-flame)"
            opacity="0.5"
          />
          <rect
            x="63"
            y="60"
            width="3"
            height={GROUND - 60}
            fill="var(--color-pana-flame)"
            opacity="0.5"
          />
          <Windows x={14} y={64} w={62} h={50} cols={3} rows={3} fill={GLASS} />
          {/* Door, in the shop's awning red rather than in glass. The whole
              left of the block is pale, and without one warm note down here
              all the colour in the drawing sat on the right-hand side. */}
          <rect
            x="37"
            y="124"
            width="16"
            height={GROUND - 124}
            rx="1.5"
            fill="var(--color-pana-red)"
          />
        </g>

        {/* The shop. Glass front, door, and a striped awning with a
            scalloped hem — the hem sits on the wall, so its gaps are the
            wall colour rather than holes punched in the building. */}
        <g>
          <rect
            x="84"
            y="70"
            width="74"
            height={GROUND - 70}
            rx="2"
            fill={BLUSH}
          />
          <rect x="94" y="78" width="16" height="12" rx="1.5" fill={GLASS} />
          <rect
            x="132"
            y="78"
            width="16"
            height="12"
            rx="1.5"
            fill={GLASS}
            opacity="0.4"
          />

          <rect
            x="90"
            y="118"
            width="40"
            height={GROUND - 118}
            rx="1.5"
            fill={GLASS}
          />
          <rect
            x="136"
            y="118"
            width="16"
            height={GROUND - 118}
            rx="1.5"
            fill="var(--color-pana-burnt)"
          />

          <rect
            x="84"
            y="100"
            width="74"
            height="11"
            rx="1.5"
            fill="var(--color-pana-red)"
          />
          {[1, 3, 5].map((i) => (
            <rect
              key={i}
              x={84 + (74 / 6) * i}
              y="100"
              width={74 / 6}
              height="11"
              fill="var(--color-pana-cream)"
            />
          ))}
          {Array.from({ length: 6 }, (_, i) => (
            <circle
              key={`hem-${i}`}
              cx={84 + (74 / 6) * (i + 0.5)}
              cy="111"
              r="4.2"
              /* The hem hangs onto the wall, so its gaps are the wall colour
                 rather than the page's — cream circles here punched holes in
                 the building. */
              fill={i % 2 === 0 ? 'var(--color-pana-red)' : BLUSH}
            />
          ))}
        </g>

        {/* The tower. The tallest thing in the drawing, so the eye has
            somewhere to finish. */}
        <g>
          <rect
            x="166"
            y="42"
            width="56"
            height={GROUND - 42}
            rx="2"
            fill="var(--color-pana-indigo)"
          />
          <rect
            x="166"
            y="42"
            width="56"
            height="5"
            fill="var(--color-pana-butter)"
          />
          <Windows
            x={166}
            y={52}
            w={56}
            h={72}
            cols={3}
            rows={4}
            fill="var(--color-pana-butter)"
          />
          <rect
            x="185"
            y="128"
            width="18"
            height={GROUND - 128}
            rx="1.5"
            fill="var(--color-pana-butter)"
            opacity="0.55"
          />
        </g>

        {/* A low conch house at the end, to stop the block finishing on a
            vertical edge. */}
        <g>
          <rect
            x="240"
            y="106"
            width="52"
            height={GROUND - 106}
            rx="2"
            fill={PALE}
          />
          <path
            d="M 234 107 L 266 86 L 298 107 Z"
            fill="var(--color-pana-burnt)"
          />
          <rect x="248" y="118" width="13" height="12" rx="1.5" fill={GLASS} />
          <rect
            x="271"
            y="118"
            width="13"
            height={GROUND - 118}
            rx="1.5"
            fill={GLASS}
          />
        </g>

        {/* The pavement. Drawn over the building bases so they all stand on
            one line rather than each ending wherever its rect does. */}
        <rect
          x="0"
          y={GROUND}
          width="300"
          height="30"
          fill="var(--color-pana-cream)"
        />
        <rect
          x="0"
          y={GROUND}
          width="300"
          height="2.5"
          fill="var(--color-pana-ink)"
        />

        {/* The people. The buildings are the setting; this is the point. */}
        <Person
          x={58}
          shirt="var(--color-pana-indigo)"
          skin={SKIN[0]}
          scale={1.04}
        />
        <Person
          x={84}
          shirt="var(--color-pana-red)"
          skin={SKIN[1]}
          scale={0.94}
        />
        <Person
          x={200}
          shirt="var(--color-pana-burnt)"
          skin={SKIN[2]}
          scale={1}
        />
      </g>
    </svg>
  );
}
