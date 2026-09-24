'use client';

import { useRef, useState } from 'react';
import axios from 'axios';
import { ImagePlus, Loader2, Pencil } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const ACCEPTED = 'image/png, image/jpeg, image/webp';

/* The accept attribute above is a filter on the file picker, not a rule -- a
   member can switch it to "All files" and choose a HEIC straight off an
   iPhone. Checking here means they are told which file was the problem
   instead of watching a save appear to succeed. */
const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

/* Large enough for anything off a phone camera, small enough that a member
   finds out here rather than after waiting on a doomed upload. */
const MAX_BYTES = 8 * 1024 * 1024;

/* The profile picture, changed in place.
 *
 * This replaces a link to /account/profile/images, which is the old design
 * system and asks for four images at once behind a Save button. Changing the
 * one picture that represents you everywhere should not mean leaving the page
 * you are setting up, so the overlay asks for exactly that one and nothing
 * else.
 *
 * The field name below is `primary`, not `images_primary`. /api/profile/upload
 * only accepts `primary`, `gallery1`, `gallery2`, `gallery3`, and silently
 * skips every other field -- then returns `{ success: true }` regardless,
 * because success is measured by the update statement running rather than by
 * any file being in it. The old page posted `images_primary`, so it matched
 * nothing, saved nothing, and still reported that it had worked. Both halves
 * of that are handled here: the right field name, and a response check that
 * believes `success` rather than the HTTP status. */
export function AvatarEditor({
  name,
  avatarUrl,
  onUploaded,
}: {
  name: string;
  avatarUrl: string | null;
  onUploaded: () => Promise<unknown> | void;
}) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  /* Falls back to the handle's first character, then to a neutral glyph, so
     the bubble is never blank for someone who has set neither. */
  const initial = name.trim().charAt(0).toUpperCase();

  function clearChoice() {
    setPreview((url) => {
      if (url) URL.revokeObjectURL(url);
      return null;
    });
    setFile(null);
    setError('');
  }

  function choose(next: File | undefined) {
    if (!next) return;

    if (!ACCEPTED_TYPES.includes(next.type)) {
      setError(
        `${next.type || 'That file type'} will not work. Use a JPG, PNG, or WebP.`
      );
      return;
    }

    if (next.size > MAX_BYTES) {
      setError('That image is over 8MB. Try a smaller one.');
      return;
    }

    clearChoice();
    setFile(next);
    setPreview(URL.createObjectURL(next));
  }

  async function save() {
    if (!file) return;

    setUploading(true);
    setError('');

    try {
      const body = new FormData();
      body.append('primary', file);

      const { data } = await axios.post('/api/profile/upload', body, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      // A 200 here does not mean the picture was stored -- see above.
      if (!data?.success) {
        setError(data?.error || 'That did not save. Please try again.');
        return;
      }

      await onUploaded();
      clearChoice();
      setOpen(false);
    } catch (err) {
      /* The endpoint answers some failures with a non-2xx, which axios throws
         on, so its explanation is in the response body rather than in hand.
         Passing it through is the difference between a member knowing their
         file was the wrong format and being told to try again forever. */
      const fromServer =
        axios.isAxiosError(err) && typeof err.response?.data?.error === 'string'
          ? err.response.data.error
          : '';
      setError(fromServer || 'That did not save. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="avatar-edit"
        onClick={() => setOpen(true)}
        aria-label={
          avatarUrl ? 'Change your profile picture' : 'Add a profile picture'
        }
      >
        <span className="avatar-edit-bubble">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" />
          ) : (
            initial || <ImagePlus className="h-5 w-5" aria-hidden="true" />
          )}
        </span>
        <span className="avatar-edit-badge">
          <Pencil className="h-3 w-3" aria-hidden="true" />
        </span>
      </button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) clearChoice();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Your profile picture</DialogTitle>
            <DialogDescription>
              This one image is your avatar everywhere — beside everything you
              post, on your listing in directory search, and on other fediverse
              servers.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center gap-4 py-2">
            <span
              className="avatar-dialog-preview"
              data-empty={!preview && !avatarUrl ? 'true' : 'false'}
            >
              {preview || avatarUrl ? (
                <img src={preview ?? avatarUrl ?? ''} alt="" />
              ) : (
                <ImagePlus className="h-8 w-8" aria-hidden="true" />
              )}
            </span>

            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED}
              className="hidden"
              onChange={(e) => choose(e.target.files?.[0])}
            />

            <button
              type="button"
              className="settings-btn"
              data-variant="quiet"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
            >
              {file ? 'Choose a different image' : 'Choose an image'}
            </button>

            <p className="settings-note text-center">
              {file ? file.name : 'JPG, PNG, or WebP, up to 8MB.'}
            </p>

            {error && (
              <p className="text-pana-red text-center text-[13px] font-bold">
                {error}
              </p>
            )}
          </div>

          <DialogFooter>
            <button
              type="button"
              className="settings-btn"
              data-variant="quiet"
              onClick={() => setOpen(false)}
              disabled={uploading}
            >
              Cancel
            </button>
            <button
              type="button"
              className="settings-btn"
              onClick={save}
              disabled={!file || uploading}
            >
              {uploading && (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              )}
              {uploading ? 'Saving…' : 'Save picture'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
