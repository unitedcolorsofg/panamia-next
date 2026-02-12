import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { getPrisma } from '@/lib/prisma';
import { VideoRoom } from './_components/video-room';

export default async function SessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  // Next.js 15: params is now a Promise
  const { sessionId } = await params;

  const session = await auth();
  if (!session?.user?.email) {
    redirect('/api/auth/signin');
  }

  const prisma = await getPrisma();

  const mentorSession = await prisma.mentorSession.findFirst({
    where: {
      sessionId: sessionId,
      OR: [
        { mentorEmail: session.user.email },
        { menteeEmail: session.user.email },
      ],
    },
  });

  if (!mentorSession) {
    return <div>Session not found or access denied</div>;
  }

  // Determine user role
  const isMentor = mentorSession.mentorEmail === session.user.email;
  const role = isMentor ? 'mentor' : 'mentee';

  return (
    <div className="h-[calc(100vh-5rem)]">
      <VideoRoom
        sessionId={sessionId}
        userEmail={session.user.email}
        role={role}
        initialNotes={mentorSession.notes || ''}
      />
    </div>
  );
}
