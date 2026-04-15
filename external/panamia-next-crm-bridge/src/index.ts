/**
 * panamia-crm-bridge — Cloudflare Worker entry point
 *
 * fetch() handler: routes HTTP requests (health check, GHL webhooks, Stripe webhooks)
 * scheduled() handler: dispatches cron jobs (contact sync, inactive sweep)
 *
 * See docs/CRM-ROADMAP.md for full architecture and phased rollout.
 */

import { Env } from './lib/db';
import { handleHealth } from './handlers/health';
import { handleGhlWebhook } from './handlers/webhook-ghl';
import { handleStripeWebhook } from './handlers/webhook-stripe';
import { runContactSync } from './jobs/contact-sync';
import { runInactiveSweep } from './jobs/inactive-sweep';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/health') {
      return handleHealth();
    }

    if (request.method === 'POST' && url.pathname === '/webhooks/ghl') {
      return handleGhlWebhook(request, env);
    }

    if (request.method === 'POST' && url.pathname === '/webhooks/stripe') {
      return handleStripeWebhook(request, env);
    }

    return new Response('Not found', { status: 404 });
  },

  async scheduled(event: ScheduledController, env: Env): Promise<void> {
    switch (event.cron) {
      case '0 * * * *':
        await runContactSync(env);
        break;
      case '0 3 * * *':
        await runInactiveSweep(env);
        break;
      default:
        console.warn(`[index] unknown cron trigger: ${event.cron}`);
    }
  },
} satisfies ExportedHandler<Env>;
