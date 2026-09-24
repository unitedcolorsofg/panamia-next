'use client';

import { useRef, useState } from 'react';
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
const MAX_BYTES = 8 * 1024 * 1024;

/* Mock mirror of the live AvatarEditor in
 * app/account/user/edit/_components/avatar-editor.tsx.
 *
 * Same markup and same states; the only difference is that saving here sets
 * local state instead of posting to /api/profile/upload, so the overlay can be
 * reviewed without a session. Kept deliberately in sync -- the point of the
 * mock is to be the design reference, and a reference that has drifted is
 * worse than none. */
export function AvatarEditor({
  name,
  avatarUrl,
  onSave,
}: {
  name: string;
  avatarUrl: string | null;
  onSave: (url: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const initial = name.trim().charAt(0).toUpperCase();

  function clearChoice() {
    setFile(null);
    setError('');
    setPreview(null);
  }

  function choose(next: File | undefined) {
    if (!next) return;

    if (next.size > MAX_BYTES) {
      setError('That image is over 8MB. Try a smaller one.');
      return;
    }

    setError('');
    setFile(next);
    setPreview(URL.createObjectURL(next));
  }

  /* The pause is the same one the rest of the mock uses: an instant save that
     never shows its saving state is indistinguishable from a button that does
     nothing. */
  function save() {
    if (!preview) return;
    setUploading(true);
    setTimeout(() => {
      onSave(preview);
      setUploading(false);
      setFile(null);
      setPreview(null);
      setOpen(false);
    }, 550);
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
              disabled={!preview || uploading}
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
