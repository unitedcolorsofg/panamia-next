import type { Metadata } from 'next';
import Link from 'next/link';
import { PrivacyAtAGlance } from '@/components/legal/PrivacyAtAGlance';
import { LegalJsonLd } from '@/components/legal/JsonLd';
import {
  tiers,
  policyVersion,
  policyStatus,
  policyEffectiveDate,
  providers,
  userRights,
} from '@/lib/legal/privacy-policy';

// Live web origin for this app — not a stale federation value to "correct".
// Never find-and-replace `pana.social`; most occurrences are federated
// identity and repointing those is permanent. See docs/DOMAINS.md.
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

// Machine values in policy.json are snake_case and stable; the wording members
// read lives here. Anything unmapped falls back to a de-underscored form, so a
// vendor or right added to the JSON surfaces readably instead of not at all.
const PHRASE_COPY: Record<string, string> = {
  ip_address: 'IP address',
  payment_method: 'payment method',
  transaction_history: 'transaction history',
  recipient_email: 'recipient email address',
  contact_id: 'contact ID',
  newsletter_membership: 'newsletter membership',
  inquiry_message: 'inquiry message',
  profile_image: 'profile image',
  uploaded_media: 'uploaded media',
  payment_processing: 'Payment processing',
  transactional_email: 'Sending transactional email',
  crm_and_newsletter: 'CRM and newsletter delivery',
  hosting_cdn_storage: 'Hosting, CDN, and file storage',
  oauth_authentication: 'Sign-in with an existing account',
};

function humanize(value: string): string {
  return PHRASE_COPY[value] ?? value.replace(/_/g, ' ');
}

const providerRetentionCopy: Record<string, string> = {
  '7_years_tax_legal': 'Up to 7 years, to meet tax and accounting obligations.',
  stateless_no_stored_contacts:
    'No contact list is stored; delivery logs only.',
  delivery_logs_per_cf_terms: 'Delivery logs only, under Cloudflare terms.',
  subject_to_ghl_terms: 'Subject to GoHighLevel retention terms.',
  cdn_edge_cache_brief_delay:
    'Deleted on request, with a brief delay while CDN caches expire.',
  google_auth_logs_per_google_policy:
    'Sign-in logs retained under Google policy.',
  apple_auth_logs_per_apple_policy: 'Sign-in logs retained under Apple policy.',
};

// Keyed by retention class, so the limits listed under section 6 stay tied to
// the classes policy.json actually declares limits for.
const rightsLimitCopy: Record<string, string> = {
  community_record:
    'Articles past three months and completed events can be anonymized, but not erased. The Creative Commons license you granted is irrevocable, so copies others already hold stay licensed to them.',
  moderation_record:
    'Abuse reports are not deletable and outlive the accounts they concern. You cannot erase a report made about you, and you cannot withdraw a report moderators have already acted on.',
  compliance_record:
    'Consent receipts, deletion logs, and username redirects are kept as proof that we did what you asked, and to stop a released username from silently pointing somewhere new.',
  in_the_wind:
    'Anything already published to Nostr or to a federated server has left our control. We can broadcast a deletion request, and we do, but we cannot force an independent server to honor it.',
};

// Tier / class / category content is derived from app/legal/privacy/policy.json.
// Add or amend categories there, not here.

const retentionClassHeadings: Record<string, string> = {
  deletable: 'Deletable on Request',
  community_record: 'Community Record',
  third_party_synced: 'Third-Party Synced',
  moderation_record: 'Moderation Record',
  compliance_record: 'Compliance Record',
  auto_purged: 'Auto-Purged',
  in_the_wind: 'In the Wind',
  participant_observed: 'Seen by Participants',
};

export default function PrivacyPolicyPage() {
  return (
    <>
      <LegalJsonLd
        name="Pana MIA Club Privacy Policy"
        description="How Pana MIA Club collects, uses, and protects your data. Three-tier data classification, your rights, and third-party sharing."
        url={`${SITE}/legal/privacy`}
        version={policyVersion}
        policyJsonUrl={`${SITE}/legal/privacy/policy.json`}
      />
      <header className="mb-10 border-b pb-6">
        <h1 className="text-4xl font-bold">Privacy Policy</h1>
        <p className="text-muted-foreground mt-2">
          Version {policyVersion}
          {policyEffectiveDate
            ? ` — in effect since ${new Date(
                `${policyEffectiveDate}T00:00:00Z`
              ).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                timeZone: 'UTC',
              })}`
            : ` — ${policyStatus.charAt(0).toUpperCase() + policyStatus.slice(1)}`}
        </p>
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
            always fully deletable. Two things are never deleted on request:
            abuse reports, which have to outlive the accounts they concern, and
            anything already published to a network we do not run.
          </p>
          <p>
            <strong>Nostr and federation:</strong> If you join the Resilience
            Network, your public key and group membership live in our systems
            and are deleted with your account — but posts you published to Nostr
            are signed, permanent, and hosted by relays we have no relationship
            with. We can remove them from our relay. Nobody can remove them from
            Nostr at large. ActivityPub works the same way: we send a Delete,
            and remote servers may honor it or ignore it. Your secret key (nsec)
            is never sent to us and we cannot recover it for you.
          </p>
          <p>
            <strong>Third parties:</strong> We share data with Stripe
            (payments), GoHighLevel (CRM and newsletter), Cloudflare (hosting
            and email), and OAuth providers (Google, Apple). Each provider may
            retain data per their own policies after we request deletion.
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
          <p>
            Data reaches us in three ways, and each one is handled differently.
          </p>

          <h3>What you give us</h3>
          <p>
            Your email address when you create an account, the profile and
            listing details you choose to publish, the content you post, and
            anything you type into a form, an inquiry, or a report. You decide
            what goes here. A field you leave blank is a field we do not hold.
            The listing address you enter is converted into map coordinates so
            your listing can be found by distance — if you work from home, treat
            that address as public information.
          </p>

          <h3>What is produced automatically</h3>
          <p>
            Your IP address and browser user-agent reach our servers on every
            request, as they do on any website, and are kept for up to 90 days
            for security, abuse prevention, and basic traffic measurement.
            Sign-in tokens, session records, and email delivery logs are created
            as a byproduct of running the service and expire on their own.
          </p>

          <h3>What you unlock with a permission</h3>
          <p>
            Two features ask your device for access, and both are optional and
            off until you say yes. <strong>Location:</strong> if you allow it,
            your coordinates are rounded to roughly a one-kilometer grid inside
            your browser before they are ever sent, used only to sort directory
            results by distance, and never written to our database.{' '}
            <strong>Microphone:</strong> used only while you are actively
            recording a voice memo. The resulting audio file is stored like any
            other upload. Declining either permission turns off that one feature
            and affects nothing else.
          </p>

          <h3>What we do not do</h3>
          <ul>
            <li>
              We do not sell your personal information, and we do not share it
              for cross-context behavioral advertising.
            </li>
            <li>
              We carry no advertising SDKs, no third-party trackers, and no
              behavioral analytics product.
            </li>
            <li>
              We do not track your location in the background, and we do not
              access your microphone outside the recorder.
            </li>
            <li>
              We do not build advertising profiles or infer sensitive
              characteristics about you.
            </li>
          </ul>

          <p>
            The complete list of every category we hold — what it is, where it
            came from, why we have it, how long it lasts, and who it is shared
            with — is in <Link href="#at-a-glance">Privacy at a Glance</Link>{' '}
            above and in section 2 below. Both are generated from the same
            machine-readable file this page is built from, so neither can
            quietly fall out of date.
          </p>

          <h3>Why we are permitted to hold it</h3>
          <p>
            Account and profile data is processed to provide the service you
            signed up for. Optional device permissions are processed on your
            consent, which you can withdraw at any time in your browser or
            device settings. Safety records, abuse reports, and security logs
            are processed under a legitimate interest in keeping the community
            safe, which is why they are not deletable on request. Payment and
            tax records are processed to meet a legal obligation.
          </p>
        </section>

        {/* 2. Data Tiers */}
        <section id="data-tiers">
          <h2>2. The Three Data Tiers</h2>
          <p>
            All personal and user-generated data falls into exactly one of three
            tiers. Each tier determines how your data is stored, how long it is
            retained, and what happens when you request deletion.
          </p>

          {tiers.map((tier) => (
            <div key={tier.id} className="mb-8">
              <h3>{tier.label} Data</h3>
              <p>{tier.description}</p>

              {tier.classes.map((cls) => (
                <div key={cls.id} className="mb-4">
                  {/* A single-class tier needs no sub-heading — the class and
                      the tier describe the same thing. */}
                  {tier.classes.length > 1 && (
                    <>
                      <h4>{retentionClassHeadings[cls.id] ?? cls.id}</h4>
                      <p className="text-muted-foreground text-sm">
                        {cls.description}
                      </p>
                    </>
                  )}
                  <ul>
                    {cls.categories.map((cat) => (
                      <li key={cat.name}>{cat.display.prose}</li>
                    ))}
                  </ul>
                </div>
              ))}
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
          <h3>When the threshold falls</h3>
          <ul>
            <li>
              <strong>Articles:</strong> three months after publication.
            </li>
            <li>
              <strong>Events:</strong> once the event has completed.
            </li>
            <li>
              <strong>Article reviews:</strong> they follow the article they
              belong to.
            </li>
          </ul>
          <p>
            <strong>Before the threshold</strong>, this content behaves like
            everything else you own: ask us to remove it and it is removed.
          </p>
          <p>
            <strong>After the threshold</strong>, the content stays but your
            name does not have to. On request we replace the author with{' '}
            <em>Former Member</em> and detach the piece from your account. The
            words remain in the community record; the attribution to you does
            not. We cannot go further than that, because the Creative Commons
            license you granted when you published is irrevocable — anyone who
            already has a copy keeps their rights to it regardless of what we
            do. If you published under CC0 there is no attribution to remove in
            the first place, so we simply stop displaying your name.
          </p>
          <p>
            <strong>Social posts have no archive threshold at all.</strong>{' '}
            Timeline posts, replies, and reposts are fully deleted on request no
            matter how old they are. The threshold applies only to the
            long-form, intentionally archival parts of the site. Note that a
            post already delivered to a federated server is covered by section
            6, not by this one.
          </p>
        </section>

        {/* 4. Who We Share Data With */}
        <section id="sharing">
          <h2>4. Who We Share Data With</h2>
          <p>
            A short list of vendors runs parts of the service for us, and open
            networks receive the content you choose to publish. We do not sell
            data to anyone, and no company on this list is an advertising
            network.
          </p>

          <h3>Vendors that process data for us</h3>
          <table>
            <thead>
              <tr>
                <th>Who</th>
                <th>What for</th>
                <th>What they receive</th>
                <th>What they keep after you delete</th>
              </tr>
            </thead>
            <tbody>
              {providers.map((p) => (
                <tr key={p.name}>
                  <td>{p.name}</td>
                  <td>{humanize(p.purpose)}</td>
                  <td>{p.data.map(humanize).join(', ')}</td>
                  <td>
                    {providerRetentionCopy[p.providerRetention] ??
                      humanize(p.providerRetention)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>
            Each company is bound by its own agreement with us and its own
            privacy policy. When you ask us to delete your data we pass the
            request along, but a provider may keep records under obligations of
            its own — Stripe, for example, has to retain transaction history for
            tax purposes regardless of what either of us would prefer.
          </p>
          <p>
            Card numbers are a special case: payments are entered on
            Stripe&apos;s own checkout, not on our site, and we never receive or
            store your card details.
          </p>

          <h3>Open networks you publish to</h3>
          <p>
            These are not vendors, and this is the part people most often
            misunderstand. When you publish to the fediverse over ActivityPub,
            or to the Resilience Network over Nostr, your content is copied to
            independent servers run by strangers. We can ask them to delete it
            and we do send the request. We cannot make them comply, and we
            cannot tell you who has a copy. Treat anything you publish to these
            networks as permanent and public.
          </p>

          <h3>Legal requests</h3>
          <p>
            We disclose member data to law enforcement only where we are
            compelled by valid legal process, and we disclose the narrowest set
            of data that satisfies the request. If we are permitted to tell you
            that your data was requested, we will.
          </p>
        </section>

        {/* 5. Content Licensing */}
        <section id="content-licensing">
          <h2>5. Your Content Is CC-Licensed</h2>
          <p>
            All content you publish on Pana MIA Club is licensed under Creative
            Commons (CC BY 4.0, CC BY-SA 4.0, or CC0 1.0, your choice). This
            means the grant survives even if the content is later removed from
            the platform. Under CC BY and CC BY-SA you may ask us to remove your
            name from archived content; CC0 requires no attribution in the first
            place, so we simply stop displaying it. See our{' '}
            <Link href="/legal/terms#content-licensing">Terms of Service</Link>{' '}
            for details.
          </p>
        </section>

        {/* 6. Your Choices and Rights */}
        <section id="rights">
          <h2>6. Your Choices and Rights</h2>
          <p>
            These rights apply to every member, wherever you live. We do not run
            a two-tier policy where some people get more control than others
            based on their address.
          </p>

          <h3>What you can do</h3>
          <ul>
            <li>
              <strong>See what we hold.</strong> Your{' '}
              <Link href="/account">account</Link> and profile pages show most
              of it directly. For a complete copy, ask us and we will assemble
              one.
            </li>
            <li>
              <strong>Correct it.</strong> Profile, listing, and contact details
              are editable at any time from your account pages.
            </li>
            <li>
              <strong>Delete it.</strong> You can delete your account from{' '}
              <Link href="/account/user/edit">your account settings</Link>. Data
              in the deletable class goes immediately; the limits below explain
              what cannot follow it.
            </li>
            <li>
              <strong>Take it with you.</strong> We will provide your data in a
              portable, machine-readable format on request. This one is handled
              by a person rather than a button today, so email us and we will
              put it together.
            </li>
            <li>
              <strong>Opt out of sale or sharing.</strong> There is nothing to
              opt out of, because we do not sell or share personal information
              for advertising. We honor the Global Privacy Control signal
              regardless, and you can see its current status on your{' '}
              <Link href="/account/privacy">privacy settings</Link> page.
            </li>
            <li>
              <strong>Not be penalized for asking.</strong> Exercising any of
              these rights will never degrade your account or your standing in
              the community.
            </li>
          </ul>

          <h3>Where those rights stop</h3>
          <p>
            We would rather state these plainly than let you discover them after
            you have asked.
          </p>
          <ul>
            {userRights.limits.map((limit) => (
              <li key={limit.class}>
                {rightsLimitCopy[limit.class] ?? humanize(limit.limit)}
              </li>
            ))}
          </ul>

          <h3>How to make a request</h3>
          <p>
            Email <a href="mailto:hola@pana.social">hola@pana.social</a> from
            the address on your account, or contact us from the account itself.
            We respond within 30 days. If we need longer for a complicated
            request, we will tell you before that deadline rather than after it.
            If you are not satisfied with how we handled a request, you may
            complain to your local data protection authority.
          </p>
        </section>

        {/* 7. How We Protect Your Data */}
        <section id="security">
          <h2>7. How We Protect Your Data</h2>
          <p>
            No service can promise perfect security, and we are not going to
            pretend otherwise. What we can do is tell you exactly what we
            practice.
          </p>
          <ul>
            <li>
              <strong>There is no password to steal.</strong> Signing in uses a
              one-time link sent to your email, or your existing Google or Apple
              account. We never create or store a password for your account,
              which removes the single most common cause of account takeover and
              means a breach of our database would expose no credentials to
              reuse elsewhere.
            </li>
            <li>
              <strong>Encrypted in transit.</strong> The entire site is served
              over HTTPS, including the API the mobile apps talk to.
            </li>
            <li>
              <strong>Encrypted at rest.</strong> The database and uploaded
              files are held by infrastructure providers that encrypt stored
              data.
            </li>
            <li>
              <strong>Credentials are not in the source code.</strong> API keys
              and signing secrets live in encrypted platform secret storage,
              separate from the application, and are not committed to our code
              repository.
            </li>
            <li>
              <strong>Administrative access is limited by role.</strong> Staff
              and moderator permissions are granted explicitly, and moderation
              actions leave an audit record.
            </li>
            <li>
              <strong>Your Nostr secret key never reaches us.</strong> If you
              use the Resilience Network, your nsec stays on your device. We
              cannot read it, we cannot leak it, and we cannot recover it for
              you if you lose it.
            </li>
          </ul>
          <p>
            If a breach ever does affect your data, our{' '}
            <Link href="/legal/breach">Data Breach Disclosure Policy</Link> sets
            out how and when we will tell you.
          </p>
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
          <p>
            Pana MIA Club is operated from the United States by Pana MIA Club,
            Corp. Our infrastructure is global — Cloudflare serves the site from
            edge locations worldwide, so pages load from somewhere near you —
            while our database and stored files are hosted primarily in the
            United States. If you use the service from outside the US, your data
            is transferred to and processed in the US.
          </p>
          <p>
            We do not offer different privacy rights to different regions. The
            rights in section 6 are extended to every member regardless of where
            they live, because a policy that grants control only where a
            regulator demands it is not really a privacy policy. A maker in
            Miami and a visitor from Madrid get the same controls.
          </p>
          <p>
            If you are in the European Economic Area, the United Kingdom, or
            Switzerland, you keep your right to lodge a complaint with your
            local supervisory authority, and you may contact us for details
            about how a specific transfer is handled.
          </p>
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
          <p>
            This policy carries a version number and an effective date, both
            shown at the top of this page. The machine-readable source it is
            generated from is published at{' '}
            <a href="/legal/privacy/policy.json">policy.json</a>, so any change
            to what we collect is visible as a concrete difference rather than a
            reworded paragraph.
          </p>
          <p>
            <strong>Minor changes</strong> — clearer wording, a corrected typo,
            a newly documented detail that does not change what we collect — are
            published with an incremented version number.
          </p>
          <p>
            <strong>Material changes</strong> — a new category of data, a new
            purpose for existing data, a new third party, or anything that
            narrows your rights — are announced by email and by in-app notice at
            least 30 days before they take effect. That window exists so you
            have real time to export your data and close your account if you
            disagree, rather than discovering the change after it applies.
          </p>
          <p>
            We record a consent receipt noting which version of this policy you
            accepted and when. We will not apply a material change retroactively
            to data already collected under an earlier version without asking
            you first.
          </p>
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
