/**
 * MultiMediaUpload
 *
 * Parallel to MediaUpload, but for multiple attachments of mixed kinds
 * (image + audio + video) — the shape the social composer needs. Extracts the
 * upload logic that used to live inline in PostComposer:
 *   - audio → transcode to Opus, video → transcode to WebM (both in-browser),
 *     then PUT directly to R2 via a presigned URL from `presignEndpoint`.
 *   - images → multipart POST to `imageUploadEndpoint`.
 *
 * Controlled: the caller owns the attachments array and passes the namespaced
 * endpoints + R2 key prefix, so this stays module-agnostic.
 */

'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { ImagePlus, X, Volume2, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { transcodeToOpus, transcodeToWebMVideo } from '@/lib/media/transcode';

const isSafari = () =>
  typeof navigator !== 'undefined' &&
  /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

const DEFAULT_ACCEPT =
  'image/jpeg,image/png,image/webp,image/gif,audio/*,video/*';

export interface UploadedMedia {
  type: string; // 'image' | 'audio' | 'video'
  mediaType: string;
  url: string;
  name: string;
}

interface MultiMediaUploadProps {
  value: UploadedMedia[];
  onChange: (next: UploadedMedia[]) => void;
  /** Max number of attachments. Default 4. */
  maxItems?: number;
  /** file input `accept` attribute. */
  accept?: string;
  /** Multipart image upload endpoint returning { success, data: UploadedMedia }. */
  imageUploadEndpoint: string;
  /** Presigned-URL endpoint (POST { filename, contentType, size }) for audio/video. */
  presignEndpoint: string;
  /** R2 key prefix, e.g. "social/media". */
  pathPrefix: string;
  disabled?: boolean;
}

export default function MultiMediaUpload({
  value,
  onChange,
  maxItems = 4,
  accept = DEFAULT_ACCEPT,
  imageUploadEndpoint,
  presignEndpoint,
  pathPrefix,
  disabled,
}: MultiMediaUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [videoProgress, setVideoProgress] = useState<number | null>(null);
  const [safariNotice, setSafariNotice] = useState(false);
  const { toast } = useToast();
  const { t } = useTranslation('toast');

  // Transcoded audio/video: get a presigned URL, then PUT the blob to R2.
  const presignPut = async (
    blob: Blob,
    contentType: string,
    ext: string
  ): Promise<string> => {
    const filename = `${pathPrefix}/${crypto.randomUUID()}.${ext}`;
    const { presignedUrl, publicUrl } = await fetch(presignEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename, contentType, size: blob.size }),
    }).then(async (r) => {
      if (!r.ok) {
        throw new Error((await r.json()).error ?? 'Upload token failed');
      }
      return r.json() as Promise<{ presignedUrl: string; publicUrl: string }>;
    });
    // fetch resolves on HTTP errors too — a failed R2 PUT must throw so it
    // reaches the catch/toast instead of attaching a URL to an object that was
    // never stored.
    const put = await fetch(presignedUrl, {
      method: 'PUT',
      body: blob,
      headers: { 'Content-Type': contentType },
    });
    if (!put.ok) throw new Error(`Upload failed (${put.status})`);
    return publicUrl;
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;

    const available = maxItems - value.length;
    if (available <= 0) return;
    const filesToUpload = Array.from(files).slice(0, available);

    // Warn Safari users that audio/video playback won't work on their device.
    const hasMedia = filesToUpload.some(
      (f) => f.type.startsWith('audio/') || f.type.startsWith('video/')
    );
    if (hasMedia && isSafari()) setSafariNotice(true);

    setUploading(true);
    const added: UploadedMedia[] = [];
    for (const file of filesToUpload) {
      try {
        if (file.type.startsWith('audio/')) {
          const ogg = await transcodeToOpus(file);
          const url = await presignPut(ogg, 'audio/ogg', 'ogg');
          added.push({
            type: 'audio',
            mediaType: 'audio/ogg',
            url,
            name: file.name,
          });
        } else if (file.type.startsWith('video/')) {
          setVideoProgress(0);
          const webm = await transcodeToWebMVideo(file, (ratio) =>
            setVideoProgress(Math.round(ratio * 100))
          );
          setVideoProgress(null);
          const url = await presignPut(webm, 'video/webm', 'webm');
          added.push({
            type: 'video',
            mediaType: 'video/webm',
            url,
            name: file.name,
          });
        } else {
          const formData = new FormData();
          formData.append('file', file);
          const res = await axios.post(imageUploadEndpoint, formData);
          if (res.data?.success) added.push(res.data.data as UploadedMedia);
        }
      } catch (error) {
        setVideoProgress(null);
        const message =
          axios.isAxiosError(error) && error.response?.data?.error
            ? error.response.data.error
            : 'Upload failed. Please try again.';
        toast({
          title: t('uploadFailed'),
          description: message,
          variant: 'destructive',
        });
      }
    }

    if (added.length) onChange([...value, ...added]);
    setUploading(false);
    // Reset the input so the same file can be selected again.
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAt = (index: number) =>
    onChange(value.filter((_, i) => i !== index));

  return (
    <div className="space-y-2">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={accept}
        className="hidden"
        onChange={handleFileSelect}
      />

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled || value.length >= maxItems || uploading}
      >
        {uploading ? (
          <Loader2 className="mr-1 h-4 w-4 animate-spin" />
        ) : (
          <ImagePlus className="mr-1 h-4 w-4" />
        )}
        {videoProgress !== null
          ? `Transcoding… ${videoProgress}%`
          : uploading
            ? 'Uploading…'
            : value.length > 0
              ? `${value.length}/${maxItems}`
              : 'Media'}
      </Button>

      {safariNotice && (
        <p className="text-muted-foreground rounded-md border px-3 py-2 text-sm">
          {`Audio/video playback requires Chrome or Firefox \u{1F49B} — your upload will succeed but won't play on this device.`}
        </p>
      )}

      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((att, i) => (
            <div key={i} className="group relative">
              {att.type === 'image' ? (
                <Image
                  src={att.url}
                  alt={att.name || ''}
                  width={80}
                  height={80}
                  className="h-20 w-20 rounded-md border object-cover"
                  unoptimized
                />
              ) : (
                <div className="bg-muted flex h-20 w-20 items-center justify-center rounded-md border">
                  <Volume2 className="text-muted-foreground h-6 w-6" />
                </div>
              )}
              <button
                type="button"
                onClick={() => removeAt(i)}
                className="bg-destructive text-destructive-foreground absolute -top-1.5 -right-1.5 rounded-full p-0.5 opacity-0 transition-opacity group-hover:opacity-100"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
