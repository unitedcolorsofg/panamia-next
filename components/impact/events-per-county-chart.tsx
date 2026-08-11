'use client';

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

/**
 * Share of 2025 events by county, transcribed from the GHL "Impact Report"
 * funnel chart. The source gives percentages only, so percentages are what is
 * stored and rendered — deriving counts from them would invent precision the
 * report does not have.
 */
const COUNTIES = [
  { label: 'Miami', share: 70, color: '#fc2070' }, // pana-pink
  { label: 'Palm Beach', share: 17, color: '#4ab3ea' }, // pana-blue
  { label: 'Broward', share: 13, color: '#ff8100' }, // pana-orange
] as const;

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number }>;
}) {
  if (!active || !payload?.length) return null;
  const slice = payload[0];
  const county = COUNTIES.find((c) => c.label === slice.name);
  return (
    // Inline colours, not utilities: the shadcn tokens are bare HSL triples, so
    // `bg-popover` emits an invalid declaration the browser drops. See the
    // KNOWN BUG note in app/globals.css.
    <div
      className="rounded-lg border px-3 py-2 shadow-md"
      style={{
        background: 'hsl(var(--popover))',
        borderColor: 'hsl(var(--border))',
        color: 'hsl(var(--popover-foreground))',
      }}
    >
      <p className="flex items-center gap-2 text-sm">
        <span
          aria-hidden="true"
          className="inline-block h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: county?.color }}
        />
        <span className="font-semibold">{slice.name}</span>
        <span className="ml-auto font-medium">{slice.value}%</span>
      </p>
    </div>
  );
}

export default function EventsPerCountyChart() {
  return (
    <figure className="my-8">
      <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-center">
        <ResponsiveContainer
          width="100%"
          height={280}
          className="max-w-[320px]"
        >
          <PieChart>
            <Pie
              data={COUNTIES as unknown as Array<Record<string, unknown>>}
              dataKey="share"
              nameKey="label"
              cx="50%"
              cy="50%"
              outerRadius={110}
              startAngle={90}
              endAngle={-270}
              stroke="hsl(var(--background))"
              strokeWidth={2}
            >
              {COUNTIES.map((county) => (
                <Cell key={county.label} fill={county.color} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
          </PieChart>
        </ResponsiveContainer>

        {/* Legend doubles as the direct-label channel, so identity never rests
            on colour alone. */}
        <ul className="space-y-2">
          {COUNTIES.map((county) => (
            <li key={county.label} className="flex items-center gap-2 text-sm">
              <span
                aria-hidden="true"
                className="inline-block h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: county.color }}
              />
              <span className="text-foreground font-medium">
                {county.label}
              </span>
              <span className="text-muted-foreground tabular-nums">
                {county.share}%
              </span>
            </li>
          ))}
        </ul>
      </div>

      <figcaption className="text-muted-foreground mt-3 text-center text-sm">
        Share of 2025 events by county.
      </figcaption>
    </figure>
  );
}
