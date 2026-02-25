import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { mentorSessions } from '@/lib/schema';
import { and, asc, desc, eq, gte, lt, or, inArray } from 'drizzle-orm';
import { SessionsList } from './_components/sessions-list';

export default async function SchedulePage() {
  const session = await auth();
  if (!session?.user?.email) {
    redirect('/api/auth/signin');
  }

  const userEmailFilter = or(
    eq(mentorSessions.mentorEmail, session.user.email),
    eq(mentorSessions.menteeEmail, session.user.email)
  );

  // Fetch upcoming sessions
  const upcomingSessions = await db.query.mentorSessions.findMany({
    where: and(
      userEmailFilter,
      inArray(mentorSessions.status, ['scheduled', 'in_progress']),
      gte(mentorSessions.scheduledAt, new Date())
    ),
    orderBy: (t, { asc }) => [asc(t.scheduledAt)],
    limit: 20,
  });

  // Fetch past sessions
  const pastSessions = await db.query.mentorSessions.findMany({
    where: and(
      userEmailFilter,
      or(
        inArray(mentorSessions.status, ['completed', 'cancelled']),
        lt(mentorSessions.scheduledAt, new Date())
      )
    ),
    orderBy: (t, { desc }) => [desc(t.scheduledAt)],
    limit: 20,
  });

  return (
    <main className="container mx-auto max-w-5xl px-4 py-8">
      <div className="space-y-6">
        <h1 className="mb-8 text-3xl font-bold">My Sessions</h1>

        <div className="space-y-8">
          <div>
            <h2 className="mb-4 text-2xl font-semibold">Upcoming Sessions</h2>
            <SessionsList
              sessions={JSON.parse(JSON.stringify(upcomingSessions))}
              userEmail={session.user.email}
              type="upcoming"
            />
          </div>

          <div>
            <h2 className="mb-4 text-2xl font-semibold">Past Sessions</h2>
            <SessionsList
              sessions={JSON.parse(JSON.stringify(pastSessions))}
              userEmail={session.user.email}
              type="past"
            />
          </div>
        </div>
      </div>
    </main>
  );
}
