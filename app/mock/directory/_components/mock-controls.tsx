'use client';

import { FlaskConical } from 'lucide-react';
import type { ViewerKind } from '../../business-profile/_components/pana-gate';

export interface DirectoryMockState {
  locationShared: boolean;
  viewer: ViewerKind;
}

interface MockControlsProps {
  state: DirectoryMockState;
  onChange: (next: DirectoryMockState) => void;
}

const VIEWERS: { key: ViewerKind; label: string; hint: string }[] = [
  { key: 'anon', label: 'Signed out', hint: 'Save prompts for signup' },
  {
    key: 'business',
    label: 'Business account',
    hint: 'Signed in, but with no pana profile — Save is not offered at all',
  },
  { key: 'pana', label: 'Pana', hint: 'Everything works' },
];

/**
 * Scaffolding, not design — same deal as the business profile mock.
 *
 * Only two states are worth toggling here. Everything else on this page
 * (filters, sort, view, the empty state) is reachable by using the page as a
 * visitor would, and reviewing it that way is the point.
 */
export function MockControls({ state, onChange }: MockControlsProps) {
  return (
    <div className="bizprofile-mockbar">
      <div className="container mx-auto flex flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
        <span className="flex items-center gap-2 text-xs font-extrabold tracking-wider uppercase opacity-70">
          <FlaskConical className="h-4 w-4" aria-hidden="true" />
          Design mock
        </span>

        <button
          type="button"
          className="bizprofile-mocktoggle"
          data-on={state.locationShared}
          aria-pressed={state.locationShared}
          title="Shows distances and unlocks the Nearest sort"
          onClick={() =>
            onChange({ ...state, locationShared: !state.locationShared })
          }
        >
          Location shared
        </button>

        <div className="flex items-center gap-2">
          <span className="text-[0.6875rem] font-extrabold tracking-wider uppercase opacity-55">
            Viewing as
          </span>
          <div className="bizprofile-mockseg">
            {VIEWERS.map((viewer) => (
              <button
                key={viewer.key}
                type="button"
                data-on={state.viewer === viewer.key}
                aria-pressed={state.viewer === viewer.key}
                title={viewer.hint}
                onClick={() => onChange({ ...state, viewer: viewer.key })}
              >
                {viewer.label}
              </button>
            ))}
          </div>
        </div>

        <span className="ml-auto hidden text-xs font-semibold opacity-55 lg:inline">
          Search, filter, and sort are live — try them.
        </span>
      </div>
    </div>
  );
}
