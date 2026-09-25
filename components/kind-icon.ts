import { CalendarDays, Store, User, Users, type LucideIcon } from 'lucide-react';
import type { SuggestionKind } from '@/lib/suggest';

/**
 * One icon per kind, shared by everything that shows a mixed result list.
 *
 * The typeahead rows, the scope menu, the scope chips and the "Everything"
 * section headings all draw from this, because a kind that is a storefront in
 * the dropdown and a briefcase in the scope bar is two kinds as far as anyone
 * reading the page is concerned. The icon is the only thing distinguishing a
 * cafe from the pana who runs it when both are called Lucía.
 *
 * Store over Building: the directory is shops, makers and studios, not
 * offices. User and Users for pana and group so the singular/plural pairing
 * carries the difference on its own. CalendarDays over Calendar because an
 * event is a date rather than a month.
 */
export const KIND_ICON: Record<SuggestionKind, LucideIcon> = {
  business: Store,
  pana: User,
  group: Users,
  event: CalendarDays,
};
