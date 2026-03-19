/**
 * Cloudflare Stream Integration
 *
 * Manages live input creation for event livestreaming.
 * Only admins can call these functions (enforced at API route level).
 */

export interface LiveInputResult {
  uid: string;
  srtUrl: string;
  srtStreamKey: string;
  playbackId: string;
}

/**
 * Create a Cloudflare Stream live input for an event.
 * Returns the SRT URL, stream key, and playback ID to store on the event.
 */
export async function createLiveInput(
  eventSlug: string
): Promise<LiveInputResult> {
  const accountId = process.env.CF_ACCOUNT_ID;
  const apiToken = process.env.CF_STREAM_API_TOKEN;

  if (!accountId || !apiToken) {
    throw new Error('CF_ACCOUNT_ID and CF_STREAM_API_TOKEN must be set');
  }

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/live_inputs`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        meta: { name: `panamia-event-${eventSlug}` },
        recording: {
          mode: 'automatic',
          requireSignedURLs: false,
        },
      }),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Cloudflare Stream API error: ${response.status} ${text}`);
  }

  const data = (await response.json()) as {
    result: {
      uid: string;
      srt: { url: string; streamKey: string };
      playback: { hls: string; dash: string };
    };
  };

  const { uid, srt, playback } = data.result;

  // Extract playback ID from HLS URL
  // Format: https://customer-xxx.cloudflarestream.com/{playbackId}/manifest/video.m3u8
  const playbackIdMatch = playback.hls.match(
    /cloudflarestream\.com\/([^/]+)\//
  );
  const playbackId = playbackIdMatch ? playbackIdMatch[1] : uid;

  return {
    uid,
    srtUrl: srt.url,
    srtStreamKey: srt.streamKey,
    playbackId,
  };
}

/**
 * Get the embed URL for a Cloudflare Stream playback ID.
 */
export function getEmbedUrl(playbackId: string): string {
  const customerCode = process.env.CF_STREAM_CUSTOMER_CODE;
  if (!customerCode) throw new Error('CF_STREAM_CUSTOMER_CODE must be set');
  return `https://customer-${customerCode}.cloudflarestream.com/${playbackId}/iframe`;
}

/**
 * Verify a Cloudflare Stream webhook signature.
 */
export function verifyWebhookSignature(
  signature: string | null,
  secret: string
): boolean {
  if (!signature) return false;
  return signature === secret;
}
