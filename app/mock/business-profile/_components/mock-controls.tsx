'use client';

import { FlaskConical } from 'lucide-react';

export interface MockState {
  certified: boolean;
  claimed: boolean;
  owner: boolean;
}

interface MockControlsProps {
  state: MockState;
  onChange: (next: MockState) => void;
}

const TOGGLES: { key: keyof MockState; label: string; hint: string }[] = [
  {
    key: 'certified',
    label: 'Pana Certified',
    hint: 'Set by Pana Mia staff',
  },
  {
    key: 'claimed',
    label: 'Claimed by a pana',
    hint: 'Unlocks the updates feed',
  },
  {
    key: 'owner',
    label: 'Viewing as owner',
    hint: 'Shows the photo upload tools',
  },
];

/**
 * Scaffolding, not design.
 *
 * The profile has three independent states that change what renders — whether
 * Pana Mia has certified it, whether a pana has claimed it, and whether the
 * person looking at it owns it. That is eight combinations, and reviewing them
 * as eight routes or eight screenshots is how the awkward ones (certified but
 * unclaimed) go unnoticed until they ship.
 *
 * This bar is deleted along with the rest of `app/mock/` once the design is
 * agreed. Nothing in it should be carried into the real page.
 */
export function MockControls({ state, onChange }: MockControlsProps) {
  return (
    <div className="bizprofile-mockbar">
      <div className="container mx-auto flex flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
        <span className="flex items-center gap-2 text-xs font-extrabold tracking-wider uppercase opacity-70">
          <FlaskConical className="h-4 w-4" aria-hidden="true" />
          Design mock
        </span>

        <div className="flex flex-wrap gap-2">
          {TOGGLES.map((toggle) => (
            <button
              key={toggle.key}
              type="button"
              className="bizprofile-mocktoggle"
              data-on={state[toggle.key]}
              aria-pressed={state[toggle.key]}
              title={toggle.hint}
              onClick={() =>
                onChange({ ...state, [toggle.key]: !state[toggle.key] })
              }
            >
              {toggle.label}
            </button>
          ))}
        </div>

        <span className="ml-auto hidden text-xs font-semibold opacity-55 lg:inline">
          Toggle the states this page can be in — none of this ships.
        </span>
      </div>
    </div>
  );
}
