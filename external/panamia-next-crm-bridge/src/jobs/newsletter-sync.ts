// Newsletter sync — every 15 minutes (cron: *\/15 * * * *)
//
// Reads rows from the newsletter_signups table (transient queue),
// upserts each as a GHL contact with tag "form:newsletter",
// then deletes the row on success. Failed rows are left for the next run.

import { eq } from 'drizzle-orm';
import { Env, createDb } from '../lib/db';
import { GhlClient } from '../lib/ghl';
import { newsletterSignups } from '../lib/schema';

function splitName(fullName: string | null): {
  firstName: string;
  lastName: string;
} {
  const trimmed = (fullName ?? '').trim();
  if (!trimmed) return { firstName: '', lastName: '' };
  const [first, ...rest] = trimmed.split(/\s+/);
  return { firstName: first, lastName: rest.join(' ') };
}

export async function runNewsletterSync(env: Env): Promise<void> {
  console.log('[newsletter-sync] starting');

  const ghl = new GhlClient(env.GHL_API_KEY);
  const db = createDb(env);

  const rows = await db.select().from(newsletterSignups);

  console.log(`[newsletter-sync] found ${rows.length} signups to process`);

  let synced = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      const { firstName, lastName } = splitName(row.name);

      await ghl.upsertContact({
        email: row.email,
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        locationId: env.GHL_LOCATION_ID,
        tags: ['form:newsletter'],
      });

      await db
        .delete(newsletterSignups)
        .where(eq(newsletterSignups.id, row.id));
      synced++;
    } catch (err) {
      console.error(
        `[newsletter-sync] failed for signup ${row.id} (${row.email}):`,
        err
      );
      failed++;
    }
  }

  console.log(
    `[newsletter-sync] done — synced ${synced}, failed ${failed}, total ${rows.length}`
  );
}
