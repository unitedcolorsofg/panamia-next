import Link from 'next/link';
import { Gift, HeartHandshake } from 'lucide-react';

// Static placeholder — cache at the edge, revalidate hourly (Workers Cache).
// Fill in the report content (metrics, stories, financials) as it's published.
export const revalidate = 3600;

export const metadata = {
  title: 'Impact Report | Pana MIA',
  description:
    'How Pana Mia is investing in the community — programs, reach, and outcomes.',
};

export default function ImpactPage() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-12">
      <div className="mb-10 text-center">
        <HeartHandshake className="text-primary mx-auto mb-4 h-10 w-10" />
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Impact Report
        </h1>
        <p className="text-muted-foreground mt-4 text-lg">
          How Pana Mia is investing in the community — the programs we run, the
          people we reach, and where support goes.
        </p>
      </div>

      <div className="border-border bg-card rounded-xl border p-8 text-center">
        <p className="text-muted-foreground leading-relaxed">
          Our first impact report is on the way. Check back soon for community
          metrics, member stories, and a transparent look at how contributions
          are put to work.
        </p>
        <Link
          href="/donate"
          className="bg-primary text-primary-foreground hover:bg-primary/90 mt-6 inline-flex items-center gap-2 rounded-full px-5 py-2.5 font-semibold transition-colors"
        >
          <Gift className="h-4 w-4" />
          Support the mission
        </Link>
      </div>
    </div>
  );
}
