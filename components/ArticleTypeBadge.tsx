/**
 * ArticleTypeBadge Component
 *
 * UPSTREAM REFERENCE: external/activities.next/lib/activities/actions/
 * Display article type as a styled badge
 */

import { Badge } from '@/components/ui/badge';
import { Briefcase, MessageSquare, Megaphone } from 'lucide-react';

type ArticleTypeBadgeType =
  'business_update' | 'community_commentary' | 'staff_update';

interface ArticleTypeBadgeProps {
  type: ArticleTypeBadgeType;
  size?: 'sm' | 'md' | 'lg';
}

const TYPE_CONFIG: Record<
  ArticleTypeBadgeType,
  {
    label: string;
    variant: 'default' | 'secondary';
    Icon: typeof Briefcase;
  }
> = {
  business_update: {
    label: 'Business Update',
    variant: 'default',
    Icon: Briefcase,
  },
  community_commentary: {
    label: 'Community Commentary',
    variant: 'secondary',
    Icon: MessageSquare,
  },
  staff_update: {
    label: 'Staff Update',
    variant: 'default',
    Icon: Megaphone,
  },
};

export default function ArticleTypeBadge({
  type,
  size = 'md',
}: ArticleTypeBadgeProps) {
  const { label, variant, Icon } = TYPE_CONFIG[type];

  const sizeClasses = {
    sm: 'text-xs py-0.5 px-2',
    md: 'text-sm py-1 px-3',
    lg: 'text-base py-1.5 px-4',
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  };

  return (
    <Badge
      variant={variant}
      className={`inline-flex items-center gap-1.5 ${sizeClasses[size]}`}
    >
      <Icon className={iconSizes[size]} />
      {label}
    </Badge>
  );
}
