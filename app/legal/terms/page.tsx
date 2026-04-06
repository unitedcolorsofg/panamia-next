import type { Metadata } from 'next';
import Link from 'next/link';
import { moduleDefinitions, ModuleContent } from './module-content';

export const metadata: Metadata = {
  title: 'Terms of Service - Pana MIA Club',
  description: 'Terms of Service for Pana MIA Club',
};

function Placeholder({ label }: { label: string }) {
  return (
    <p className="rounded border border-dashed border-yellow-500/50 bg-yellow-50/50 p-4 text-sm text-yellow-800 dark:bg-yellow-950/20 dark:text-yellow-200">
      {label} — full legal text to be drafted.
    </p>
  );
}

export default function TermsPage() {
  return (
    <>
      <header className="mb-8 border-b pb-6">
        <h1 className="text-4xl font-bold">Terms of Service</h1>
        <p className="text-muted-foreground mt-2">Version 2.0.0 — Draft</p>
      </header>

      {/* Plain-language summary */}
      <section id="summary" className="mb-12">
        <h2 className="mb-4 text-2xl font-bold">Plain-Language Summary</h2>
        <div className="bg-muted/30 space-y-4 rounded-lg border p-6 text-sm">
          <p>
            <strong>Who can use Pana MIA Club:</strong> You must be 18 or older.
            One account per person.
          </p>
          <p>
            <strong>Your content is CC-licensed:</strong> Everything you publish
            (articles, posts, photos) must be licensed under Creative Commons
            (CC BY 4.0 or CC BY-SA 4.0). This license is irrevocable — once you
            publish, others retain the right to share and adapt your work even
            if you later remove it.
          </p>
          <p>
            <strong>No AI-generated content:</strong> Wholly AI-generated
            content is prohibited. AI-assisted tools (grammar, translation, code
            completion) are allowed with disclosure.
          </p>
          <p>
            <strong>Your data, three tiers:</strong> Your data is classified as
            Persistent, Temporary, or Peer Networking. See our{' '}
            <Link href="/legal/privacy">Privacy Policy</Link> for details.
          </p>
          <p>
            <strong>No surveillance:</strong> We do not consent to law
            enforcement data mining without valid legal process.
          </p>
          <p>
            <strong>Recording consent:</strong> Florida requires all-party
            consent for electronic recordings. Recording sessions or events
            without consent is prohibited.
          </p>
          <p>
            <strong>Disputes:</strong> Florida law, Broward County courts. No
            mandatory arbitration. No class-action waiver.
          </p>
          <p>
            <strong>Community-drafted:</strong> These terms were mutually
            prepared with the community. You may propose changes by emailing{' '}
            <a href="mailto:hola@panamia.club">hola@panamia.club</a>.
          </p>
        </div>
      </section>

      <article className="prose prose-gray dark:prose-invert max-w-none leading-relaxed">
        {/* 1. Mutual Preparation */}
        <section id="mutual-preparation">
          <h2>1. Mutual Preparation</h2>
          <p>
            These terms have been mutually prepared by Pana MIA Club and its
            community. They shall not be construed against either party as the
            drafter. Community members may request revisions or propose
            alterations to these terms by contacting{' '}
            <a href="mailto:hola@panamia.club">hola@panamia.club</a>. Proposals
            are reviewed and, where adopted, incorporated into the next
            versioned release with changelog attribution.
          </p>
        </section>

        {/* 2. Acceptance */}
        <section id="acceptance">
          <h2>2. Acceptance</h2>
          <p>
            By creating an account or using any Pana MIA Club service, you agree
            to these terms. If you do not agree, you are not permitted to use
            Pana MIA Club services. Continued use after a versioned update
            constitutes acceptance of the revised terms.
          </p>
        </section>

        {/* 3. Eligibility */}
        <section id="eligibility">
          <h2>3. Eligibility</h2>
          <p>
            Users must be 18 years of age or older. Pana MIA Club does not
            knowingly permit use by minors. Accounts discovered to belong to
            minors will be terminated and data deleted.
          </p>
        </section>

        {/* 4. Account */}
        <section id="account">
          <h2>4. Account</h2>
          <Placeholder label="Account rules: one account per person, screenname rules, termination" />
        </section>

        {/* 5. Content Licensing */}
        <section id="content-licensing">
          <h2>5. Content Licensing</h2>
          <p>
            All user-generated content uploaded to or created on Pana MIA Club
            must be licensed under one of the following Creative Commons
            licenses, selected by the user at the time of creation:
          </p>
          <ul>
            <li>
              <strong>CC BY 4.0</strong> — Anyone may share and adapt the work,
              with attribution.
            </li>
            <li>
              <strong>CC BY-SA 4.0</strong> — Same as CC BY, plus adaptations
              must use the same license.
            </li>
          </ul>
          <p>
            No traditionally copyrighted (&quot;all rights reserved&quot;) media
            may be uploaded. License selection is required at the point of
            publication. The default is CC BY-SA 4.0. The license is irrevocable
            per CC legal code.
          </p>
        </section>

        {/* 6. AI-Generated Content */}
        <section id="ai-content">
          <h2>6. AI-Generated Content Policy</h2>
          <p>
            <strong>Prohibited:</strong> Content that is wholly AI-generated
            (text, images, audio, video) may not be published on the platform.
            This includes content from generative AI models presented as if it
            were human-created.
          </p>
          <p>
            <strong>Permitted with disclosure:</strong> AI-assisted tools used
            as part of a human-directed creative process (e.g., grammar
            checking, translation assistance, code completion, accessibility
            descriptions) are permitted provided the user discloses AI
            assistance at the point of publication.
          </p>
          <p>
            <strong>Rationale:</strong> The CC licensing model depends on human
            authorship. Copyright law in most jurisdictions does not protect
            purely AI-generated works, which would undermine the CC license
            grant.
          </p>
        </section>

        {/* 7. Acceptable Use */}
        <section id="acceptable-use">
          <h2>7. Acceptable Use</h2>
          <Placeholder label="Acceptable use: prohibited conduct, spam, harassment, illegal content" />
        </section>

        {/* 8. Law Enforcement */}
        <section id="law-enforcement">
          <h2>8. Law Enforcement and Data Mining</h2>
          <p>
            Pana MIA Club does not consent to law enforcement or government
            agencies mining, scraping, bulk-collecting, or conducting
            surveillance of user data on the platform without valid legal
            process (warrant, subpoena, or court order). Automated bulk access
            to user data by any party — law enforcement, commercial, or
            otherwise — is prohibited. Law enforcement requests must be directed
            to the designated contact and accompanied by valid legal process.
          </p>
        </section>

        {/* 9. Intellectual Property */}
        <section id="intellectual-property">
          <h2>9. Intellectual Property</h2>
          <Placeholder label="Intellectual property: user retains ownership; platform license limited to operating the service; CC license governs downstream use" />
        </section>

        {/* 10. Data Tiers */}
        <section id="data-tiers">
          <h2>10. Data Tiers</h2>
          <p>
            All personal and user-generated data is classified into one of three
            tiers. See our <Link href="/legal/privacy">Privacy Policy</Link> for
            full details.
          </p>
          <ul>
            <li>
              <strong>Persistent Data</strong> — Stored for the lifetime of your
              account or longer.
            </li>
            <li>
              <strong>Temporary Data</strong> — Retained only as long as
              necessary, then automatically purged.
            </li>
            <li>
              <strong>Peer Networking Data</strong> — Exchanged directly between
              participants; Pana MIA Club facilitates but does not control after
              transmission.
            </li>
          </ul>
        </section>

        {/* 11. Limitation of Liability */}
        <section id="liability">
          <h2>11. Limitation of Liability</h2>
          <Placeholder label="Limitation of liability: standard disclaimers" />
        </section>

        {/* 12. Dispute Resolution */}
        <section id="dispute-resolution">
          <h2>12. Dispute Resolution</h2>
          <p>
            These terms are governed by the laws of the State of Florida.
            Exclusive venue: state and federal courts located in Broward County,
            Florida. There is no mandatory arbitration and no class-action
            waiver.
          </p>
        </section>

        {/* 13. Electronic Recording Consent */}
        <section id="recording-consent">
          <h2>13. Electronic Recording Consent</h2>
          <p>
            Florida is an all-party consent state (Fla. Stat. &sect; 934.03).
            Recording any electronic communication (video calls, audio, screen
            capture) or in-person conversation without the knowledge and
            explicit consent of all parties is prohibited and may constitute a
            criminal offense. This applies to mentoring sessions, event
            livestreams, and any other Pana MIA Club interactions. See
            module-specific terms for consent mechanisms.
          </p>
        </section>

        {/* 14. Modifications */}
        <section id="modifications">
          <h2>14. Modifications</h2>
          <Placeholder label="Modifications: versioned, with changelog and advance notice" />
        </section>

        {/* 15. Termination */}
        <section id="termination">
          <h2>15. Termination</h2>
          <Placeholder label="Termination: user-initiated deletion, platform-initiated suspension, data retention post-termination" />
        </section>

        {/* Service Modules — expanded inline */}
        <section id="modules" className="mt-12 border-t pt-8">
          <h2>Service Modules</h2>
          <p>
            Additional terms apply to specific features. Each module is
            independently versioned.
          </p>
        </section>

        {moduleDefinitions.map((mod, i) => (
          <section key={mod.id} id={`module-${mod.id}`} className="mt-8">
            <h3>
              Module {i + 1}: {mod.title}
            </h3>
            <ModuleContent module={mod} />
          </section>
        ))}

        {/* Contact */}
        <section id="contact" className="mt-12 border-t pt-8">
          <h2>Contact</h2>
          <p>
            Pana MIA Club, Corp. (d/b/a Pana MIA)
            <br />
            Email: <a href="mailto:hola@panamia.club">hola@panamia.club</a>
          </p>
        </section>
      </article>
    </>
  );
}
