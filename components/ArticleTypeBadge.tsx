/**
 * ArticleTypeBadge Component
 *
 * UPSTREAM REFERENCE: external/activities.next/lib/activities/actions/
 * Display article type as a styled badge
 */

import { Badge } from '@/components/ui/badge';
import { Briefcase, MessageSquare } from 'lucide-react';

interface ArticleTypeBadgeProps {
  type: 'business_update' | 'community_commentary';
  size?: 'sm' | 'md' | 'lg';
}

export default function ArticleTypeBadge({
  type,
  size = 'md',
}: ArticleTypeBadgeProps) {
  const isBusinessUpdate = type === 'business_update';

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
      variant={isBusinessUpdate ? 'default' : 'secondary'}
      className={`inline-flex items-center gap-1.5 ${sizeClasses[size]}`}
    >
      {isBusinessUpdate ? (
        <Briefcase className={iconSizes[size]} />
      ) : (
        <MessageSquare className={iconSizes[size]} />
      )}
      {isBusinessUpdate ? 'Business Update' : 'Community Commentary'}
    </Badge>
  );
}
