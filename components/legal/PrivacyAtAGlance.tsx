'use client';

import { useState } from 'react';
import {
  User,
  FileText,
  MessageCircle,
  Video,
  Calendar,
  Upload,
  CreditCard,
  Eye,
  Shield,
  Globe,
  Share2,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

type Tier = 'persistent' | 'temporary' | 'peer';
type RetentionClass =
  | 'deletable'
  | 'community-record'
  | 'third-party'
  | 'auto-purged'
  | 'uncontrolled';

interface GlanceCategory {
  id: string;
  label: string;
  icon: LucideIcon;
  source: string;
  tier: Tier;
  retentionClass: RetentionClass;
  purpose: string;
  retention: string;
  sharedWith: string;
}

const tierLabels: Record<Tier, string> = {
  persistent: 'Persistent',
  temporary: 'Temporary',
  peer: 'Peer',
};

const tierColors: Record<Tier, string> = {
  persistent: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200',
  temporary:
    'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
  peer: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-200',
};

const retentionClassLabels: Record<RetentionClass, string> = {
  deletable: 'Deletable',
  'community-record': 'Community Record',
  'third-party': '3rd-Party Synced',
  'auto-purged': 'Auto-Purged',
  uncontrolled: 'Uncontrolled',
};

const retentionClassColors: Record<RetentionClass, string> = {
  deletable:
    'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200',
  'community-record':
    'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200',
  'third-party': 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200',
  'auto-purged':
    'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
  uncontrolled:
    'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-200',
};

const categories: GlanceCategory[] = [
  {
    id: 'account',
    label: 'Account',
    icon: User,
    source: 'You provide',
    tier: 'persistent',
    retentionClass: 'deletable',
    purpose: 'Authentication and identity',
    retention: 'Account lifetime',
    sharedWith: 'OAuth providers',
  },
  {
    id: 'profile',
    label: 'Profile',
    icon: User,
    source: 'You provide',
    tier: 'persistent',
    retentionClass: 'deletable',
    purpose: 'Directory listing and community',
    retention: 'Account lifetime',
    sharedWith: 'Public / ActivityPub',
  },
  {
    id: 'mentoring-profile',
    label: 'Mentoring Profile',
    icon: Users,
    source: 'You provide',
    tier: 'persistent',
    retentionClass: 'deletable',
    purpose: 'Mentor directory',
    retention: 'Account lifetime',
    sharedWith: 'Public',
  },
  {
    id: 'mentoring-session',
    label: 'Mentoring Session',
    icon: Video,
    source: 'Session activity',
    tier: 'temporary',
    retentionClass: 'auto-purged',
    purpose: 'Real-time collaboration',
    retention: 'Session + 30 min',
    sharedWith: 'Session participants',
  },
  {
    id: 'session-notes',
    label: 'Session Notes',
    icon: FileText,
    source: 'You provide',
    tier: 'persistent',
    retentionClass: 'deletable',
    purpose: 'Mentoring records',
    retention: 'Account lifetime',
    sharedWith: 'None',
  },
  {
    id: 'articles',
    label: 'Articles',
    icon: FileText,
    source: 'You provide',
    tier: 'persistent',
    retentionClass: 'community-record',
    purpose: 'Community knowledge',
    retention: 'Archive: 3 months',
    sharedWith: 'Public / ActivityPub',
  },
  {
    id: 'article-reviews',
    label: 'Article Reviews',
    icon: MessageCircle,
    source: 'You provide',
    tier: 'persistent',
    retentionClass: 'community-record',
    purpose: 'Editorial quality',
    retention: 'Follows article',
    sharedWith: 'Public',
  },
  {
    id: 'social-posts',
    label: 'Social Posts',
    icon: MessageCircle,
    source: 'You provide',
    tier: 'persistent',
    retentionClass: 'deletable',
    purpose: 'Social expression',
    retention: 'Always deletable',
    sharedWith: 'Public / ActivityPub',
  },
  {
    id: 'social-graph',
    label: 'Social Graph',
    icon: Share2,
    source: 'Your actions',
    tier: 'persistent',
    retentionClass: 'deletable',
    purpose: 'Social features',
    retention: 'Account lifetime',
    sharedWith: 'ActivityPub peers',
  },
  {
    id: 'events',
    label: 'Events',
    icon: Calendar,
    source: 'You provide',
    tier: 'persistent',
    retentionClass: 'community-record',
    purpose: 'Community events',
    retention: 'Archive: after event',
    sharedWith: 'Public',
  },
  {
    id: 'event-photos',
    label: 'Event Photos',
    icon: Upload,
    source: 'You provide',
    tier: 'persistent',
    retentionClass: 'community-record',
    purpose: 'Event documentation',
    retention: 'Archive: 3 months post-event',
    sharedWith: 'Public',
  },
  {
    id: 'rsvps',
    label: 'RSVPs',
    icon: Calendar,
    source: 'Your actions',
    tier: 'persistent',
    retentionClass: 'deletable',
    purpose: 'Event management',
    retention: 'Account lifetime',
    sharedWith: 'Organizers / attendees',
  },
  {
    id: 'payments',
    label: 'Payments',
    icon: CreditCard,
    source: 'You provide',
    tier: 'persistent',
    retentionClass: 'third-party',
    purpose: 'Donations, memberships, merchandise',
    retention: 'Stripe: 7-year hold',
    sharedWith: 'Stripe / GoHighLevel',
  },
  {
    id: 'uploads',
    label: 'Uploads',
    icon: Upload,
    source: 'You provide',
    tier: 'persistent',
    retentionClass: 'community-record',
    purpose: 'Media hosting',
    retention: 'Follows content',
    sharedWith: 'Cloudflare R2 / Public',
  },
  {
    id: 'analytics',
    label: 'Analytics',
    icon: Eye,
    source: 'Automatic',
    tier: 'temporary',
    retentionClass: 'auto-purged',
    purpose: 'Site analytics',
    retention: '90 days',
    sharedWith: 'Cloudflare',
  },
  {
    id: 'oauth',
    label: 'OAuth',
    icon: Shield,
    source: 'OAuth provider',
    tier: 'temporary',
    retentionClass: 'third-party',
    purpose: 'Authentication',
    retention: 'Token lifetime',
    sharedWith: 'Google / Apple',
  },
  {
    id: 'email-contacts',
    label: 'Email / Contacts',
    icon: Globe,
    source: 'You provide',
    tier: 'persistent',
    retentionClass: 'third-party',
    purpose: 'Email communications',
    retention: 'Account lifetime',
    sharedWith: 'Brevo',
  },
  {
    id: 'crm',
    label: 'CRM',
    icon: Globe,
    source: 'You provide',
    tier: 'persistent',
    retentionClass: 'third-party',
    purpose: 'Contact management',
    retention: 'Account lifetime',
    sharedWith: 'GoHighLevel',
  },
];

type FilterTier = 'all' | Tier;

export function PrivacyAtAGlance() {
  const [filter, setFilter] = useState<FilterTier>('all');

  const filtered =
    filter === 'all' ? categories : categories.filter((c) => c.tier === filter);

  return (
    <div className="not-prose">
      {/* Filter buttons */}
      <div className="mb-4 flex flex-wrap gap-2">
        {(['all', 'persistent', 'temporary', 'peer'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={`rounded-full border px-3 py-1 text-sm transition-colors ${
              filter === t ? 'bg-foreground text-background' : 'hover:bg-muted'
            }`}
          >
            {t === 'all' ? 'All' : tierLabels[t]}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((cat) => {
          const Icon = cat.icon;
          return (
            <div
              key={cat.id}
              className="hover:bg-muted/30 rounded-lg border p-4 transition-colors"
            >
              <div className="mb-2 flex items-center gap-2">
                <Icon className="text-muted-foreground h-4 w-4 shrink-0" />
                <span className="font-medium">{cat.label}</span>
              </div>
              <div className="mb-2 flex flex-wrap gap-1">
                <Badge
                  className={`${tierColors[cat.tier]} border-0 text-[10px]`}
                >
                  {tierLabels[cat.tier]}
                </Badge>
                <Badge
                  className={`${retentionClassColors[cat.retentionClass]} border-0 text-[10px]`}
                >
                  {retentionClassLabels[cat.retentionClass]}
                </Badge>
              </div>
              <dl className="text-muted-foreground grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-xs">
                <dt>Source:</dt>
                <dd>{cat.source}</dd>
                <dt>Purpose:</dt>
                <dd>{cat.purpose}</dd>
                <dt>Retention:</dt>
                <dd>{cat.retention}</dd>
                <dt>Shared with:</dt>
                <dd>{cat.sharedWith}</dd>
              </dl>
            </div>
          );
        })}
      </div>
    </div>
  );
}
