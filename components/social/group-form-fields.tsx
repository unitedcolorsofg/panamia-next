'use client';

import type { ComponentType, ReactNode } from 'react';
import type {
  SocialGroupJoinPolicy,
  SocialGroupVisibility,
} from '@/lib/schema';

/**
 * The pieces the create-a-group and edit-a-group forms both need.
 *
 * Split out when the edit surface landed, because the alternative was two
 * copies of the same option lists. That matters here more than it usually
 * does: the join policies are half-built on purpose, and when approvals ship
 * somebody will enable 'request' in exactly one file and not notice. One
 * definition makes that impossible.
 */

/* Mirrors of the server's caps (lib/federation/wrappers/group.ts), so a form
   can stop a member before a round trip rather than after one. The server
   still enforces all of them -- these are a courtesy, not the boundary. */
export const MAX_NAME = 80;
export const MAX_SUMMARY = 500;
export const MAX_TOPICS = 12;
export const MAX_RULES = 20;
export const MAX_RULE_LENGTH = 280;

/* The repo styles inputs inline rather than with a shared class -- see the
   search field in app/search/_components/search-content.tsx. Hoisted to a
   constant because the group forms have several of them. */
export const INPUT_CLASS =
  'border-pana-ink/12 focus:border-pana-orange/55 focus:ring-pana-orange/18 w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm font-medium focus:ring-2 focus:outline-none';

export const VISIBILITY_OPTIONS: {
  value: SocialGroupVisibility;
  label: string;
  hint: string;
}[] = [
  {
    value: 'public',
    label: 'Public',
    hint: 'Anyone can read the posts. Shows on your profile.',
  },
  {
    value: 'private',
    label: 'Private',
    hint: 'Only members can read the posts. The group is still findable by name so people can ask to join, but nothing inside it is.',
  },
];

/**
 * Who may join.
 *
 * The last two are shown but not selectable, and that is deliberate rather
 * than lazy. `joinGroup` already honours them -- 'request' parks a member as
 * pending, 'invite' refuses outright -- but nothing yet exists to *approve* a
 * request or *send* an invite. Until that is built, an invite-only group could
 * never gain a second member and a by-request group would collect people
 * nobody can let in.
 *
 * A group can now be edited after it is created, so neither choice would be
 * permanent any more -- but a dead end you can back out of is still a dead
 * end, and the member who picked it would be stranded until they noticed.
 *
 * Showing them greyed out says "this is coming" instead of silently implying
 * open groups are the only kind Pana will ever have.
 */
export const JOIN_OPTIONS: {
  value: SocialGroupJoinPolicy;
  label: string;
  hint: string;
  disabled?: boolean;
}[] = [
  { value: 'open', label: 'Anyone can join', hint: 'No approval needed.' },
  {
    value: 'request',
    label: 'By request',
    hint: 'People ask, and an admin decides. Approvals are not built yet.',
    disabled: true,
  },
  {
    value: 'invite',
    label: 'Invite only',
    hint: 'Nobody can ask. Admins add people. Invites are not built yet.',
    disabled: true,
  },
];

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-pana-ink block text-[14px] font-extrabold">
        {label}
      </span>
      {children}
      {error ? (
        <span className="block text-[12px] font-bold text-red-600">
          {error}
        </span>
      ) : (
        hint && (
          <span className="text-pana-ink/55 block text-[12px] leading-snug font-medium">
            {hint}
          </span>
        )
      )}
    </label>
  );
}

export function RadioField<T extends string>({
  legend,
  name,
  options,
  value,
  onChange,
  icons,
}: {
  legend: string;
  name: string;
  options: { value: T; label: string; hint: string; disabled?: boolean }[];
  value: T;
  onChange: (value: T) => void;
  icons?: Record<string, ComponentType<{ className?: string }>>;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-pana-ink text-[14px] font-extrabold">
        {legend}
      </legend>
      <div className="space-y-2">
        {options.map((option) => {
          const Icon = icons?.[option.value];
          const selected = option.value === value;
          const disabled = option.disabled ?? false;
          return (
            <label
              key={option.value}
              className={`flex items-start gap-3 rounded-2xl border bg-white p-3.5 transition-colors ${
                disabled
                  ? 'border-pana-ink/10 cursor-not-allowed opacity-55'
                  : selected
                    ? 'border-pana-indigo ring-pana-indigo/15 cursor-pointer ring-2'
                    : 'border-pana-ink/10 hover:border-pana-ink/25 cursor-pointer'
              }`}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={selected}
                disabled={disabled}
                onChange={() => onChange(option.value)}
                className="mt-1"
              />
              <span className="min-w-0">
                <span className="text-pana-ink flex items-center gap-1.5 text-[14px] font-extrabold">
                  {Icon && <Icon className="h-3.5 w-3.5" />}
                  {option.label}
                </span>
                <span className="text-pana-ink/60 block text-[12px] leading-snug font-medium">
                  {option.hint}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
