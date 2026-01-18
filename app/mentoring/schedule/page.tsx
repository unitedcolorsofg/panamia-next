import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { getPrisma } from '@/lib/prisma';
import { SessionsList } from './_components/sessions-list';

export default async function SchedulePage() {
  const session = await auth();
  if (!session?.user?.email) {
    redirect('/api/auth/signin');
  }

  const prisma = await getPrisma();

  // Fetch upcoming sessions
  const upcomingSessions = await prisma.mentorSession.findMany({
    where: {
      OR: [
        { mentorEmail: session.user.email },
        { menteeEmail: session.user.email },
      ],
      status: { in: ['scheduled', 'in_progress'] },
      scheduledAt: { gte: new Date() },
    },
    orderBy: { scheduledAt: 'asc' },
    take: 20,
  });

  // Fetch past sessions
  const pastSessions = await prisma.mentorSession.findMany({
    where: {
      AND: [
        {
          OR: [
            { mentorEmail: session.user.email },
            { menteeEmail: session.user.email },
          ],
        },
        {
          OR: [
            { status: { in: ['completed', 'cancelled'] } },
            { scheduledAt: { lt: new Date() } },
          ],
        },
      ],
    },
    orderBy: { scheduledAt: 'desc' },
    take: 20,
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
