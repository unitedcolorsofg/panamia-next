/**
 * MediaUpload
 *
 * Reusable single-media (photo or video) uploader, modeled after the "Media"
 * upload in the social composer (components/social/PostComposer.tsx): video is
 * transcoded to WebM in the browser, then everything is PUT directly to R2 via
 * a presigned URL from `uploadEndpoint`. Emits the public URL through onChange.
 *
 * The caller owns the value (a single URL) and picks the namespaced endpoint
 * + key prefix, so this component stays module-agnostic (articles today, other
 * modules later).
 */

'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ImagePlus, X, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { transcodeToWebMVideo } from '@/lib/media/transcode';
import { isVideoUrl } from '@/lib/media/is-video-url';
import { cn } from '@/lib/utils';

const isSafari = () =>
  typeof navigator !== 'undefined' &&
  /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

const IMAGE_TYPES = 'image/jpeg,image/png,image/webp,image/gif';
const VIDEO_TYPES = 'video/*';

const EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'video/webm': 'webm',
};

interface MediaUploadProps {
  value?: string | null;
  onChange: (url: string | null) => void;
  /** Which kinds of media the picker accepts. Default: both. */
  accept?: 'image' | 'video' | 'both';
  /** Presigned-URL endpoint (POST { filename, contentType, size }). */
  uploadEndpoint: string;
  /** R2 key prefix, e.g. "articles/media". */
  pathPrefix: string;
  className?: string;
}

export default function MediaUpload({
  value,
  onChange,
  accept = 'both',
  uploadEndpoint,
  pathPrefix,
  className,
}: MediaUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [videoProgress, setVideoProgress] = useState<number | null>(null);
  const [safariNotice, setSafariNotice] = useState(false);
  const { toast } = useToast();

  const acceptAttr =
    accept === 'image'
      ? IMAGE_TYPES
      : accept === 'video'
        ? VIDEO_TYPES
        : `${IMAGE_TYPES},${VIDEO_TYPES}`;

  const uploadToR2 = async (
    blob: Blob,
    contentType: string,
    ext: string
  ): Promise<string> => {
    const filename = `${pathPrefix}/${crypto.randomUUID()}.${ext}`;
    const { presignedUrl, publicUrl } = await fetch(uploadEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename, contentType, size: blob.size }),
    }).then(async (r) => {
      if (!r.ok) {
        throw new Error((await r.json()).error ?? 'Upload token failed');
      }
      return r.json() as Promise<{ presignedUrl: string; publicUrl: string }>;
    });

    const put = await fetch(presignedUrl, {
      method: 'PUT',
      body: blob,
      headers: { 'Content-Type': contentType },
    });
    // fetch resolves on HTTP errors too — a failed R2 PUT (e.g. 403 signature
    // mismatch) must throw so it reaches the catch/toast instead of attaching a
    // URL to an object that was never stored.
    if (!put.ok) {
      throw new Error(`Upload failed (${put.status})`);
    }
    return publicUrl;
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (inputRef.current) inputRef.current.value = ''; // allow re-selecting same file
    if (!file) return;

    setUploading(true);
    try {
      let url: string;
      if (file.type.startsWith('video/')) {
        if (isSafari()) setSafariNotice(true);
        setVideoProgress(0);
        const webm = await transcodeToWebMVideo(file, (ratio) =>
          setVideoProgress(Math.round(ratio * 100))
        );
        setVideoProgress(null);
        url = await uploadToR2(webm, 'video/webm', 'webm');
      } else if (file.type.startsWith('image/')) {
        const ext = EXT_BY_TYPE[file.type];
        if (!ext) throw new Error(`Unsupported image type: ${file.type}`);
        url = await uploadToR2(file, file.type, ext);
      } else {
        throw new Error('Please choose an image or video file.');
      }
      onChange(url);
    } catch (error) {
      setVideoProgress(null);
      toast({
        title: 'Upload failed',
        description:
          error instanceof Error
            ? error.message
            : 'Upload failed. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const label =
    accept === 'image'
      ? 'Upload photo'
      : accept === 'video'
        ? 'Upload video'
        : 'Upload photo or video';

  return (
    <div className={cn('space-y-2', className)}>
      <input
        ref={inputRef}
        type="file"
        accept={acceptAttr}
        className="hidden"
        onChange={handleFileSelect}
      />

      {value ? (
        <div className="group relative w-full max-w-sm overflow-hidden rounded-md border">
          {isVideoUrl(value) ? (
            // No autoplay — playback is user-initiated via the controls.
            <video
              src={value}
              controls
              preload="metadata"
              className="max-h-64 w-full bg-black object-contain"
            />
          ) : (
            <img
              src={value}
              alt="Cover preview"
              className="max-h-64 w-full object-cover"
            />
          )}
          <button
            type="button"
            onClick={() => onChange(null)}
            className="bg-destructive text-destructive-foreground absolute top-2 right-2 rounded-full p-1 opacity-0 transition-opacity group-hover:opacity-100"
            aria-label="Remove cover"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <ImagePlus className="mr-2 h-4 w-4" />
          )}
          {videoProgress !== null
            ? `Transcoding… ${videoProgress}%`
            : uploading
              ? 'Uploading…'
              : label}
        </Button>
      )}

      {safariNotice && (
        <p className="text-muted-foreground text-xs">
          {`Video playback requires Chrome or Firefox — your upload will succeed but the preview won't play on this device.`}
        </p>
      )}
    </div>
  );
}
