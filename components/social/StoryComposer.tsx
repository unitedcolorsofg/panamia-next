'use client';

// Post a story: pick one photo or video, optionally caption it, done.
//
// Reuses MultiMediaUpload with maxItems=1 rather than growing a second upload
// path. That component already handles the two R2 routes (multipart for
// images, presigned PUT for video), the size caps, and the accept list, and
// all of that is the same here. Capping it at one is the only difference,
// and it is the difference that makes the viewer's one-tap-one-story contract
// enforceable rather than aspirational.

import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import MultiMediaUpload, {
  type UploadedMedia,
} from '@/components/MultiMediaUpload';

const MAX_CAPTION_LENGTH = 280;

interface StoryComposerProps {
  onClose: () => void;
  onPosted: () => void;
}

export function StoryComposer({ onClose, onPosted }: StoryComposerProps) {
  const [media, setMedia] = useState<UploadedMedia[]>([]);
  const [caption, setCaption] = useState('');
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = media[0];
  const overLimit = caption.length > MAX_CAPTION_LENGTH;
  const canPost = !!selected && !overLimit && !posting;

  const handlePost = async () => {
    if (!canPost) return;
    setPosting(true);
    setError(null);

    try {
      const res = await fetch('/api/social/stories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          media: {
            type: selected.type,
            mediaType: selected.mediaType,
            url: selected.url,
            name: selected.name,
          },
          caption: caption.trim() || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error || 'Could not post your story');
        setPosting(false);
        return;
      }

      onPosted();
    } catch {
      setError('Could not post your story');
      setPosting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Post a story"
    >
      <div className="bg-background w-full max-w-md rounded-2xl p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Post a story</h2>
          <button
            type="button"
            onClick={onClose}
            className="hover:bg-muted rounded-full p-1.5"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="text-muted-foreground mb-4 text-sm">
          Your story stays up for 24 hours, then disappears on its own.
        </p>

        <MultiMediaUpload
          value={media}
          onChange={setMedia}
          maxItems={1}
          imageUploadEndpoint="/api/social/media"
          presignEndpoint="/api/social/media/upload"
          pathPrefix="social/stories"
          disabled={posting}
        />

        <div className="mt-4">
          <label htmlFor="story-caption" className="sr-only">
            Caption
          </label>
          <textarea
            id="story-caption"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Say something about it (optional)"
            rows={2}
            disabled={posting}
            className="border-input bg-background w-full resize-none rounded-lg border p-2 text-sm"
          />
          <div className="mt-1 flex justify-end">
            <span
              className={`text-xs ${
                overLimit ? 'text-destructive' : 'text-muted-foreground'
              }`}
            >
              {caption.length}/{MAX_CAPTION_LENGTH}
            </span>
          </div>
        </div>

        {error && <p className="text-destructive mt-2 text-sm">{error}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={posting}
            className="hover:bg-muted rounded-lg px-4 py-2 text-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handlePost}
            disabled={!canPost}
            className="bg-[var(--color-pana-indigo)] flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {posting && <Loader2 className="h-4 w-4 animate-spin" />}
            Post story
          </button>
        </div>
      </div>
    </div>
  );
}
