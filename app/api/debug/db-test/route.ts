/**
 * Temporary diagnostic endpoint — exposes the raw PostgreSQL error from
 * a direct SELECT on verification_tokens so we can debug the "Failed query" issue.
 * REMOVE once the magic link verify is confirmed working.
 */
import { getDb } from '@/lib/db';
import { verification } from '@/lib/schema';

export async function GET() {
  try {
    const db = getDb();
    const rows = await db.select().from(verification).limit(1);
    return Response.json({ ok: true, rowCount: rows.length });
  } catch (err: unknown) {
    // Unwrap error chain to surface the root PostgreSQL error
    const chain: { message: string; code?: string }[] = [];
    let e: unknown = err;
    let depth = 0;
    while (e instanceof Error && depth < 5) {
      const pg = e as Error & {
        code?: string;
        detail?: string;
        severity?: string;
      };
      chain.push({
        message: pg.message.slice(0, 300),
        ...(pg.code && { code: pg.code }),
        ...(pg.detail && { detail: pg.detail }),
        ...(pg.severity && { severity: pg.severity }),
      });
      e = (e as Error & { cause?: unknown }).cause;
      depth++;
    }
    console.error('[db-test] error chain:', JSON.stringify(chain));
    return Response.json({ ok: false, chain }, { status: 500 });
  }
}
