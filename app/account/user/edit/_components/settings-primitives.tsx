'use client';

import type { ReactNode } from 'react';
import { AlertTriangle, Check, Loader2 } from 'lucide-react';

/* The small pieces every settings section is built from.
 *
 * They live together because their whole job is consistency. The page this
 * replaced was two shadcn cards whose rows each invented their own spacing, and
 * the moment one section invents its own row shape the page stops reading as a
 * single document.
 *
 * Deliberately not imported from app/mock/settings, which is where this design
 * was worked out: mock fixtures are exploratory and are allowed to change or be
 * deleted without notice. The shared layer between the two is app/globals.css,
 * which is the contract app/mock/README.md actually asks for. */

export type SettingScope = 'everywhere' | 'social' | 'www';

const SCOPE_LABEL: Record<SettingScope, string> = {
  everywhere: 'Applies everywhere',
  social: 'Pana Social only',
  www: 'Pana Mia only',
};

/** Where a setting takes effect. Rendered on every group, never omitted — a
 *  scope chip that appears only sometimes teaches members to look for it, and
 *  then its absence starts meaning something it does not mean. */
export function ScopeChip({ scope }: { scope: SettingScope }) {
  return (
    <span className="scope-chip" data-scope={scope}>
      {SCOPE_LABEL[scope]}
    </span>
  );
}

/** A group of rows. A `.profile-card` — the same card the feed and the profile
 *  use — rather than a settings-specific panel, so this page reads as the same
 *  product as the rest of the site. */
export function SettingsCard({
  children,
  danger,
}: {
  children: ReactNode;
  danger?: boolean;
}) {
  return (
    <div
      className={`profile-card overflow-hidden${danger ? ' settings-danger' : ''}`}
    >
      {children}
    </div>
  );
}

/** One setting. The label and its explanation sit left, the control sits right
 *  on desktop and beneath on mobile — so a member scanning for the thing they
 *  came to change reads a column of labels, not a column of inputs. */
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

/** What a change costs, next to the control that causes it.
 *
 *  The page this replaced put these facts in a confirmation dialog, which is
 *  the one place they cannot help: by then the member has already decided and
 *  is reading a thing standing between them and the button they meant to
 *  press. The dialog is still there — this is what lets them not need it. */
export function Consequence({
  title,
  points,
}: {
  title: string;
  points: ReactNode[];
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
          {points.map((point, index) => (
            <li key={index} className="flex gap-2">
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

/** A two-state consent control. Both states are named rather than implied by a
 *  sliding knob, because marketing consent is a recorded legal position and
 *  needs to be as unambiguous on screen as it is in the database. */
export function OnOff({
  value,
  onChange,
  label,
  disabled,
  busy,
}: {
  value: boolean;
  onChange: (next: boolean) => void;
  /** Names the control for screen readers, since "On"/"Off" alone does not say
   *  on what. */
  label: string;
  disabled?: boolean;
  busy?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      {busy && (
        <Loader2
          className="text-pana-ink/40 h-3.5 w-3.5 animate-spin"
          aria-hidden="true"
        />
      )}
      <div className="settings-segment" role="group" aria-label={label}>
        <button
          type="button"
          data-value="on"
          data-active={value}
          aria-pressed={value}
          disabled={disabled}
          onClick={() => onChange(true)}
        >
          On
        </button>
        <button
          type="button"
          data-value="off"
          data-active={!value}
          aria-pressed={!value}
          disabled={disabled}
          onClick={() => onChange(false)}
        >
          Off
        </button>
      </div>
    </div>
  );
}

/** Whether a control saves on its own or waits for the save bar.
 *
 *  The page this replaced had one "Update" button covering three fields while
 *  the licence picker and every marketing toggle wrote immediately, with
 *  nothing on screen to tell them apart. A member could change their licence,
 *  think better of it, leave without pressing Update, and be wrong about what
 *  they had just done. */
export function AutoSaved({
  state,
}: {
  state: 'idle' | 'saving' | 'saved' | 'error';
}) {
  if (state === 'saving') {
    return (
      <span className="settings-note inline-flex items-center gap-1.5">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        Saving
      </span>
    );
  }
  if (state === 'saved') {
    return (
      <span className="text-pana-indigo inline-flex items-center gap-1.5 text-[13px] font-extrabold">
        <Check className="h-3.5 w-3.5" aria-hidden="true" />
        Saved
      </span>
    );
  }
  if (state === 'error') {
    return (
      <span className="text-pana-red text-[13px] font-extrabold">
        Not saved
      </span>
    );
  }
  return <span className="settings-note">Saves on its own</span>;
}
