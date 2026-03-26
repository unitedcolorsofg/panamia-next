/**
 * POST /webhooks/stripe — Stripe subscription lifecycle relay
 *
 * Verifies Stripe webhook signature, then translates subscription events
 * into GHL tag changes so GHL automation can react to membership state.
 *
 * Tag conventions:
 *   panamia-subscriber   — active/trialing subscription (added on create/update)
 *   panamia-churned      — cancelled/unpaid subscription (added on delete/lapse)
 *   panamia-plan-{planId} — specific plan tag (e.g. panamia-plan-basic)
 *
 * The GHL contact is found via profiles.ghlContactId → users.email lookup.
 * If no ghlContactId is linked (user signed up before GHL integration), the
 * event is silently skipped.
 *
 * Requires STRIPE_WEBHOOK_SECRET env var (from Stripe dashboard → Webhooks → Signing Secret).
 *
 * Phase 6 — implemented.
 */

import { eq } from 'drizzle-orm';
import { Env, createDb } from '../lib/db';
import { GhlClient } from '../lib/ghl';
import { profiles, users } from '../lib/schema';

// Stripe subscription statuses that indicate an active paying member
const ACTIVE_STATUSES = new Set(['active', 'trialing']);

export async function handleStripeWebhook(
  request: Request,
  env: Env
): Promise<Response> {
  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return new Response('Missing Stripe-Signature', { status: 401 });
  }

  const body = await request.text();

  const valid = await verifyStripeSignature(
    body,
    signature,
    env.STRIPE_WEBHOOK_SECRET
  );
  if (!valid) {
    console.warn('[webhook-stripe] invalid signature');
    return new Response('Invalid signature', { status: 401 });
  }

  let event: StripeEvent;
  try {
    event = JSON.parse(body) as StripeEvent;
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  console.log(`[webhook-stripe] received event: ${event.type}`);

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      await handleSubscriptionChange(event.data.object, env, 'upsert');
      break;

    case 'customer.subscription.deleted':
      await handleSubscriptionChange(event.data.object, env, 'churn');
      break;

    default:
      // Ignore all other Stripe events
      break;
  }

  return new Response('ok', { status: 200 });
}

async function handleSubscriptionChange(
  subscription: StripeSubscription,
  env: Env,
  action: 'upsert' | 'churn'
): Promise<void> {
  const customerEmail = subscription.customer_email;
  if (!customerEmail) {
    console.log(
      '[webhook-stripe] subscription has no customer_email — skipping'
    );
    return;
  }

  const db = createDb(env);

  const row = await db
    .select({ ghlContactId: profiles.ghlContactId })
    .from(profiles)
    .innerJoin(users, eq(profiles.userId, users.id))
    .where(eq(users.email, customerEmail.toLowerCase()))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!row?.ghlContactId) {
    console.log(
      `[webhook-stripe] no linked GHL contact for ${customerEmail} — skipping`
    );
    return;
  }

  const ghl = new GhlClient(env.GHL_API_KEY);
  const contactId = row.ghlContactId;
  const planId =
    subscription.items?.data?.[0]?.price?.lookup_key ??
    subscription.items?.data?.[0]?.price?.id;

  try {
    if (action === 'upsert' && ACTIVE_STATUSES.has(subscription.status)) {
      await ghl.addTag(contactId, 'panamia-subscriber');
      await ghl.removeTag(contactId, 'panamia-churned').catch(() => {
        /* tag may not exist — ignore */
      });
      if (planId) {
        await ghl.addTag(contactId, `panamia-plan-${planId}`);
      }
      console.log(
        `[webhook-stripe] tagged subscriber: ${contactId} (plan: ${planId ?? 'unknown'})`
      );
    } else if (
      action === 'churn' ||
      !ACTIVE_STATUSES.has(subscription.status)
    ) {
      await ghl.addTag(contactId, 'panamia-churned');
      await ghl.removeTag(contactId, 'panamia-subscriber').catch(() => {
        /* tag may not exist — ignore */
      });
      console.log(`[webhook-stripe] tagged churned: ${contactId}`);
    }
  } catch (err) {
    // Log but don't fail — Stripe expects 200 to avoid retries on non-transient errors
    console.error(
      `[webhook-stripe] GHL tag update failed for ${contactId}:`,
      err
    );
  }
}

// ---------------------------------------------------------------------------
// Stripe webhook signature verification
// https://stripe.com/docs/webhooks/signatures
// ---------------------------------------------------------------------------

async function verifyStripeSignature(
  payload: string,
  header: string,
  secret: string
): Promise<boolean> {
  // Parse: t=<timestamp>,v1=<hex_sig>
  const parts = Object.fromEntries(
    header.split(',').map((part) => {
      const idx = part.indexOf('=');
      return [part.slice(0, idx), part.slice(idx + 1)];
    })
  );

  const timestamp = parts['t'];
  const v1 = parts['v1'];
  if (!timestamp || !v1) return false;

  // Reject events older than 5 minutes (replay protection)
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (age > 300) {
    console.warn(`[webhook-stripe] stale event: ${age}s old`);
    return false;
  }

  const signedPayload = `${timestamp}.${payload}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(signedPayload)
  );
  const computed = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return computed === v1;
}

// ---------------------------------------------------------------------------
// Minimal Stripe types (only what we need)
// ---------------------------------------------------------------------------

interface StripeEvent {
  type: string;
  data: { object: StripeSubscription };
}

interface StripeSubscription {
  id: string;
  status: string;
  customer_email?: string;
  items?: {
    data?: Array<{
      price?: {
        id?: string;
        lookup_key?: string;
      };
    }>;
  };
}
