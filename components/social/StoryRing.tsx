'use client';

// The profile picture, wrapped in a ring when there are stories to watch.
//
// Fetches on mount rather than being server-rendered, and that is not a
// preference. The profile page is edge-cached for five minutes and the same
// HTML is served to every visitor, so anything viewer-specific baked in at
// render time -- the `seen` state, the owner's add button -- would be the
// first visitor's state handed to everyone after them. See the note in
// profile-viewer.tsx.

import { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { StoryViewer } from './StoryViewer';
import { StoryComposer } from './StoryComposer';
import type { StoryTray } from '@/lib/federation/wrappers/stories';

interface StoryRingProps {
  /** The pana's screenname, without the @. */
  username: string;
  /** The avatar to wrap. Rendered by the caller so each hero keeps its own. */
  children: React.ReactNode;
  /** Ring thickness scales with the avatar it surrounds. */
  size?: 'sm' | 'lg';
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
  className = '',
}: StoryRingProps) {
  const [tray, setTray] = useState<StoryTray | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/social/actors/${encodeURIComponent(username)}/stories`
      );
      if (!res.ok) {
        setTray(null);
        return;
      }
      const json = await res.json();
      setTray(json.success ? json.data : null);
    } catch {
      // A pana with no social actor 404s here, which is the common case on a
      // business profile. Nothing to show and nothing to report.
      setTray(null);
    } finally {
      setLoading(false);
    }
  }, [username]);

  useEffect(() => {
    void load();
  }, [load]);

  const stories = tray?.stories ?? [];
  const hasStories = stories.length > 0;
  const hasUnseen = tray?.hasUnseen ?? false;
  // Reported by the API rather than passed in: the business hero has
  // useProfileViewer() and the personal hero is server-rendered with no viewer
  // context at all, so deriving it from the session is the only answer both
  // can use.
  const isOwner = tray?.isOwner ?? false;

  // Open on the first story they have not watched. Picking up mid-sequence is
  // the behaviour people expect from the pattern, and re-watching from the
  // start is one tap back away.
  const firstUnseen = stories.findIndex((s) => !s.seen);
  const startIndex = firstUnseen === -1 ? 0 : firstUnseen;

  const ringWidth = size === 'lg' ? 'p-[3px]' : 'p-[2px]';

  const ringClass = hasStories
    ? hasUnseen
      ? 'bg-gradient-to-tr from-[var(--color-pana-flame)] via-[var(--color-pana-butter)] to-[var(--color-pana-indigo)]'
      : // Watched: still ringed, so you can tell stories exist, but muted so
        // it stops asking for attention.
        'bg-[var(--color-pana-indigo)]/25'
    : '';

  return (
    <>
      <div className={`relative inline-block ${className}`}>
        {hasStories ? (
          <button
            type="button"
            onClick={() => setViewerOpen(true)}
            className={`block rounded-full ${ringWidth} ${ringClass} transition-transform hover:scale-[1.02]`}
            aria-label={`Watch ${stories.length} ${
              stories.length === 1 ? 'story' : 'stories'
            } from ${username}`}
          >
            <span className="bg-background block rounded-full p-[2px]">
              {children}
            </span>
          </button>
        ) : (
          children
        )}

        {isOwner && !loading && (
          <button
            type="button"
            onClick={() => setComposerOpen(true)}
            className="bg-[var(--color-pana-indigo)] absolute right-0 bottom-0 rounded-full p-1.5 text-white shadow-md ring-2 ring-white transition-transform hover:scale-110"
            aria-label="Post a story"
          >
            <Plus className="h-4 w-4" />
          </button>
        )}
      </div>

      {viewerOpen && tray && hasStories && (
        <StoryViewer
          tray={{ ...tray, stories }}
          startIndex={startIndex}
          isOwner={isOwner}
          onClose={() => {
            setViewerOpen(false);
            // Refetch so the ring reflects what was just watched, and drops
            // anything that expired while the viewer was open.
            void load();
          }}
          onDeleted={() => void load()}
        />
      )}

      {composerOpen && (
        <StoryComposer
          onClose={() => setComposerOpen(false)}
          onPosted={() => {
            setComposerOpen(false);
            void load();
          }}
        />
      )}
    </>
  );
}
