'use client';

import { useEffect, useState } from 'react';
import { Globe, Loader2, Lock } from 'lucide-react';
import { useUpdateGroup } from '@/lib/query/social';
import {
  INPUT_CLASS,
  JOIN_OPTIONS,
  MAX_NAME,
  MAX_RULES,
  MAX_RULE_LENGTH,
  MAX_SUMMARY,
  MAX_TOPICS,
  VISIBILITY_OPTIONS,
  Field,
  RadioField,
} from '@/components/social/group-form-fields';
import type {
  SocialActor,
  SocialGroup,
  SocialGroupJoinPolicy,
  SocialGroupVisibility,
} from '@/lib/schema';

/**
 * Edit what a group says about itself.
 *
 * Everything here is a group's *description* of itself. Its handle is not,
 * which is why the handle field is absent rather than disabled: a disabled
 * input invites someone to go looking for the way to enable it, and there
 * isn't one. The handle is the group's address, it is shared with the flat
 * screenname namespace, and changing it would break every existing link.
 *
 * Sends only what changed. That is not an optimisation -- `topics` and `rules`
 * are whole-list replacements on the server, so a form that posted every field
 * every time would quietly rewrite lists the admin never touched.
 */
export function EditGroupForm({
  handle,
  group,
  actor,
}: {
  handle: string;
  group: SocialGroup;
  actor: SocialActor;
}) {
  const update = useUpdateGroup();

  const initial = {
    name: actor.name ?? '',
    summary: actor.summary ?? '',
    topics: topicsToText(group.topics),
    /* One rule per line. A repeatable row of inputs would be more explicit,
       but rules get reordered and rewritten in bulk far more often than they
       get added one at a time, and a textarea is the only control where that
       is a single gesture. */
    rules: (group.rules ?? []).join('\n'),
    visibility: group.visibility,
    joinPolicy: group.joinPolicy,
  };

  const [name, setName] = useState(initial.name);
  const [summary, setSummary] = useState(initial.summary);
  const [topics, setTopics] = useState(initial.topics);
  const [rules, setRules] = useState(initial.rules);
  const [visibility, setVisibility] = useState<SocialGroupVisibility>(
    initial.visibility
  );
  const [joinPolicy, setJoinPolicy] = useState<SocialGroupJoinPolicy>(
    initial.joinPolicy
  );
  const [saved, setSaved] = useState(false);

  /* The confirmation is transient on purpose. A permanent "Saved" is stale
     the moment the next keystroke lands, and would still be sitting there
     claiming success while unsaved edits are on screen. */
  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setSaved(false), 4000);
    return () => clearTimeout(timer);
  }, [saved]);

  const topicList = splitTopics(topics);
  const ruleList = splitRules(rules);

  const trimmedName = name.trim();
  const nameError = !trimmedName ? 'A group needs a name.' : null;
  const topicsError =
    topicList.length > MAX_TOPICS
      ? `Up to ${MAX_TOPICS} topics. You have ${topicList.length}.`
      : null;
  const rulesError =
    ruleList.length > MAX_RULES
      ? `Up to ${MAX_RULES} rules. You have ${ruleList.length}.`
      : ruleList.some((rule) => rule.length > MAX_RULE_LENGTH)
        ? `Each rule must be ${MAX_RULE_LENGTH} characters or fewer.`
        : null;

  const dirty =
    trimmedName !== initial.name.trim() ||
    summary.trim() !== initial.summary.trim() ||
    topics.trim() !== initial.topics.trim() ||
    rules !== initial.rules ||
    visibility !== initial.visibility ||
    joinPolicy !== initial.joinPolicy;

  const canSave =
    dirty && !nameError && !topicsError && !rulesError && !update.isPending;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSave) return;

    // Only the fields that actually moved, so untouched lists are left alone.
    const input: Parameters<typeof update.mutateAsync>[0]['input'] = {};
    if (trimmedName !== initial.name.trim()) input.name = trimmedName;
    if (summary.trim() !== initial.summary.trim()) {
      input.summary = summary.trim() || null;
    }
    if (topics.trim() !== initial.topics.trim()) input.topics = topicList;
    if (rules !== initial.rules) input.rules = ruleList;
    if (visibility !== initial.visibility) input.visibility = visibility;
    if (joinPolicy !== initial.joinPolicy) input.joinPolicy = joinPolicy;

    try {
      await update.mutateAsync({ handle, input });
      setSaved(true);
    } catch {
      // The mutation's own error state renders below.
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-5">
      <div>
        <h2 className="text-pana-ink text-[17px] font-black">Group details</h2>
        <p className="text-pana-ink/55 mt-1 text-[13px] font-medium">
          The handle{' '}
          <span className="text-pana-ink/75 font-bold">@{handle}</span> is
          permanent. It is the group&apos;s address, so changing it would break
          every link to it.
        </p>
      </div>

      <Field label="Name" error={nameError}>
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={MAX_NAME}
          className={INPUT_CLASS}
        />
      </Field>

      <Field label="Description" hint="What is this group for?">
        <textarea
          value={summary}
          onChange={(event) => setSummary(event.target.value)}
          maxLength={MAX_SUMMARY}
          rows={3}
          className={`${INPUT_CLASS} resize-y`}
        />
      </Field>

      <Field
        label="Topics"
        hint={`Comma separated. Up to ${MAX_TOPICS}. These are what people search by.`}
        error={topicsError}
      >
        <input
          type="text"
          value={topics}
          onChange={(event) => setTopics(event.target.value)}
          placeholder="zines, printmaking, diy"
          className={INPUT_CLASS}
        />
      </Field>

      <Field
        label="Rules"
        hint={`One per line. Up to ${MAX_RULES}. These show on the group page.`}
        error={rulesError}
      >
        <textarea
          value={rules}
          onChange={(event) => setRules(event.target.value)}
          rows={4}
          placeholder={'Be kind.\nNo selling.'}
          className={`${INPUT_CLASS} resize-y`}
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

      {update.isError && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 px-4 py-3 text-[13px] font-bold text-red-700"
        >
          {update.error.message}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={!canSave}
          className="bg-pana-ink inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[14px] font-extrabold text-white disabled:opacity-40"
        >
          {update.isPending && (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          )}
          {update.isPending ? 'Saving…' : 'Save changes'}
        </button>
        {saved && !dirty && (
          <span
            role="status"
            className="text-[13px] font-bold text-emerald-700"
          >
            Saved
          </span>
        )}
      </div>
    </form>
  );
}

/**
 * The stored `{ topic: true }` flag map, as the comma-separated text the
 * field edits.
 *
 * Sorted, so the order does not shift between renders -- object key order is
 * an implementation detail nobody should be able to watch change.
 */
function topicsToText(flags: Record<string, boolean> | null): string {
  if (!flags) return '';
  return Object.keys(flags)
    .filter((topic) => flags[topic])
    .sort()
    .join(', ');
}

function splitTopics(value: string): string[] {
  return value
    .split(',')
    .map((topic) => topic.trim())
    .filter(Boolean);
}

function splitRules(value: string): string[] {
  return value
    .split('\n')
    .map((rule) => rule.trim())
    .filter(Boolean);
}
