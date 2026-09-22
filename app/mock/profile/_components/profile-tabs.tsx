import { FileText, Users, UsersRound } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ProfileTab } from '../_data/mock-profile';

interface TabDef {
  id: ProfileTab;
  label: string;
  icon: LucideIcon;
  count: number;
}

/* Tab bar for the profile body.
 *
 * Hand-rolled rather than shadcn `Tabs` because the stat rail above also
 * drives this state — the Radix component owns its own value internally, and
 * threading a controlled value through it buys nothing here while costing the
 * flat, rule-based treatment the redesign calls for. */
export function ProfileTabs({
  tabs,
  activeTab,
  onSelectTab,
}: {
  tabs: TabDef[];
  activeTab: ProfileTab;
  onSelectTab: (tab: ProfileTab) => void;
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
            <span className="profile-tab-count">
              {tab.count.toLocaleString('en-US')}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export const PROFILE_TAB_ICONS: Record<ProfileTab, LucideIcon> = {
  posts: FileText,
  panas: Users,
  groups: UsersRound,
};

export type { TabDef };
