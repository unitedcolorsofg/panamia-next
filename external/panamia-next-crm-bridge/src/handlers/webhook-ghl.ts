/**
 * POST /webhooks/ghl — inbound GHL contact/pipeline events
 *
 * Verifies HMAC-SHA256 signature before processing.
 * Handles DND changes and contact deletion → sets ghlOptedOut on profile.
 *
 * Phase 5 — not yet implemented (stub).
 */

import { Env, createDb } from '../lib/db';

export async function handleGhlWebhook(
  request: Request,
  env: Env
): Promise<Response> {
  // Verify signature
  const signature = request.headers.get('x-ghl-signature');
  if (!signature) {
    return new Response('Missing signature', { status: 401 });
  }

  const body = await request.text();
  const valid = await verifyHmac(body, signature, env.GHL_WEBHOOK_SECRET);
  if (!valid) {
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
    case 'contact.delete':
    case 'contact.dnd_update': {
      // TODO (Phase 5): update profiles.ghlOptedOut = true where ghlContactId = contactId
      console.log(
        `[webhook-ghl] ${eventType} for contact ${contactId} — not yet implemented`
      );
      break;
    }
    default:
      // Unknown event type — ignore
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
