import type { Metadata } from 'next';
import { IntroSection } from '@/components/relay/IntroSection';
import { EnrollSection } from '@/components/relay/EnrollSection';
import { RotateKeysSection } from '@/components/relay/RotateKeysSection';
import { ImportInstructions } from '@/components/relay/ImportInstructions';
import { FaqSection } from '@/components/relay/FaqSection';

export const metadata: Metadata = {
  title: 'Pana Resilience Network',
  description:
    'Generate a Nostr keypair and join the Pana MIA community relay.',
};

export default async function ResiliencePage() {
  return (
    <div className="container mx-auto px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <header className="mb-8">
          <h1 className="text-3xl font-bold">Pana Resilience Network</h1>
          <p className="text-muted-foreground mt-2">
            A community-run, peer-friendly messaging layer for Pana MIA members.
          </p>
        </header>

        <IntroSection />
        <EnrollSection />
        {/* Self-gates: renders only for already-enrolled members. */}
        <div className="mb-10">
          <RotateKeysSection context="page" />
        </div>
        <ImportInstructions />
        <FaqSection />
      </div>
    </div>
  );
}
