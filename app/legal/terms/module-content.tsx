function Placeholder({ label }: { label: string }) {
  return (
    <p className="rounded border border-dashed border-yellow-500/50 bg-yellow-50/50 p-4 text-sm text-yellow-800 dark:bg-yellow-950/20 dark:text-yellow-200">
      {label} — full legal text to be drafted.
    </p>
  );
}

export interface ModuleDefinition {
  id: string;
  title: string;
  items: string[];
  placeholder: string;
}

export const moduleDefinitions: ModuleDefinition[] = [
  {
    id: 'profiles',
    title: 'Profiles',
    items: [
      'Directory listing and public visibility',
      'Social gating (eligibility requirements)',
      'Profile verification process',
      'Linked profiles',
      'Membership levels',
      'Image upload requirements and CC licensing',
    ],
    placeholder: 'Profiles module terms',
  },
  {
    id: 'articles',
    title: 'Articles',
    items: [
      'Publishing workflow (draft, review, published)',
      'Co-authoring: invitation, acceptance, shared editing',
      'Peer review process and reviewer conduct',
      'CC license selection (per article)',
      'Removal policy',
      'ActivityPub federation of articles',
      'Reply threading',
    ],
    placeholder: 'Articles module terms',
  },
  {
    id: 'social',
    title: 'Social',
    items: [
      'ActivityPub federation: content may leave Pana MIA Club servers',
      'Peer Networking Data: federated content subject to remote server policies',
      'Social eligibility gating',
      'Follow requests and approval',
      'Content warnings and visibility controls',
      'Hashtags, mentions, and discoverability',
      'Interaction with external Mastodon users',
      'CC license on all posts',
    ],
    placeholder: 'Social module terms',
  },
  {
    id: 'mentoring',
    title: 'Mentoring',
    items: [
      'Session booking and scheduling',
      'Conduct expectations (mentor and mentee)',
      'Video/audio: WebRTC peer-to-peer (Peer Networking Data)',
      'Whiteboard: collaborative Temporary Data (purged after session)',
      'Chat: Temporary Data',
      'Session notes: Persistent Data',
      'No server-side recording unless explicitly enabled with consent',
      'All-party consent for recordings (Fla. Stat. \u00a7 934.03)',
      'Cancellation and no-show policy',
      'Free vs paid sessions and rate expectations',
    ],
    placeholder: 'Mentoring module terms',
  },
  {
    id: 'events',
    title: 'Events',
    items: [
      'Event creation and organizer responsibilities',
      'Venue submission and approval',
      'RSVP and attendee data visibility',
      'Photo uploads and approval workflow (CC-licensed)',
      'Livestreaming: Cloudflare Stream, SRT keys as Temporary Data',
      'All-party consent for recordings (Fla. Stat. \u00a7 934.03)',
      'Age restrictions and photo policies',
      'Cancellation policy',
      'Organizer and volunteer roles',
    ],
    placeholder: 'Events module terms',
  },
  {
    id: 'uploads',
    title: 'Uploads',
    items: [
      'Supported formats (JPEG, PNG, WebP, GIF)',
      'CC license required on all uploads',
      'Cloudflare R2 storage',
      'Content moderation and removal',
      'DMCA takedown process',
      'NCMEC/CyberTipline reporting obligation',
      'Prohibited content (CSAM, copyright infringement, etc.)',
    ],
    placeholder: 'Uploads module terms',
  },
  {
    id: 'payments',
    title: 'Payments',
    items: [
      'Stripe as sole payment processor',
      'Donation tiers and membership levels',
      'Recurring subscription management',
      'Refund policy',
      'No e-commerce / no product sales (donations only)',
      'Tax receipts and record retention (7 years)',
    ],
    placeholder: 'Payments module terms',
  },
  {
    id: 'community',
    title: 'Community',
    items: [
      'Code of conduct',
      'Behavioral expectations',
      'Enforcement process (warning, suspension, termination)',
      'Appeals mechanism',
      'Repeat infringer policy (DMCA)',
      'Admin moderation powers and transparency',
    ],
    placeholder: 'Community module terms',
  },
];

export function ModuleContent({ module }: { module: ModuleDefinition }) {
  return (
    <>
      <p>This module covers:</p>
      <ul>
        {module.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <Placeholder label={module.placeholder} />
    </>
  );
}
