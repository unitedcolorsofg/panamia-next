import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Accessibility Statement - Pana MIA Club',
  description:
    'WCAG 2.2 AA accessibility conformance statement for Pana MIA Club',
};

function Placeholder({ label }: { label: string }) {
  return (
    <p className="rounded border border-dashed border-yellow-500/50 bg-yellow-50/50 p-4 text-sm text-yellow-800 dark:bg-yellow-950/20 dark:text-yellow-200">
      {label} — full text to be drafted.
    </p>
  );
}

export default function AccessibilityStatementPage() {
  return (
    <>
      <header className="mb-8 border-b pb-6">
        <h1 className="text-4xl font-bold">Accessibility Statement</h1>
      </header>

      <article className="prose prose-gray dark:prose-invert max-w-none leading-relaxed">
        <section id="commitment">
          <h2>Our Commitment</h2>
          <p>
            Pana MIA Club is committed to ensuring digital accessibility for
            people with disabilities. We continually improve the user experience
            for everyone and apply the relevant accessibility standards.
          </p>
        </section>

        <section id="conformance">
          <h2>Conformance Status</h2>
          <p>
            We target conformance with the{' '}
            <strong>
              Web Content Accessibility Guidelines (WCAG) 2.2 Level AA
            </strong>
            .
          </p>
          <Placeholder label="Conformance details — current status, known limitations, third-party content disclaimer" />
        </section>

        <section id="contact" className="mt-12 border-t pt-8">
          <h2>Feedback</h2>
          <p>
            If you encounter an accessibility barrier on Pana MIA Club, please
            let us know:
          </p>
          <p>
            <a href="mailto:hola@panamia.club">hola@panamia.club</a>
          </p>
        </section>
      </article>
    </>
  );
}
