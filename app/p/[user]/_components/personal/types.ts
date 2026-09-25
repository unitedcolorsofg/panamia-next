import type { LucideIcon } from 'lucide-react';

export type PersonalTab = 'posts' | 'events' | 'groups' | 'panas';

export interface StatDef {
  tab: PersonalTab;
  label: string;
  /** Null while the figure is still loading, rendered as an em dash. */
  value: number | null;
}

export interface TabDef {
  id: PersonalTab;
  label: string;
  icon: LucideIcon;
  count: number | null;
  /**
   * Marks a tab whose feature hasn't shipped. Such a tab shows a "Soon" chip
   * instead of a count, because a number implies there is data behind it.
   */
  soon?: boolean;
}
