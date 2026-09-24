'use client';

// The profile picture, wrapped in a ring when there are stories to watch.
//
// Two fetches, deliberately split. On mount it asks only whether to draw a
// ring and in what colour, through a batched queue shared with every other
// ring on the page (see lib/social/story-summary-client.ts) -- that is what
// makes a ring affordable on a feed row or a list item rather than only on a
// profile. The stories themselves, with their media, are fetched when someone
// actually taps, because most rings are never tapped.
//
// Neither fetch is server-rendered, and that is not a preference. The profile
// page is edge-cached for five minutes and the same HTML is served to every
// visitor, so anything viewer-specific baked in at render time -- the `seen`
// state, the owner's add button -- would be the first visitor's state handed
// to everyone after them. See the note in profile-viewer.tsx.

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { StoryViewer } from './StoryViewer';
import { StoryComposer } from './StoryComposer';
import {
  getStorySummary,
  invalidateStorySummary,
} from '@/lib/social/story-summary-client';
import type {
  StorySummary,
  StoryTray,
} from '@/lib/federation/wrappers/stories';

interface StoryRingProps {
  /** The pana's screenname, without the @. */
  username: string;
  /** The avatar to wrap. Rendered by the caller so each hero keeps its own. */
  children: React.ReactNode;
  /** Ring thickness scales with the avatar it surrounds. */
  size?: 'sm' | 'lg';
  /**
   * Where the avatar goes when there are no stories.
   *
   * Lists and feeds already make the avatar a link to the profile, and that
   * has to keep working -- but an anchor cannot contain the button the ring
   * needs, so the caller cannot simply wrap its own link. Handing the
   * destination over lets this render whichever single element is valid:
   * a button when there are stories, a link when there are not.
   *
   * Omitted on profile heroes, where the avatar is already home.
   */
  href?: string;
  /**
   * Applied to the outer wrapper. Heroes position their avatar with layout
   * rules that live on the avatar itself -- the personal hero pulls it up over
   * the banner with a negative margin -- and wrapping it moves that rule
   * inside the wrapper, where it collapses the ring instead of offsetting the
   * avatar. The caller hands the layout to the wrapper and neutralises it on
   * the child.
   */
  className?: string;
}

export function StoryRing({
  username,
  children,
  size = 'lg',
  href,
  className = '',
}: StoryRingProps) {
  const [summary, setSummary] = useState<StorySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [tray, setTray] = useState<StoryTray | null>(null);
  const [opening, setOpening] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);

  const loadSummary = useCallback(async () => {
    const next = await getStorySummary(username);
    setSummary(next);
    setLoading(false);
  }, [username]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  const refresh = useCallback(() => {
    invalidateStorySummary(username);
    void loadSummary();
  }, [username, loadSummary]);

  const hasStories = summary?.hasStories ?? false;
  const hasUnseen = summary?.hasUnseen ?? false;
  // Reported by the API rather than passed in: the business hero has
  // useProfileViewer() and the personal hero is server-rendered with no viewer
  // context at all, so deriving it from the session is the only answer both
  // can use.
  const isOwner = summary?.isOwner ?? false;

  const openViewer = useCallback(async () => {
    if (opening) return;
    setOpening(true);
    try {
      const res = await fetch(
        `/api/social/actors/${encodeURIComponent(username)}/stories`
      );
      if (!res.ok) {
        refresh();
        return;
      }
      const json = await res.json();
      const next: StoryTray | null = json.success ? json.data : null;
      if (!next || next.stories.length === 0) {
        // Everything expired between the summary and the tap. Drop the ring
        // rather than opening an empty viewer.
        refresh();
        return;
      }
      setTray(next);
      setViewerOpen(true);
    } catch {
      refresh();
    } finally {
      setOpening(false);
    }
  }, [username, opening, refresh]);

  // Open on the first story they have not watched. Picking up mid-sequence is
  // the behaviour people expect from the pattern, and re-watching from the
  // start is one tap back away.
  const stories = tray?.stories ?? [];
  const firstUnseen = stories.findIndex((s) => !s.seen);
  const startIndex = firstUnseen === -1 ? 0 : firstUnseen;

  const ringWidth = size === 'lg' ? 'p-[3px]' : 'p-[2px]';
  const innerGap = size === 'lg' ? 'p-[2px]' : 'p-[1.5px]';

  const ringClass = hasUnseen
    ? 'bg-gradient-to-tr from-[var(--color-pana-flame)] via-[var(--color-pana-butter)] to-[var(--color-pana-indigo)]'
    : // Watched: still ringed, so you can tell stories exist, but muted so
      // it stops asking for attention.
      'bg-[var(--color-pana-indigo)]/25';

  let avatar: React.ReactNode;
  if (hasStories) {
    avatar = (
      <button
        type="button"
        onClick={() => void openViewer()}
        className={`block rounded-full ${ringWidth} ${ringClass} transition-transform hover:scale-[1.02] ${
          opening ? 'animate-pulse' : ''
        }`}
        aria-busy={opening}
        aria-label={`Watch stories from ${username}`}
      >
        <span className={`bg-background block rounded-full ${innerGap}`}>
          {children}
        </span>
      </button>
    );
  } else if (href) {
    avatar = <Link href={href}>{children}</Link>;
  } else {
    avatar = children;
  }

  return (
    <>
      <div className={`relative inline-block ${className}`}>
        {avatar}

        {isOwner && !loading && (
          <button
            type="button"
            onClick={() => setComposerOpen(true)}
            className="absolute right-0 bottom-0 rounded-full bg-[var(--color-pana-indigo)] p-1.5 text-white shadow-md ring-2 ring-white transition-transform hover:scale-110"
            aria-label="Post a story"
          >
            <Plus className="h-4 w-4" />
          </button>
        )}
      </div>

      {viewerOpen && tray && stories.length > 0 && (
        <StoryViewer
          tray={tray}
          startIndex={startIndex}
          isOwner={isOwner}
          onClose={() => {
            setViewerOpen(false);
            setTray(null);
            // Refresh so the ring reflects what was just watched, and drops
            // anything that expired while the viewer was open.
            refresh();
          }}
          onDeleted={refresh}
        />
      )}

      {composerOpen && (
        <StoryComposer
          onClose={() => setComposerOpen(false)}
          onPosted={() => {
            setComposerOpen(false);
            refresh();
          }}
        />
      )}
    </>
  );
}
