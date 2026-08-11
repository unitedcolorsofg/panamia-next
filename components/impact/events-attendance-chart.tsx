'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useRevealOnView } from '@/hooks/use-reveal-on-view';

/**
 * 2025 event attendance, by month and county.
 *
 * Transcribed from the GHL "Impact Report" funnel chart. The four values above
 * BREAK were read off the source chart's data labels; the rest were read off
 * its axis. They sum to 5,320, which corroborates the report copy's "total
 * attendance of over 5,000 people".
 *
 * February has no bar because no event ran that month. The report copy counts
 * 17 sponsored events against the 16 bars here — one month/county pairing hosted
 * two events and is charted as a single combined bar.
 */
const COUNTIES = [
  { key: 'miami', label: 'Miami', color: '#fc2070' }, // pana-pink
  { key: 'broward', label: 'Broward', color: '#ff8100' }, // pana-orange
  { key: 'palmBeach', label: 'Palm Beach', color: '#4ab3ea' }, // pana-blue
] as const;

type CountyKey = (typeof COUNTIES)[number]['key'];

const DATA: Array<{ month: string } & Partial<Record<CountyKey, number>>> = [
  { month: 'Jan', miami: 20 },
  { month: 'Feb' },
  { month: 'Mar', miami: 60 },
  { month: 'Apr', miami: 2250 },
  { month: 'May', miami: 115 },
  { month: 'Jun', miami: 50 },
  { month: 'Jul', miami: 145, broward: 40, palmBeach: 80 },
  { month: 'Aug', miami: 750 },
  { month: 'Sep', miami: 30, broward: 40 },
  { month: 'Oct', palmBeach: 160 },
  { month: 'Nov', miami: 100, palmBeach: 80 },
  { month: 'Dec', miami: 400, broward: 1000 },
];

/**
 * The scale break.
 *
 * April (2,250) is roughly 14x the largest sub-break month, so a single linear
 * axis would flatten every bar under ~150 into an unreadable sliver. The axis
 * is therefore two linear segments: 0–200 at full resolution, then a visible
 * gap, then 200–2,250 compressed into UPPER_SPAN.
 *
 * Both segments stay linear so rank order is preserved within each — this
 * compresses the top of the scale but never reorders bars, which is the failure
 * mode of the source chart (it drew Dec/Broward at 1,000 nearly level with
 * Apr at 2,250).
 */
const BREAK = 200;
const MAX = 2250;
const GAP = 22;
const UPPER_SPAN = 98;
const DOMAIN_MAX = BREAK + GAP + UPPER_SPAN;

/** Real attendance value -> position on the two-segment axis. */
function toDisplay(value: number): number {
  if (value <= BREAK) return value;
  return BREAK + GAP + ((value - BREAK) / (MAX - BREAK)) * UPPER_SPAN;
}

/**
 * Chart colours.
 *
 * Written as `hsl(var(--token))` rather than Tailwind utilities: the shadcn
 * tokens in globals.css are bare HSL triples, so `fill-background` and friends
 * emit `fill: 0 0% 100%` and the browser drops them (see the KNOWN BUG note in
 * app/globals.css). Wrapping the var in hsl() is what makes them real colours,
 * and it still follows `.dark` through the cascade.
 */
const INK = {
  grid: 'hsl(var(--border))',
  axis: 'hsl(var(--muted-foreground))',
  label: 'hsl(var(--foreground))',
  cursor: 'hsl(var(--muted))',
};

// 2,000 is omitted: above the break the ticks sit close enough that Recharts
// drops it as a collision anyway, so asking for it just makes spacing uneven.
const TICKS = [0, 50, 100, 150, 200, 500, 1000, 2250];
const TICK_POSITIONS = TICKS.map(toDisplay);

function tickLabel(position: number): string {
  let nearest = TICKS[0];
  let best = Infinity;
  TICK_POSITIONS.forEach((p, i) => {
    const d = Math.abs(p - position);
    if (d < best) {
      best = d;
      nearest = TICKS[i];
    }
  });
  return nearest.toLocaleString('en-US');
}

/** Rows in display space, with the real values kept for labels and tooltips. */
const CHART_DATA = DATA.map((row) => {
  const out: Record<string, string | number> = { month: row.month };
  for (const { key } of COUNTIES) {
    const value = row[key];
    if (value === undefined) continue;
    out[key] = toDisplay(value);
    out[`${key}Real`] = value;
  }
  return out;
});

const TOTAL = DATA.reduce(
  (sum, row) => sum + COUNTIES.reduce((s, { key }) => s + (row[key] ?? 0), 0),
  0
);

/**
 * Direct label for bars that cross the break.
 *
 * Only these carry a number: below the break the axis is at full resolution and
 * reads on its own, so labelling every bar would just be noise.
 */
function overBreakLabel() {
  // Recharts types x/y/width as `string | number`, so coerce rather than
  // narrow the signature — a narrowed one is not assignable to LabelContentType.
  //
  // The value comes from `props.value` (fed by the `${key}Real` dataKey), NOT
  // from a DATA lookup by index: Recharts only emits label entries for months
  // where this county has a bar, so with February empty the entry index runs
  // ahead of the DATA index and every label lands a month to the right.
  return function OverBreakLabel(props: {
    x?: string | number;
    y?: string | number;
    width?: string | number;
    // Recharts widens this to RenderableText (which includes null), so take it
    // as unknown and coerce.
    value?: unknown;
  }) {
    const real = Number(props.value ?? 0);
    if (!real || real <= BREAK) return null;
    const x = Number(props.x ?? 0);
    const y = Number(props.y ?? 0);
    const width = Number(props.width ?? 0);
    const cx = x + width / 2;
    return (
      <text
        x={cx}
        y={y - 7}
        textAnchor="middle"
        fill={INK.label}
        fontSize={11}
        fontWeight={600}
      >
        {real.toLocaleString('en-US')}
      </text>
    );
  };
}

interface TooltipPayloadItem {
  dataKey: string;
  payload: Record<string, number | string>;
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-lg border px-3 py-2 shadow-md"
      style={{
        background: 'hsl(var(--popover))',
        borderColor: 'hsl(var(--border))',
        color: 'hsl(var(--popover-foreground))',
      }}
    >
      <p className="mb-1 text-sm font-semibold">{label}</p>
      {payload.map((item) => {
        const county = COUNTIES.find((c) => c.key === item.dataKey);
        if (!county) return null;
        const real = item.payload[`${county.key}Real`];
        return (
          <p key={county.key} className="flex items-center gap-2 text-sm">
            <span
              aria-hidden="true"
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: county.color }}
            />
            <span>{county.label}</span>
            <span className="ml-auto font-medium">
              {Number(real).toLocaleString('en-US')}
            </span>
          </p>
        );
      })}
    </div>
  );
}

/** Entrance timing. Series are staggered so the counties arrive in order. */
const BAR_ANIMATION_MS = 750;
const BAR_STAGGER_MS = 130;

export default function EventsAttendanceChart() {
  const { ref, revealed, reducedMotion } = useRevealOnView<HTMLDivElement>();

  return (
    <figure className="my-8">
      {/* The height is reserved whether or not the chart has mounted, so the
          reveal cannot shift the page under someone mid-scroll. */}
      <div ref={ref} className="relative" style={{ minHeight: 420 }}>
        {revealed && (
          <ResponsiveContainer width="100%" height={420}>
            <BarChart
              data={CHART_DATA}
              margin={{ top: 36, right: 8, bottom: 8, left: 8 }}
              barGap={2}
            >
              <CartesianGrid vertical={false} stroke={INK.grid} />
              <XAxis
                dataKey="month"
                tickLine={false}
                axisLine={false}
                tick={{ fill: INK.axis, fontSize: 12 }}
              />
              <YAxis
                type="number"
                domain={[0, DOMAIN_MAX]}
                ticks={TICK_POSITIONS}
                tickFormatter={tickLabel}
                tickLine={false}
                axisLine={false}
                width={48}
                tick={{ fill: INK.axis, fontSize: 12 }}
              />
              {/* No band is drawn across the plot: the bars run continuously and
                the break is carried by the axis marks and the caption alone. */}
              <Tooltip
                content={<ChartTooltip />}
                cursor={{ fill: INK.cursor, fillOpacity: 0.4 }}
              />
              <Legend
                verticalAlign="top"
                height={32}
                iconType="circle"
                formatter={(value) => (
                  <span style={{ color: INK.axis, fontSize: 14 }}>{value}</span>
                )}
              />
              {COUNTIES.map(({ key, label, color }, seriesIndex) => (
                <Bar
                  key={key}
                  dataKey={key}
                  name={label}
                  fill={color}
                  maxBarSize={24}
                  radius={[4, 4, 0, 0]}
                  isAnimationActive={!reducedMotion}
                  animationBegin={seriesIndex * BAR_STAGGER_MS}
                  animationDuration={BAR_ANIMATION_MS}
                  animationEasing="ease-out"
                >
                  <LabelList
                    dataKey={`${key}Real`}
                    content={overBreakLabel()}
                  />
                </Bar>
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}

        {/* Break marks on the axis. Geometry is fixed because the chart height
            and margins are: the plot runs from 36px to
            420 - 8 - 32 (legend) - 24 (x labels). */}
        {revealed && (
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute left-[34px] w-[26px]"
            style={{
              top: `${36 + (1 - (BREAK + GAP / 2) / DOMAIN_MAX) * 316}px`,
            }}
            height="20"
            viewBox="0 0 26 20"
          >
            <path
              d="M2 16 L13 4 M11 16 L22 4"
              stroke={INK.label}
              strokeWidth="2"
              strokeLinecap="round"
              fill="none"
            />
          </svg>
        )}
      </div>

      <figcaption className="text-muted-foreground mt-3 text-sm">
        Attendance by month and county. The vertical axis is broken between 200
        and 500 — April&apos;s 2,250 would otherwise flatten every other month.
        Bars above the break are labelled with their exact figures.
      </figcaption>

      {/* Contrast relief + the non-visual route to the same numbers. */}
      <details className="mt-4">
        <summary className="text-muted-foreground hover:text-foreground cursor-pointer text-sm font-medium">
          View as table
        </summary>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">
              2025 Pana MIA event attendance by month and county
            </caption>
            <thead>
              <tr className="border-border border-b">
                <th scope="col" className="py-2 pr-4 font-semibold">
                  Month
                </th>
                {COUNTIES.map(({ key, label }) => (
                  <th
                    key={key}
                    scope="col"
                    className="py-2 pr-4 text-right font-semibold"
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DATA.map((row) => (
                <tr key={row.month} className="border-border/50 border-b">
                  <th scope="row" className="py-2 pr-4 font-normal">
                    {row.month}
                  </th>
                  {COUNTIES.map(({ key }) => (
                    <td
                      key={key}
                      className="text-muted-foreground py-2 pr-4 text-right tabular-nums"
                    >
                      {row[key]?.toLocaleString('en-US') ?? '—'}
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="font-semibold">
                <th scope="row" className="py-2 pr-4 text-left">
                  Total
                </th>
                <td colSpan={3} className="py-2 pr-4 text-right tabular-nums">
                  {TOTAL.toLocaleString('en-US')}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
