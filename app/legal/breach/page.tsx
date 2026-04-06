import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Data Breach Disclosure Policy - Pana MIA Club',
  description:
    'Data breach notification and incident response policy for Pana MIA Club',
};

function Placeholder({ label }: { label: string }) {
  return (
    <p className="rounded border border-dashed border-yellow-500/50 bg-yellow-50/50 p-4 text-sm text-yellow-800 dark:bg-yellow-950/20 dark:text-yellow-200">
      {label} — full legal text to be drafted.
    </p>
  );
}

export default function BreachPolicyPage() {
  return (
    <>
      <header className="mb-8 border-b pb-6">
        <h1 className="text-4xl font-bold">Data Breach Disclosure Policy</h1>
        <p className="text-muted-foreground mt-2">
          Incident response and notification under the Florida Information
          Protection Act (FIPA)
        </p>
      </header>

      <article className="prose prose-gray dark:prose-invert max-w-none leading-relaxed">
        <section id="commitment">
          <h2>Our Commitment</h2>
          <p>
            Pana MIA Club maintains a breach response plan and is committed to
            notifying affected users per Florida law (Fla. Stat. &sect;
            501.171). We will provide timely, transparent disclosure in the
            event of a data breach affecting personal information.
          </p>
        </section>

        <section id="what-constitutes-a-breach">
          <h2>What Constitutes a Breach</h2>
          <Placeholder label="Breach definition per FIPA § 501.171(1)(g) — unauthorized access of personal information, encryption safe harbor" />
        </section>

        <section id="notification">
          <h2>Notification Requirements</h2>
          <Placeholder label="FIPA notification timeline (30 days), AG notice (500+ residents), consumer reporting agencies (1,000+), notice content requirements" />
        </section>

        <section id="incident-response">
          <h2>Incident Response Plan</h2>
          <Placeholder label="Internal incident response: detection, assessment (24h), containment, legal review, notification, remediation, transparency" />
        </section>

        <section id="security-measures">
          <h2>Reasonable Security Measures</h2>
          <p>
            Per FIPA &sect; 501.171(2), we maintain reasonable measures to
            protect personal information, including:
          </p>
          <ul>
            <li>
              Encryption at rest (Supabase/PostgreSQL) and in transit (TLS)
            </li>
            <li>Password hashing via better-auth (bcrypt/scrypt)</li>
            <li>OAuth tokens stored server-side, never exposed to client</li>
            <li>Cloudflare WAF and DDoS protection</li>
            <li>
              Environment variable segregation (secrets never in client bundles)
            </li>
            <li>R2 bucket access controls</li>
            <li>Regular dependency audits (Dependabot)</li>
          </ul>
        </section>

        <section id="reporting" className="mt-12 border-t pt-8">
          <h2>Report a Suspected Breach</h2>
          <p>
            If you believe you have discovered a security vulnerability or data
            breach, please contact us immediately:
          </p>
          <p>
            <a href="mailto:hola@panamia.club">hola@panamia.club</a>
          </p>
        </section>
      </article>
    </>
  );
}
