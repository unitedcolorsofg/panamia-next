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
  Key,
  Flag,
  Radio,
  Database,
  type LucideIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  allCategories,
  type Tier,
  type RetentionClass,
} from '@/lib/legal/privacy-policy';

// Cards are derived from app/legal/privacy/policy.json — add a category there,
// not here. Only presentation (icon glyph, badge colors) lives in this file.

const icons: Record<string, LucideIcon> = {
  user: User,
  users: Users,
  'file-text': FileText,
  'message-circle': MessageCircle,
  video: Video,
  calendar: Calendar,
  upload: Upload,
  'credit-card': CreditCard,
  eye: Eye,
  shield: Shield,
  globe: Globe,
  'share-2': Share2,
  key: Key,
  flag: Flag,
  radio: Radio,
};

// Tier is a filter, not a badge. Every retention class belongs to exactly one
// tier, so a tier badge on the card would restate what the class badge already
// says. Tier still earns its place as a coarse filter (three buttons rather
// than seven).
const tierLabels: Record<Tier, string> = {
  persistent: 'Persistent',
  temporary: 'Temporary',
  peer_networking: 'Peer',
};

const retentionClassLabels: Record<RetentionClass, string> = {
  deletable: 'Deletable',
  community_record: 'Community Record',
  third_party_synced: '3rd-Party Synced',
  moderation_record: 'Moderation Record',
  compliance_record: 'Compliance Record',
  auto_purged: 'Auto-Purged',
  in_the_wind: 'In the Wind',
  participant_observed: 'Participant-Seen',
};

const retentionClassColors: Record<RetentionClass, string> = {
  deletable:
    'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200',
  community_record:
    'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200',
  third_party_synced:
    'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200',
  moderation_record:
    'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200',
  compliance_record:
    'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-200',
  auto_purged:
    'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
  in_the_wind:
    'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-200',
  participant_observed:
    'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200',
};

type FilterTier = 'all' | Tier;

const filters: FilterTier[] = [
  'all',
  'persistent',
  'temporary',
  'peer_networking',
];

export function PrivacyAtAGlance() {
  const [filter, setFilter] = useState<FilterTier>('all');

  const filtered =
    filter === 'all'
      ? allCategories
      : allCategories.filter((c) => c.tier === filter);

  return (
    <div className="not-prose">
      {/* Filter buttons */}
      <div className="mb-4 flex flex-wrap gap-2">
        {filters.map((t) => (
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
          const Icon = icons[cat.display.icon] ?? Database;
          return (
            <div
              key={cat.name}
              className="hover:bg-muted/30 rounded-lg border p-4 transition-colors"
            >
              <div className="mb-2 flex items-center gap-2">
                <Icon className="text-muted-foreground h-4 w-4 shrink-0" />
                <span className="font-medium">{cat.label}</span>
              </div>
              <div className="mb-2 flex flex-wrap gap-1">
                <Badge
                  className={`${retentionClassColors[cat.retentionClass]} border-0 text-[10px]`}
                >
                  {retentionClassLabels[cat.retentionClass]}
                </Badge>
              </div>
              <dl className="text-muted-foreground grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-xs">
                <dt>Source:</dt>
                <dd>{cat.display.source}</dd>
                <dt>Purpose:</dt>
                <dd>{cat.display.purpose}</dd>
                <dt>Retention:</dt>
                <dd>{cat.display.retention}</dd>
                <dt>Shared with:</dt>
                <dd>{cat.display.sharedWith}</dd>
              </dl>
            </div>
          );
        })}
      </div>
    </div>
  );
}
