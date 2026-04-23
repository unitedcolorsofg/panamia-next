import type { Metadata } from 'next';
import Link from 'next/link';
import { PrivacyAtAGlance } from '@/components/legal/PrivacyAtAGlance';
import { LegalJsonLd } from '@/components/legal/JsonLd';

const SITE = 'https://pana.social';

export const metadata: Metadata = {
  title: 'Privacy Policy - Pana MIA Club',
  description:
    'How Pana MIA Club collects, uses, and protects your data. Three-tier data classification, your rights, and third-party sharing.',
  openGraph: {
    title: 'Privacy Policy - Pana MIA Club',
    description:
      'How Pana MIA Club collects, uses, and protects your data. Three-tier data classification, your rights, and third-party sharing.',
    url: `${SITE}/legal/privacy`,
    siteName: 'Pana MIA Club',
    type: 'website',
  },
};

function Placeholder({ label }: { label: string }) {
  return (
    <p className="rounded border border-dashed border-blue-400/50 bg-blue-50/50 p-4 text-sm text-blue-800 dark:bg-blue-950/20 dark:text-blue-200">
      {label} — full legal text to be drafted.
    </p>
  );
}

const dataTiers = [
  {
    tier: 'Persistent',
    description: 'Stored for the lifetime of your account or longer.',
    classes: [
      {
        name: 'Deletable on Request',
        description: 'Deleted immediately upon confirmed request.',
        categories: [
          'Account credentials and authentication tokens',
          'Profile information (contact, address, descriptions, images, social links)',
          'Mentoring profile (expertise, languages, bio, hourly rate)',
          'Notification preferences',
          'Intake form submissions',
          'Session notes and mentoring session metadata',
          'Social graph (follows, followers, likes)',
          'RSVPs and event attendance records',
        ],
      },
      {
        name: 'Community Record',
        description:
          'Anonymizable but not deletable after archive threshold. Content is CC-licensed (irrevocable).',
        categories: [
          'Published articles (archive: 3 months after publication)',
          'Social timeline posts (no archive threshold — always fully deleted)',
          'Event records (archive: after event completion)',
          'Event photos (archive: 3 months after event)',
          'Article peer review comments (archive: follows article)',
        ],
      },
      {
        name: 'Third-Party Synced',
        description:
          'Deletion initiated but subject to provider retention policies.',
        categories: [
          'Stripe — email, payment method, transaction history (7-year legal hold)',
          'Brevo — email, name, list membership',
          'GoHighLevel — contact ID, email, name',
          'Google OAuth — email, name, profile image (received, not sent)',
          'Apple OAuth — email, name (received, not sent)',
          'Cloudflare R2 — uploaded media files',
          'ActivityPub peers — federated posts, actor profiles, follows',
        ],
      },
    ],
  },
  {
    tier: 'Temporary',
    description:
      'Retained only as long as necessary to provide a specific service, then automatically purged.',
    categories: [
      'Mentoring session signaling and WebRTC connection metadata',
      'Whiteboard state (purged 30 min after session ends)',
      'Real-time chat messages during mentoring sessions',
      'Session video/audio streams (never recorded server-side unless explicitly enabled)',
      'OAuth tokens and transient authentication state',
      'IP addresses and user-agent strings (90-day analytics window)',
      'Email verification and magic-link tokens (expire per config)',
      'Event livestream SRT ingestion keys (valid only during stream)',
    ],
  },
  {
    tier: 'Peer Networking',
    description:
      'Exchanged directly between participants. Pana MIA Club facilitates but does not control after transmission.',
    categories: [
      'Video and audio streams during mentoring sessions (WebRTC peer-to-peer)',
      'Whiteboard content visible to session participants',
      'Chat messages seen by the other participant before deletion',
      'Co-author content shared during article collaboration',
      'Profile information visible to other users',
      'Event RSVP and attendance information visible to organizers/attendees',
      'Social posts, replies, likes, and follows federated via ActivityPub',
      'Information shared at in-person events (verbal, written, photos)',
    ],
  },
];

export default function PrivacyPolicyPage() {
  return (
    <>
      <LegalJsonLd
        name="Pana MIA Club Privacy Policy"
        description="How Pana MIA Club collects, uses, and protects your data. Three-tier data classification, your rights, and third-party sharing."
        url={`${SITE}/legal/privacy`}
        version="0.1"
        policyJsonUrl={`${SITE}/legal/privacy/policy.json`}
      />
      <header className="mb-10 border-b pb-6">
        <h1 className="text-4xl font-bold">Privacy Policy</h1>
        <p className="text-muted-foreground mt-2">Version 0.1 — Draft</p>
        <p className="text-muted-foreground mt-1 text-sm">
          The English-language version of this policy shall take precedence over
          any translations.
        </p>
      </header>

      {/* Privacy at a Glance — scannable grid (Layer 1) */}
      <section id="at-a-glance" className="mb-12">
        <h2 className="mb-4 text-2xl font-bold">Privacy at a Glance</h2>
        <p className="text-muted-foreground mb-6 text-sm">
          Every piece of data we handle falls into one of three tiers. Filter by
          tier to see what we collect, why, how long we keep it, and who it is
          shared with.
        </p>
        <PrivacyAtAGlance />
      </section>

      {/* Plain-language summary (Layer 2) */}
      <section id="summary" className="mb-12">
        <h2 className="mb-4 text-2xl font-bold">Plain-Language Summary</h2>
        <div className="bg-muted/30 space-y-4 rounded-lg border p-6 text-sm">
          <p>
            <strong>What we collect:</strong> Account info you provide (email,
            name, profile details), content you create (articles, posts,
            photos), and minimal automatic data (IP address, browser info) for
            90 days.
          </p>
          <p>
            <strong>Three data tiers:</strong> Your data is either{' '}
            <em>Persistent</em> (stored while your account is active),{' '}
            <em>Temporary</em> (auto-deleted after use), or{' '}
            <em>Peer Networking</em> (exchanged directly between users, outside
            our control after transmission).
          </p>
          <p>
            <strong>Deletion:</strong> Most of your data is deleted immediately
            on request. Content that becomes community record (articles after 3
            months, completed events) can be anonymized but not fully removed,
            because the CC license you chose is irrevocable. Social posts are
            always fully deletable.
          </p>
          <p>
            <strong>Third parties:</strong> We share data with Stripe
            (payments), Brevo (email), GoHighLevel (CRM), Cloudflare (hosting),
            and OAuth providers (Google, Apple). Each provider may retain data
            per their own policies after we request deletion.
          </p>
          <p>
            <strong>Your rights:</strong> You can access, correct, delete, or
            export your data. We honor Global Privacy Control (GPC) signals. No
            data is sold.
          </p>
          <p>
            <strong>No minors:</strong> You must be 18 or older. Accounts
            belonging to minors are terminated and data deleted.
          </p>
        </div>
      </section>

      <article className="prose prose-gray dark:prose-invert max-w-none leading-relaxed">
        {/* 1. What We Collect and Why */}
        <section id="what-we-collect">
          <h2>1. What We Collect and Why</h2>
          <Placeholder label="What we collect and why — detailed per-category disclosure per GDPR Art 13/14, CPRA, ISO 29184" />
        </section>

        {/* 2. Data Tiers */}
        <section id="data-tiers">
          <h2>2. The Three Data Tiers</h2>
          <p>
            All personal and user-generated data falls into exactly one of three
            tiers. Each tier determines how your data is stored, how long it is
            retained, and what happens when you request deletion.
          </p>

          {dataTiers.map((tier) => (
            <div key={tier.tier} className="mb-8">
              <h3>{tier.tier} Data</h3>
              <p>{tier.description}</p>

              {'classes' in tier && tier.classes ? (
                tier.classes.map((cls) => (
                  <div key={cls.name} className="mb-4">
                    <h4>{cls.name}</h4>
                    <p className="text-muted-foreground text-sm">
                      {cls.description}
                    </p>
                    <ul>
                      {cls.categories.map((cat) => (
                        <li key={cat}>{cat}</li>
                      ))}
                    </ul>
                  </div>
                ))
              ) : (
                <ul>
                  {tier.categories?.map((cat) => (
                    <li key={cat}>{cat}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </section>

        {/* 3. Archive Threshold */}
        <section id="archive-threshold">
          <h2>3. The Archive Threshold</h2>
          <p>
            Certain content becomes part of the community record after a defined
            period. All user-generated content is CC BY or CC BY-SA licensed.
            The CC license is irrevocable — once granted, downstream recipients
            retain their rights regardless of whether the licensor stops
            distributing.
          </p>
          <Placeholder label="Archive threshold details — when content becomes permanent, deletion vs anonymization options" />
        </section>

        {/* 4. Who We Share Data With */}
        <section id="sharing">
          <h2>4. Who We Share Data With</h2>
          <Placeholder label="Third-party sharing details — Stripe, Brevo, GoHighLevel, Cloudflare, OAuth providers, ActivityPub federation peers" />
        </section>

        {/* 5. Content Licensing */}
        <section id="content-licensing">
          <h2>5. Your Content Is CC-Licensed</h2>
          <p>
            All content you publish on Pana MIA Club is licensed under Creative
            Commons (CC BY 4.0 or CC BY-SA 4.0, your choice). This means the
            license grant survives even if the content is later removed from the
            platform. See our{' '}
            <Link href="/legal/terms#content-licensing">Terms of Service</Link>{' '}
            for details.
          </p>
        </section>

        {/* 6. Your Choices and Rights */}
        <section id="rights">
          <h2>6. Your Choices and Rights</h2>
          <Placeholder label="User rights — access, delete, correct, port, opt out, anonymize (GDPR + CPRA + ISO 29184)" />
        </section>

        {/* 7. How We Protect Your Data */}
        <section id="security">
          <h2>7. How We Protect Your Data</h2>
          <Placeholder label="Security measures — encryption at rest/transit, password hashing, WAF, environment variable segregation" />
        </section>

        {/* 8. Global Privacy Control */}
        <section id="gpc">
          <h2>8. Global Privacy Control (GPC)</h2>
          <p>
            We honor the Global Privacy Control signal. When your browser sends
            <code>Sec-GPC: 1</code>, we treat it as a valid CPRA opt-out of
            sale/sharing and disable any non-essential analytics sharing.
          </p>
        </section>

        {/* 9. Children */}
        <section id="children">
          <h2>9. Children&apos;s Privacy</h2>
          <p>
            Pana MIA Club is not directed at children under 18. We do not
            knowingly collect personal information from minors. If we discover
            that a user is under 18, their account will be terminated and their
            data deleted.
          </p>
        </section>

        {/* 10. International Users */}
        <section id="international">
          <h2>10. International Users</h2>
          <Placeholder label="International users — jurisdiction-neutral framing per ISO 29184" />
        </section>

        {/* 11. Contact */}
        <section id="contact">
          <h2>11. How to Contact Us</h2>
          <p>
            For privacy inquiries, data access requests, or to report a
            suspected data breach:
          </p>
          <p>
            Pana MIA Club, Corp.
            <br />
            Email: <a href="mailto:hola@pana.social">hola@pana.social</a>
          </p>
        </section>

        {/* 12. Changes */}
        <section id="changes">
          <h2>12. How We Notify You of Changes</h2>
          <Placeholder label="Change notification — versioned updates, email + in-app notice, advance notice period" />
        </section>

        {/* Related Pages */}
        <section className="mt-12 border-t pt-8">
          <h2>Related</h2>
          <ul>
            <li>
              <Link href="/legal/terms">Terms of Service</Link>
            </li>
            <li>
              <Link href="/legal/dmca">DMCA Policy</Link>
            </li>
            <li>
              <Link href="/legal/breach">Data Breach Disclosure Policy</Link>
            </li>
          </ul>
        </section>
      </article>
    </>
  );
}
