'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Lock, Globe } from 'lucide-react';
import { useSession } from '@/lib/auth-client';
import { useCreateGroup } from '@/lib/query/social';
import type {
  SocialGroupJoinPolicy,
  SocialGroupVisibility,
} from '@/lib/schema';

/* Mirrors of the server's caps, so the form can stop a member before a round
   trip rather than after one. The server still enforces all of them -- these
   are a courtesy, not the boundary. */
const MAX_NAME = 80;
const MAX_SUMMARY = 500;
const MAX_TOPICS = 12;
const MAX_HANDLE = 24;
const MIN_HANDLE = 3;

/* The repo styles inputs inline rather than with a shared class -- see the
   search field in app/search/_components/search-content.tsx. Hoisted to a
   constant here only because this form has four of them. */
const INPUT_CLASS =
  'border-pana-ink/12 focus:border-pana-orange/55 focus:ring-pana-orange/18 w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm font-medium focus:ring-2 focus:outline-none';

const VISIBILITY_OPTIONS: {
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
 * The last two are shown but not yet selectable, and that is deliberate rather
 * than lazy. `joinGroup` already honours them — 'request' parks a member as
 * pending, 'invite' refuses outright — but nothing yet exists to *approve* a
 * request or *send* an invite, and there is no way to edit a group after it is
 * created. Together those make either choice a permanent dead end: an
 * invite-only group could never gain a second member, and a by-request group
 * would collect people nobody can let in.
 *
 * Showing them greyed out says "this is coming" instead of silently implying
 * open groups are the only kind Pana will ever have.
 */
const JOIN_OPTIONS: {
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

/**
 * Turn a group's name into a usable handle.
 *
 * Only ever fills a handle the member has not typed in themselves -- see the
 * `handleTouched` flag. Silently rewriting a handle somebody chose because
 * they later edited the name is the kind of "help" that loses work.
 */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_HANDLE);
}

/**
 * The form behind /groups/new.
 *
 * Asks for the name first and derives the handle from it, because the name is
 * the thing the founder already has in their head; the handle is plumbing they
 * would otherwise have to invent before they could describe what they are
 * making.
 */
export function CreateGroupForm() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const create = useCreateGroup();

  const [name, setName] = useState('');
  const [handle, setHandle] = useState('');
  const [handleTouched, setHandleTouched] = useState(false);
  const [summary, setSummary] = useState('');
  const [topics, setTopics] = useState('');
  const [visibility, setVisibility] = useState<SocialGroupVisibility>('public');
  const [joinPolicy, setJoinPolicy] = useState<SocialGroupJoinPolicy>('open');

  const effectiveHandle = handleTouched ? handle : slugify(name);

  const handleTooShort =
    effectiveHandle.length > 0 && effectiveHandle.length < MIN_HANDLE;

  const canSubmit =
    name.trim().length > 0 &&
    effectiveHandle.length >= MIN_HANDLE &&
    !create.isPending;

  if (status === 'loading') {
    return (
      <div className="animate-pulse space-y-3" aria-hidden="true">
        <div className="bg-pana-ink/10 h-10 rounded-xl" />
        <div className="bg-pana-ink/10 h-24 rounded-2xl" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="border-pana-ink/10 space-y-2 rounded-2xl border bg-white p-6">
        <p className="text-pana-ink text-[15px] font-extrabold">
          Sign in to start a group
        </p>
        <p className="text-pana-ink/65 text-[13px] leading-snug font-medium">
          A group needs a founding admin, and that is an account.
        </p>
        <Link
          href="/signin"
          className="bg-pana-ink mt-1 inline-flex rounded-full px-4 py-2 text-[13px] font-extrabold text-white"
        >
          Sign in
        </Link>
      </div>
    );
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;

    const created = await create.mutateAsync({
      handle: effectiveHandle,
      name: name.trim(),
      summary: summary.trim() || undefined,
      topics: topics
        .split(',')
        .map((topic) => topic.trim())
        .filter(Boolean)
        .slice(0, MAX_TOPICS),
      visibility,
      joinPolicy,
    });

    // The handle is what the group is reachable by, and the server normalises
    // the one we sent -- follow its answer rather than our input.
    router.push(`/g/${created.actor.username ?? effectiveHandle}`);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <Field label="Name" hint="What people will call it.">
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={MAX_NAME}
          required
          placeholder="Miami Zine Club"
          className={INPUT_CLASS}
        />
      </Field>

      <Field
        label="Handle"
        hint={`Its address: pana.social/g/${effectiveHandle || 'your-group'}. Letters, numbers, dashes. ${MIN_HANDLE}–${MAX_HANDLE} characters.`}
        error={handleTooShort ? `At least ${MIN_HANDLE} characters.` : null}
      >
        <input
          type="text"
          value={effectiveHandle}
          onChange={(event) => {
            setHandleTouched(true);
            setHandle(event.target.value.toLowerCase());
          }}
          maxLength={MAX_HANDLE}
          required
          placeholder="miami-zine-club"
          className={INPUT_CLASS}
        />
      </Field>

      <Field label="Description" hint="Optional. What is this group for?">
        <textarea
          value={summary}
          onChange={(event) => setSummary(event.target.value)}
          maxLength={MAX_SUMMARY}
          rows={3}
          placeholder="We trade zines, run swaps, and print together once a month."
          className={`${INPUT_CLASS} resize-y`}
        />
      </Field>

      <Field
        label="Topics"
        hint={`Optional, comma separated. Up to ${MAX_TOPICS}. These are what people search by.`}
      >
        <input
          type="text"
          value={topics}
          onChange={(event) => setTopics(event.target.value)}
          placeholder="zines, printmaking, diy"
          className={INPUT_CLASS}
        />
      </Field>

      <RadioField
        legend="Who can read it"
        name="visibility"
        options={VISIBILITY_OPTIONS}
        value={visibility}
        onChange={setVisibility}
        icons={{ public: Globe, private: Lock }}
      />

      <RadioField
        legend="Who can join"
        name="joinPolicy"
        options={JOIN_OPTIONS}
        value={joinPolicy}
        onChange={setJoinPolicy}
      />

      {create.isError && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 px-4 py-3 text-[13px] font-bold text-red-700"
        >
          {create.error.message}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={!canSubmit}
          className="bg-pana-ink inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[14px] font-extrabold text-white disabled:opacity-40"
        >
          {create.isPending && (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          )}
          {create.isPending ? 'Starting…' : 'Start group'}
        </button>
        <Link
          href="/groups"
          className="text-pana-ink/60 inline-flex items-center gap-1.5 text-[13px] font-bold"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Back to groups
        </Link>
      </div>
    </form>
  );
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  children: React.ReactNode;
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

function RadioField<T extends string>({
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
  icons?: Record<string, React.ComponentType<{ className?: string }>>;
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
