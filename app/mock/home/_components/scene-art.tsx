/**
 * The world the page is set in: sky at the top, a street under it.
 *
 * All of it is vector, none of it is a photograph. Three reasons, in order of
 * how much they mattered:
 *
 *  - It has to take the palette. The panas handed over six colours, and a
 *    drawing can simply be those six. A stock illustration of a neighbourhood
 *    would have brought its own, and the page would have been hosting someone
 *    else's palette in its largest element.
 *  - It has to survive being scrolled through. These shapes move at different
 *    rates as you come down the page, which is cheap for flat vector and
 *    expensive for a large raster.
 *  - It has to be a drawing of *this* place, not of Anytown. The street below
 *    is low-rise, wide-porched and awninged, which is what the neighbourhoods
 *    in the directory actually look like, and it ends in a park because the
 *    argument the page is making is about public space.
 *
 * Everything here is `aria-hidden`. It is scenery: it carries no information
 * that is not also written in the text beside it, and a screen reader being
 * told about nine buildings and six trees on the way to the first question
 * would be worse served than one that is not.
 */

const GROUND = 300;

/* -------------------------------------------------------------------------
   Sky
   ------------------------------------------------------------------------- */

/** One cloud, built from overlapping ellipses over a rounded slab. Drawn in
    `currentColor` so a single colour on the wrapper covers the whole shape —
    the parts must not differ, or the overlaps would show as seams. */
function Cloud({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 220 86" className={className} aria-hidden="true">
      <g fill="currentColor">
        <ellipse cx="66" cy="50" rx="42" ry="29" />
        <ellipse cx="112" cy="36" rx="36" ry="31" />
        <ellipse cx="156" cy="52" rx="38" ry="27" />
        <rect x="26" y="50" width="168" height="30" rx="15" />
      </g>
    </svg>
  );
}

/**
 * The clouds in the hero.
 *
 * Five, at different sizes and depths. The `--drift` on each one is how far
 * it travels as the hero scrolls past: the small pale ones furthest from the
 * viewer move least, the big near ones move most, which is the whole of the
 * parallax. Depth is carried by size and opacity rather than by a blur,
 * because a blurred cloud on a flat-colour sky reads as a rendering mistake.
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

/* -------------------------------------------------------------------------
   Street
   ------------------------------------------------------------------------- */

interface Placed {
  x: number;
  w: number;
  h: number;
  fill: string;
}

/** A flat-roofed block with a grid of lit windows. The tall end of the
    street. */
function Tower({ x, w, h, fill, windows }: Placed & { windows: number }) {
  const cols = Math.max(2, Math.round(w / 26));
  const gap = w / (cols + 1);
  const rows = Math.max(2, Math.round(h / 40));
  const rowGap = (h - 28) / rows;

  return (
    <g transform={`translate(${x} 0)`}>
      <rect x={0} y={GROUND - h} width={w} height={h} fill={fill} rx="3" />
      {Array.from({ length: rows }, (_, r) =>
        Array.from({ length: cols }, (_, c) => {
          // A deterministic scatter: every third window in the sequence is
          // dark, so the block looks occupied rather than switched on.
          const lit = (r * cols + c + windows) % 3 !== 0;
          return (
            <rect
              key={`${r}-${c}`}
              x={gap * (c + 1) - 5}
              y={GROUND - h + 20 + r * rowGap}
              width={10}
              height={13}
              rx="1.5"
              className={lit ? 'street-window-lit' : 'street-window-dark'}
            />
          );
        })
      )}
    </g>
  );
}

/** A pitched-roof house with a door and two windows. */
function House({
  x,
  w,
  h,
  fill,
  roof,
}: Placed & {
  roof: string;
}) {
  const eaves = GROUND - h;
  const peak = eaves - w * 0.34;

  return (
    <g transform={`translate(${x} 0)`}>
      <rect x={0} y={eaves} width={w} height={h} fill={fill} rx="2" />
      <polygon
        points={`${-8},${eaves} ${w / 2},${peak} ${w + 8},${eaves}`}
        fill={roof}
      />
      <rect
        x={w / 2 - 9}
        y={GROUND - 34}
        width={18}
        height={34}
        rx="2"
        className="street-door"
      />
      <rect
        x={w * 0.16}
        y={eaves + 18}
        width={13}
        height={13}
        rx="1.5"
        className="street-window-lit"
      />
      <rect
        x={w * 0.84 - 13}
        y={eaves + 18}
        width={13}
        height={13}
        rx="1.5"
        className="street-window-lit"
      />
    </g>
  );
}

/** A shopfront: a big window, a door, and a striped awning over both. The
    directory is mostly these. */
function Shop({ x, w, h, fill, awning }: Placed & { awning: string }) {
  const top = GROUND - h;
  const awningY = GROUND - 62;
  const stripes = Math.max(3, Math.round(w / 18));

  return (
    <g transform={`translate(${x} 0)`}>
      <rect x={0} y={top} width={w} height={h} fill={fill} rx="2" />

      <rect
        x={10}
        y={GROUND - 46}
        width={w - 46}
        height={34}
        rx="2"
        className="street-glass"
      />
      <rect
        x={w - 30}
        y={GROUND - 46}
        width={20}
        height={46}
        rx="2"
        className="street-door"
      />

      {/* The awning, drawn as a run of alternating stripes clipped to a
          scalloped hem — the same trim the rest of the site uses on section
          edges, which is where the motif came from. */}
      <g>
        <rect x={2} y={awningY} width={w - 4} height={22} fill={awning} />
        {Array.from({ length: stripes }, (_, i) =>
          i % 2 === 0 ? null : (
            <rect
              key={i}
              x={2 + ((w - 4) / stripes) * i}
              y={awningY}
              width={(w - 4) / stripes}
              height={22}
              className="street-awning-stripe"
            />
          )
        )}
        {/* The hem, one colour rather than alternating with the wall — striped
            scallops read as teeth at this size, which is not the note a row of
            friendly shopfronts wants to end on. */}
        {Array.from({ length: stripes }, (_, i) => (
          <circle
            key={`hem-${i}`}
            cx={2 + ((w - 4) / stripes) * (i + 0.5)}
            cy={awningY + 22}
            r={(w - 4) / stripes / 2}
            fill={awning}
          />
        ))}
      </g>
    </g>
  );
}

/** A round-canopy tree. The park at the end of the street. */
function Tree({
  x,
  scale = 1,
  fill,
}: {
  x: number;
  scale?: number;
  fill: string;
}) {
  return (
    <g transform={`translate(${x} ${GROUND}) scale(${scale})`}>
      <rect
        x={-5}
        y={-46}
        width={10}
        height={46}
        rx="3"
        className="street-trunk"
      />
      <circle cx={0} cy={-64} r={34} fill={fill} />
      <circle cx={-24} cy={-48} r={22} fill={fill} />
      <circle cx={24} cy={-48} r={22} fill={fill} />
    </g>
  );
}

/** A park bench, in silhouette. Small, and the only thing on the street built
    for sitting still in. */
function Bench({ x }: { x: number }) {
  return (
    <g transform={`translate(${x} ${GROUND})`} className="street-bench">
      <rect x={-26} y={-18} width={52} height={5} rx="2" />
      <rect x={-26} y={-27} width={52} height={5} rx="2" />
      <rect x={-22} y={-18} width={5} height={18} rx="2" />
      <rect x={17} y={-18} width={5} height={18} rx="2" />
    </g>
  );
}

/**
 * The street.
 *
 * Read left to right it goes houses → shops → the tall end of the block →
 * shops again → park, which is the shape of an actual walk rather than a
 * skyline. The park is given the last quarter of the width on purpose: the
 * page is about to start arguing for public space, and it helps if you have
 * just scrolled past some.
 *
 * `preserveAspectRatio="xMidYMax meet"` pins the drawing to its own baseline,
 * so on a wide screen the street grows rather than floating off the ground.
 */
export function StreetScene() {
  return (
    <div className="street" aria-hidden="true">
      <svg
        viewBox={`0 0 1440 ${GROUND}`}
        preserveAspectRatio="xMidYMax meet"
        className="street-svg"
      >
        {/* Back row: a few blocks set behind the street, in a flatter tone, so
            the front row has something to stand against. */}
        <g className="street-back">
          <Tower x={196} w={88} h={196} fill="currentColor" windows={1} />
          <Tower x={402} w={104} h={238} fill="currentColor" windows={2} />
          <Tower x={742} w={96} h={210} fill="currentColor" windows={0} />
          <Tower x={968} w={84} h={168} fill="currentColor" windows={2} />
        </g>

        <House
          x={16}
          w={116}
          h={92}
          fill="var(--story-coral)"
          roof="var(--story-ink)"
        />
        <Shop
          x={150}
          w={132}
          h={124}
          fill="var(--story-cream)"
          awning="var(--story-orange)"
        />
        <House
          x={300}
          w={104}
          h={86}
          fill="var(--story-orange)"
          roof="var(--story-ink)"
        />

        <Tower x={424} w={92} h={220} fill="var(--story-blue)" windows={1} />
        <Tower x={534} w={72} h={168} fill="var(--story-ink)" windows={2} />

        <Shop
          x={624}
          w={144}
          h={132}
          fill="var(--story-red)"
          awning="var(--story-ink)"
        />
        <House
          x={788}
          w={112}
          h={94}
          fill="var(--story-blue)"
          roof="var(--story-ink)"
        />
        <Shop
          x={918}
          w={126}
          h={118}
          fill="var(--story-cream)"
          awning="var(--story-coral)"
        />
        <Tower x={1062} w={78} h={182} fill="var(--story-orange)" windows={0} />

        {/* The park. */}
        <g className="street-park">
          <Tree x={1188} scale={0.92} fill="var(--story-blue)" />
          <Tree x={1268} scale={1.12} fill="var(--story-ink)" />
          <Bench x={1330} />
          <Tree x={1388} scale={0.86} fill="var(--story-blue)" />
        </g>

        {/* The pavement the whole row stands on. */}
        <rect
          x={0}
          y={GROUND - 4}
          width={1440}
          height={4}
          className="street-kerb"
        />
      </svg>
    </div>
  );
}
