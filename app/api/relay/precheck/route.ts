import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { profiles } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { getProfileReadiness } from '@/lib/relay/profile-readiness';

// Lightweight readiness check used by /r to decide whether to render the
// keypair UI or a "finish your profile first" CTA. The same gate is enforced
// server-side in /api/relay/enroll — this route exists so the client can
// disable the dead-end UI before the user generates a key they can't use.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'sign-in required' }, { status: 401 });
  }
  const snapshot = await getProfileReadiness(session.user.id);
  const [profile] = await db
    .select({ nostrPubkey: profiles.nostrPubkey })
    .from(profiles)
    .where(eq(profiles.userId, session.user.id))
    .limit(1);
  return NextResponse.json({
    ready: snapshot.ready,
    missing: snapshot.missing,
    enrolledPubkey: profile?.nostrPubkey ?? null,
  });
}

export const maxDuration = 5;
