'use client';

import Image from 'next/image';
import { Volume2 } from 'lucide-react';

export interface AttachmentDisplay {
  id: string;
  type: string;
  mediaType?: string | null;
  url: string;
  name?: string | null;
  width?: number | null;
  height?: number | null;
}

interface AttachmentGridProps {
  attachments: AttachmentDisplay[];
}

function AudioPlayer({ attachment }: { attachment: AttachmentDisplay }) {
  return (
    <div className="bg-muted flex items-center gap-3 rounded-lg border p-3">
      <Volume2 className="text-muted-foreground h-5 w-5 shrink-0" />
      <audio controls className="h-8 w-full" preload="metadata">
        <source
          src={attachment.url}
          type={attachment.mediaType || 'audio/webm'}
        />
      </audio>
    </div>
  );
}

function ImageItem({ attachment }: { attachment: AttachmentDisplay }) {
  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noopener noreferrer"
      className="relative block overflow-hidden rounded-lg border"
    >
      <Image
        src={attachment.url}
        alt={attachment.name || ''}
        width={attachment.width || 600}
        height={attachment.height || 400}
        className="h-auto max-h-80 w-full object-cover"
        unoptimized
      />
    </a>
  );
}

export function AttachmentGrid({ attachments }: AttachmentGridProps) {
  if (!attachments.length) return null;

  const images = attachments.filter((a) => a.type === 'image');
  const audio = attachments.filter((a) => a.type === 'audio');

  return (
    <div className="mt-3 space-y-2">
      {/* Image grid */}
      {images.length === 1 && <ImageItem attachment={images[0]} />}
      {images.length === 2 && (
        <div className="grid grid-cols-2 gap-1">
          {images.map((a) => (
            <ImageItem key={a.id} attachment={a} />
          ))}
        </div>
      )}
      {images.length >= 3 && (
        <div className="grid grid-cols-2 gap-1">
          {images.slice(0, 4).map((a) => (
            <ImageItem key={a.id} attachment={a} />
          ))}
        </div>
      )}

      {/* Audio players */}
      {audio.map((a) => (
        <AudioPlayer key={a.id} attachment={a} />
      ))}
    </div>
  );
}
