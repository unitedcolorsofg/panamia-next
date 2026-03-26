/**
 * POST /webhooks/ghl — inbound GHL contact/pipeline events
 *
 * Verifies HMAC-SHA256 signature, then handles:
 *   contact.delete      → set ghlOptedOut=true, clear ghlContactId on profile
 *   contact.dnd_update  → set ghlOptedOut=true on profile (user opted out in GHL)
 *
 * NOTE: Verify the actual signature header name against GHL documentation
 * before deploying. GHL uses x-wm-hmac-sha256 in some versions. The secret
 * to configure is GHL_WEBHOOK_SECRET.
 *
 * Phase 5 — implemented.
 */

import { eq } from 'drizzle-orm';
import { Env, createDb } from '../lib/db';
import { profiles } from '../lib/schema';

// GHL sends the HMAC-SHA256 signature in this header.
// Verify against your GHL dashboard webhook configuration.
const SIG_HEADER = 'x-wm-hmac-sha256';

export async function handleGhlWebhook(
  request: Request,
  env: Env
): Promise<Response> {
  const signature = request.headers.get(SIG_HEADER);
  if (!signature) {
    console.warn('[webhook-ghl] missing signature header');
    return new Response('Missing signature', { status: 401 });
  }

  const body = await request.text();

  const valid = await verifyHmac(body, signature, env.GHL_WEBHOOK_SECRET);
  if (!valid) {
    console.warn('[webhook-ghl] invalid signature');
    return new Response('Invalid signature', { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(body);
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const eventType = payload['type'] as string | undefined;
  const contactId = payload['contactId'] as string | undefined;

  if (!contactId) {
    return new Response('Missing contactId', { status: 400 });
  }

  const db = createDb(env);

  switch (eventType) {
    case 'contact.delete': {
      // Contact was deleted in GHL (e.g., manually by a sales rep).
      // Clear the link and set ghlOptedOut to prevent the worker from recreating it.
      await db
        .update(profiles)
        .set({ ghlOptedOut: true, ghlContactId: null })
        .where(eq(profiles.ghlContactId, contactId));
      console.log(
        `[webhook-ghl] contact.delete — cleared ghlContactId ${contactId}`
      );
      break;
    }

    case 'contact.dnd_update': {
      // User opted out of marketing in GHL (e.g., unsubscribed via email link).
      // Set ghlOptedOut so the worker stops pushing updates to this contact.
      const dndStatus = payload['dnd'] as boolean | undefined;
      if (dndStatus === true) {
        await db
          .update(profiles)
          .set({ ghlOptedOut: true })
          .where(eq(profiles.ghlContactId, contactId));
        console.log(
          `[webhook-ghl] contact.dnd_update — set ghlOptedOut for ${contactId}`
        );
      }
      break;
    }

    default:
      console.log(`[webhook-ghl] unhandled event type: ${eventType}`);
  }

  return new Response('ok', { status: 200 });
}

async function verifyHmac(
  body: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );
  const sigBytes = hexToBytes(signature);
  return crypto.subtle.verify('HMAC', key, sigBytes, encoder.encode(body));
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}
