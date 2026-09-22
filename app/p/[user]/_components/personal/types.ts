import type { LucideIcon } from 'lucide-react';

export type PersonalTab = 'posts' | 'panas' | 'groups';

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
}
