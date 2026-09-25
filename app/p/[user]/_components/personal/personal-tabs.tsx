import { CalendarDays, FileText, Users, UsersRound } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { PersonalTab, TabDef } from './types';

/* Tab bar for the profile body.
 *
 * Hand-rolled rather than shadcn `Tabs` because the stat rail above also
 * drives this state — the Radix component owns its own value internally, and
 * threading a controlled value through it buys nothing here while costing the
 * flat, rule-based treatment the redesign calls for. */
export function PersonalTabs({
  tabs,
  activeTab,
  onSelectTab,
}: {
  tabs: TabDef[];
  activeTab: PersonalTab;
  onSelectTab: (tab: PersonalTab) => void;
}) {
  return (
    <div className="profile-tabs" role="tablist" aria-label="Profile content">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`profile-tab-${tab.id}`}
            aria-selected={isActive}
            aria-controls={`profile-panel-${tab.id}`}
            className="profile-tab"
            data-active={isActive}
            onClick={() => onSelectTab(tab.id)}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {tab.label}
            {tab.soon ? (
              <span className="profile-tab-count">Soon</span>
            ) : (
              tab.count !== null && (
                <span className="profile-tab-count">
                  {tab.count.toLocaleString('en-US')}
                </span>
              )
            )}
          </button>
        );
      })}
    </div>
  );
}

export const PERSONAL_TAB_ICONS: Record<PersonalTab, LucideIcon> = {
  posts: FileText,
  events: CalendarDays,
  groups: UsersRound,
  panas: Users,
};
