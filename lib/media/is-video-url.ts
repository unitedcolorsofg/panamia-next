/**
 * Best-effort check of whether a media URL points at a video, by file
 * extension. Article covers store a single URL (coverImage) with no explicit
 * media-type column, and our own uploads always produce a known extension
 * (.webm for transcoded video), so extension inference is reliable for them.
 */
const VIDEO_EXTENSION = /\.(webm|mp4|m4v|mov|ogv)(?:[?#]|$)/i;

export function isVideoUrl(url?: string | null): boolean {
  return !!url && VIDEO_EXTENSION.test(url);
}
