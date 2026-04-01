import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { VideoCall } from './_components/video-call';

export default async function WebRtcTestPage() {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    redirect('/signin');
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold">WebRTC Video Test</h1>
        <p className="text-muted-foreground mt-2">
          Proof-of-concept: Durable Object signaling for peer-to-peer video (2–3
          participants).
        </p>
      </div>
      <VideoCall
        userId={session.user.id}
        userName={session.user.name ?? session.user.email}
      />
    </div>
  );
}
