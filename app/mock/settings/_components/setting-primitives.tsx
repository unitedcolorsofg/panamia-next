'use client';

import type { ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { SCOPE_LABEL, type SettingScope } from '../_data/mock-settings';

/* The small pieces every section is built from. They live together because
   their whole job is consistency: the moment "Messages" invents its own row
   shape, the page stops reading as one document and goes back to being a stack
   of unrelated cards, which is what it is today. */

/** Where a setting takes effect. Rendered on every group, never omitted — a
 *  scope chip that appears only sometimes teaches members to look for it, and
 *  then its absence means something it does not mean. */
export function ScopeChip({ scope }: { scope: SettingScope }) {
  return (
    <span className="scope-chip" data-scope={scope}>
      {SCOPE_LABEL[scope]}
    </span>
  );
}

/** A group of rows. A `.profile-card` — the same card the feed and the profile
 *  use — rather than a settings-specific panel. */
export function SettingsCard({ children }: { children: ReactNode }) {
  return <div className="profile-card overflow-hidden">{children}</div>;
}

/** One setting. The label and its explanation sit left, the control sits
 *  right on desktop and beneath on mobile — so a member scanning for the thing
 *  they came to change reads a column of labels, not a column of inputs. */
export function SettingsRow({
  label,
  htmlFor,
  note,
  control,
  children,
}: {
  label: string;
  htmlFor?: string;
  note?: ReactNode;
  /** Narrow controls — a segment, a button — that belong beside the label. */
  control?: ReactNode;
  /** Wide controls, which get the full width under the label instead. */
  children?: ReactNode;
}) {
  return (
    <div className="settings-row">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
        <div className="min-w-[min(100%,14rem)] flex-1">
          {htmlFor ? (
            <label className="settings-label" htmlFor={htmlFor}>
              {label}
            </label>
          ) : (
            <span className="settings-label">{label}</span>
          )}
          {note && <div className="settings-note mt-1.5">{note}</div>}
        </div>
        {control && <div className="flex-none pt-0.5">{control}</div>}
      </div>
      {children && <div className="mt-3">{children}</div>}
    </div>
  );
}

/** What a change costs, next to the control that causes it. */
export function Consequence({
  title,
  points,
}: {
  title: string;
  points: string[];
}) {
  return (
    <div className="settings-consequence">
      <AlertTriangle
        className="text-pana-burnt mt-0.5 h-4 w-4 flex-none"
        aria-hidden="true"
      />
      <div>
        <p className="settings-consequence-title">{title}</p>
        <ul className="mt-1.5 space-y-1">
          {points.map((point) => (
            <li key={point} className="flex gap-2">
              <span aria-hidden="true" className="text-pana-burnt">
                &middot;
              </span>
              <span>{point}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** A two-state consent control. Both states are named, because "off" for a
 *  marketing channel is a recorded legal position and needs to be as
 *  unambiguous on screen as it is in the database. */
export function OnOff({
  value,
  onChange,
  label,
}: {
  value: boolean;
  onChange: (next: boolean) => void;
  /** Names the control for screen readers, since "On"/"Off" alone does not say
   *  on what. */
  label: string;
}) {
  return (
    <div className="settings-segment" role="group" aria-label={label}>
      <button
        type="button"
        data-value="on"
        data-active={value}
        aria-pressed={value}
        onClick={() => onChange(true)}
      >
        On
      </button>
      <button
        type="button"
        data-value="off"
        data-active={!value}
        aria-pressed={!value}
        onClick={() => onChange(false)}
      >
        Off
      </button>
    </div>
  );
}
